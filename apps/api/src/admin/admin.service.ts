import { Injectable } from '@nestjs/common';
import { OrderStatus, ProductStatus, ReturnStatus } from '@prisma/client';
import { LOW_STOCK_THRESHOLD } from '../catalog/inventory.service';
import { PrismaService } from '../prisma/prisma.service';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const NON_REVENUE: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT];

/** Midnight IST of the given day, as a UTC Date. */
export function startOfIstDay(date = new Date()): Date {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const today = startOfIstDay();
    const revenueWhere = { status: { notIn: NON_REVENUE } };
    const [todaySales, ordersToday, customers, products, pendingOrders, returns, lowStock, recentOrders, series] =
      await Promise.all([
        this.prisma.order.aggregate({ where: { ...revenueWhere, createdAt: { gte: today } }, _sum: { total: true } }),
        this.prisma.order.count({ where: { ...revenueWhere, createdAt: { gte: today } } }),
        this.prisma.user.count(),
        this.prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
        this.prisma.order.count({
          where: { status: { in: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PACKED] } },
        }),
        this.prisma.returnRequest.count({
          where: {
            status: {
              in: [ReturnStatus.REQUESTED, ReturnStatus.APPROVED, ReturnStatus.PICKUP_SCHEDULED, ReturnStatus.PICKED_UP, ReturnStatus.RECEIVED, ReturnStatus.QC_PASSED],
            },
          },
        }),
        this.prisma.productVariant.count({ where: { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD } } }),
        this.prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { user: { select: { name: true } } },
        }),
        this.dailySales(new Date(today.getTime() - 13 * 86_400_000), new Date(today.getTime() + 86_400_000)),
      ]);
    return {
      todaySales: todaySales._sum.total ?? 0,
      ordersToday,
      customers,
      products,
      pendingOrders,
      returns,
      lowStock,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customer: o.user.name,
        total: o.total,
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
      })),
      salesSeries: series,
    };
  }

  /** Sales per IST calendar day, including days with no orders. */
  async dailySales(from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<{ day: string; orders: number; sales: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day,
             COUNT(*)::float8 AS orders,
             COALESCE(SUM(total), 0)::float8 AS sales
      FROM orders
      WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
        AND status NOT IN ('CANCELLED', 'PENDING_PAYMENT')
      GROUP BY 1 ORDER BY 1`;
    const byDay = new Map(rows.map((r) => [r.day, r]));
    const result: { day: string; orders: number; sales: number }[] = [];
    for (let t = startOfIstDay(from).getTime(); t < to.getTime(); t += 86_400_000) {
      const day = new Date(t + IST_OFFSET_MS).toISOString().slice(0, 10);
      const row = byDay.get(day);
      result.push({ day, orders: Number(row?.orders ?? 0), sales: Number(row?.sales ?? 0) });
    }
    return result;
  }

  async salesReport(fromStr?: string, toStr?: string) {
    const to = toStr ? new Date(startOfIstDay(new Date(toStr)).getTime() + 86_400_000) : new Date(startOfIstDay().getTime() + 86_400_000);
    const from = fromStr ? startOfIstDay(new Date(fromStr)) : new Date(to.getTime() - 30 * 86_400_000);
    const where = { status: { notIn: NON_REVENUE }, createdAt: { gte: from, lt: to } };
    const [series, totals, byMethod, topItems, refunds, cancelled] = await Promise.all([
      this.dailySales(from, to),
      this.prisma.order.aggregate({ where, _sum: { total: true, discount: true, shippingFee: true }, _count: { _all: true } }),
      this.prisma.order.groupBy({ by: ['paymentMethod'], where, _sum: { total: true }, _count: { _all: true } }),
      this.prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        where: { order: where },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 10,
      }),
      this.prisma.refund.aggregate({ where: { status: 'PROCESSED', createdAt: { gte: from, lt: to } }, _sum: { amount: true } }),
      this.prisma.order.count({ where: { status: OrderStatus.CANCELLED, createdAt: { gte: from, lt: to } } }),
    ]);
    const orders = totals._count._all;
    const sales = totals._sum.total ?? 0;
    return {
      from,
      to,
      series,
      summary: {
        orders,
        sales,
        averageOrderValue: orders ? Math.round(sales / orders) : 0,
        discounts: totals._sum.discount ?? 0,
        shipping: totals._sum.shippingFee ?? 0,
        refunds: refunds._sum.amount ?? 0,
        cancelledOrders: cancelled,
      },
      byPaymentMethod: byMethod.map((m) => ({ method: m.paymentMethod, orders: m._count._all, sales: m._sum.total ?? 0 })),
      topProducts: topItems.map((t) => ({
        productId: t.productId,
        name: t.productName,
        quantity: t._sum.quantity ?? 0,
        sales: t._sum.total ?? 0,
      })),
    };
  }
}
