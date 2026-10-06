import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InventoryReason,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentRecordStatus,
  Prisma,
  RefundStatus,
  ReturnStatus,
} from '@prisma/client';
import { CategoriesService } from '../catalog/categories.service';
import { CacheService } from '../common/cache.service';
import { SettingsService } from '../common/settings.service';
import { nextSequenceNumber, paginate, paginated } from '../common/utils';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { RETURN_TRANSITIONS, returnRefundAmount } from './return-state';
import { CreateReturnDto, UpdateReturnStatusDto } from './returns.dto';

const returnInclude = {
  items: { include: { orderItem: true } },
  order: { select: { id: true, orderNumber: true, paymentMethod: true, total: true, deliveredAt: true } },
  refunds: true,
} satisfies Prisma.ReturnRequestInclude;

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly settings: SettingsService,
    private readonly orders: OrdersService,
    private readonly notifications: NotificationsService,
    private readonly cache: CacheService,
  ) {}

  /** Which items of a delivered order can still be returned, and until when. */
  async eligibility(userId: string, orderNumber: string) {
    const order = await this.prisma.order.findUnique({ where: { orderNumber }, include: { items: true } });
    if (!order || order.userId !== userId) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.DELIVERED || !order.deliveredAt) {
      return { orderNumber, eligible: false, reason: 'Returns can be requested after delivery', items: [] };
    }
    const settings = await this.settings.get();
    const primaries = await this.prisma.productCategory.findMany({
      where: { productId: { in: order.items.map((i) => i.productId) } },
      orderBy: { isPrimary: 'desc' },
    });
    const items = [];
    for (const item of order.items) {
      const cat = primaries.find((p) => p.productId === item.productId);
      const policy = cat ? await this.categories.returnPolicy(cat.categoryId) : {};
      const windowDays = policy.returnWindowDays ?? settings.defaultReturnWindowDays;
      const deadline = new Date(order.deliveredAt.getTime() + windowDays * 86_400_000);
      const returnable = (policy.isReturnable ?? true) && deadline > new Date();
      items.push({
        orderItemId: item.id,
        productName: item.productName,
        variantLabel: item.variantLabel,
        imageUrl: item.imageUrl,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        returnableQuantity: returnable ? item.quantity - item.returnedQuantity : 0,
        returnBy: deadline,
        policyNote: policy.isReturnable === false ? 'This item is not returnable' : undefined,
      });
    }
    return { orderNumber, eligible: items.some((i) => i.returnableQuantity > 0), items };
  }

  async create(userId: string, dto: CreateReturnDto) {
    const eligibility = await this.eligibility(userId, dto.orderNumber);
    if (!eligibility.eligible) throw new BadRequestException(eligibility.reason ?? 'This order is not eligible for return');

    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { orderNumber: dto.orderNumber }, include: { items: true } });
      const lines: { unitPrice: number; quantity: number }[] = [];
      for (const req of dto.items) {
        const info = eligibility.items.find((i) => i.orderItemId === req.orderItemId);
        if (!info || req.quantity > info.returnableQuantity) {
          throw new BadRequestException('One or more items cannot be returned in that quantity');
        }
        // Conditional increment protects against two concurrent return requests.
        const item = order.items.find((i) => i.id === req.orderItemId)!;
        const updated = await tx.orderItem.updateMany({
          where: { id: item.id, returnedQuantity: { lte: item.quantity - req.quantity } },
          data: { returnedQuantity: { increment: req.quantity } },
        });
        if (updated.count === 0) throw new BadRequestException('Return already requested for these items');
        lines.push({ unitPrice: item.unitPrice, quantity: req.quantity });
      }
      return tx.returnRequest.create({
        data: {
          returnNumber: await nextSequenceNumber(tx, 'RET'),
          orderId: order.id,
          userId,
          reason: dto.reason,
          comment: dto.comment,
          refundAmount: returnRefundAmount(lines, order),
          items: { create: dto.items.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity })) },
        },
        include: returnInclude,
      });
    });
    await this.notifications.notify(userId, 'RETURN_REQUESTED', 'Return requested', `We received your return request ${created.returnNumber}.`, {
      returnNumber: created.returnNumber,
    });
    return created;
  }

  async mine(userId: string) {
    return this.prisma.returnRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: returnInclude });
  }

  async adminList(status?: ReturnStatus, page?: number, limit?: number) {
    const p = paginate(page, limit);
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.returnRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
        include: { ...returnInclude, user: { select: { name: true, email: true } } },
      }),
      this.prisma.returnRequest.count({ where }),
    ]);
    return paginated(items, total, p.page, p.limit);
  }

  async adminGet(id: string) {
    const ret = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: { ...returnInclude, user: { select: { name: true, email: true, phone: true } } },
    });
    if (!ret) throw new NotFoundException('Return not found');
    return { ...ret, allowedNextStatuses: RETURN_TRANSITIONS[ret.status] };
  }

  async updateStatus(id: string, dto: UpdateReturnStatusDto) {
    const ret = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: { items: { include: { orderItem: true } }, order: { include: { payments: true } } },
    });
    if (!ret) throw new NotFoundException('Return not found');
    if (!RETURN_TRANSITIONS[ret.status].includes(dto.status)) {
      throw new BadRequestException(`Cannot change return from ${ret.status} to ${dto.status}`);
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.returnRequest.updateMany({
        where: { id, status: ret.status },
        data: { status: dto.status, adminNote: dto.note ?? ret.adminNote },
      });
      if (updated.count === 0) throw new BadRequestException('Return was modified concurrently, please retry');

      if (dto.status === ReturnStatus.REJECTED || dto.status === ReturnStatus.QC_FAILED) {
        for (const item of ret.items) {
          await tx.orderItem.update({
            where: { id: item.orderItemId },
            data: { returnedQuantity: { decrement: item.quantity } },
          });
        }
      }

      if (dto.status === ReturnStatus.QC_PASSED) {
        for (const item of ret.items) {
          await tx.productVariant.update({
            where: { id: item.orderItem.variantId },
            data: { stock: { increment: item.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              variantId: item.orderItem.variantId,
              change: item.quantity,
              reason: InventoryReason.RETURN_RESTOCK,
              reference: ret.returnNumber,
            },
          });
        }
      }

      if (dto.status === ReturnStatus.REFUNDED) {
        const captured = ret.order.payments.find(
          (p) => p.status === PaymentRecordStatus.CAPTURED && p.provider !== PaymentProvider.COD,
        );
        const isOnline = ret.order.paymentMethod === PaymentMethod.ONLINE && captured;
        await tx.refund.create({
          data: {
            orderId: ret.orderId,
            returnId: ret.id,
            paymentId: isOnline ? captured!.id : undefined,
            amount: ret.refundAmount,
            // COD refunds are paid out manually (bank / UPI) and recorded as processed.
            status: isOnline ? RefundStatus.PENDING : RefundStatus.PROCESSED,
            mode: isOnline ? 'ORIGINAL' : (dto.refundMode ?? 'BANK'),
          },
        });
      }
    });

    if (dto.status === ReturnStatus.QC_PASSED) await this.cache.delByPrefix('catalog:');
    if (dto.status === ReturnStatus.REFUNDED) {
      await this.orders.processPendingRefunds(ret.orderId);
      await this.orders.syncRefundedPaymentStatus(ret.orderId);
    }
    const messages: Partial<Record<ReturnStatus, [string, string]>> = {
      APPROVED: ['RETURN_APPROVED', 'Your return has been approved. Our courier partner will pick it up soon.'],
      REJECTED: ['RETURN_REJECTED', `Your return request was rejected.${dto.note ? ` ${dto.note}` : ''}`],
      REFUNDED: ['REFUND_PROCESSED', `Refund of ₹${(ret.refundAmount / 100).toFixed(2)} has been processed.`],
    };
    const msg = messages[dto.status];
    if (msg) {
      await this.notifications.notify(ret.userId, msg[0] as any, `Return ${ret.returnNumber}`, msg[1], {
        returnNumber: ret.returnNumber,
      });
    }
    return this.adminGet(id);
  }
}
