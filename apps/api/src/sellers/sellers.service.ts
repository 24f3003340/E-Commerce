import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OrderStatus, Prisma, Seller, SellerStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { LOW_STOCK_THRESHOLD } from '../catalog/inventory.service';
import { ChangePasswordDto, LoginDto } from '../auth/auth.dto';
import { AuthService } from '../auth/auth.service';
import { TokensService } from '../auth/tokens.service';
import { CacheService } from '../common/cache.service';
import { config } from '../common/config';
import { EmailService, escapeHtml } from '../common/email.service';
import { SettingsService } from '../common/settings.service';
import { nextSequenceNumber, paginate, paginated, slugify } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { AdminSellerQueryDto, CreatePayoutDto, SellerProfileDto, SellerRegisterDto } from './sellers.dto';
import { isPayoutEligible, orderSettlement } from './settlement';

// Keeps login timing similar whether or not the account exists
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-password', 12);

const OPEN_ORDER_STATUSES: OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PACKED];

/** Everything about a seller except the password hash. */
export function publicSeller(s: Seller) {
  const { passwordHash: _hash, ...rest } = s;
  return rest;
}

@Injectable()
export class SellersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly settings: SettingsService,
    private readonly email: EmailService,
    private readonly cache: CacheService,
  ) {}

  // ───────────── Seller accounts ─────────────

  async register(dto: SellerRegisterDto) {
    const settings = await this.settings.get();
    if (!settings.sellerRegistrationOpen) throw new ForbiddenException('Seller registrations are closed right now');
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.seller.findFirst({ where: { OR: [{ email }, { phone: dto.phone }] } });
    if (exists) throw new ConflictException('A seller account with this email or phone already exists');
    const { password, ...details } = dto;
    const seller = await this.prisma.seller.create({
      data: {
        ...this.clean(details),
        email,
        slug: await this.uniqueSlug(dto.storeName),
        passwordHash: await AuthService.hashPassword(password),
      },
    });

    if (settings.orderAlertEmail) {
      const html = await this.email.layout(
        'New seller registration',
        `<p><b>${escapeHtml(seller.storeName)}</b> (${escapeHtml(seller.name)}, ${escapeHtml(seller.email)}, ${escapeHtml(seller.phone)}) signed up as a seller from ${escapeHtml(seller.city)}, ${escapeHtml(seller.state)}.</p><p>Review and approve them from Admin → Sellers.</p>`,
      );
      await this.email.send(settings.orderAlertEmail, `New seller: ${seller.storeName}`, html, `New seller ${seller.storeName} is waiting for approval`);
    }
    const welcome = await this.email.layout(
      `Welcome to ${settings.storeName}, ${seller.storeName}!`,
      `<p>Thanks for registering as a seller. Our team will verify your details and approve your account, usually within 1–2 working days.</p><p>Meanwhile you can log in to your seller panel and start adding products — they go live once your account and products are approved.</p>`,
      { label: 'Open seller panel', url: config.sellerPanelUrl },
    );
    await this.email.send(seller.email, `Your ${settings.storeName} seller account`, welcome, `Welcome! Log in at ${config.sellerPanelUrl}`);

    return { seller: publicSeller(seller), ...(await this.tokens.issueForSeller(seller.id)) };
  }

  async login(dto: LoginDto) {
    const seller = await this.prisma.seller.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    const ok = await bcrypt.compare(dto.password, seller?.passwordHash ?? DUMMY_HASH);
    if (!seller || !ok) throw new UnauthorizedException('Invalid email or password');
    await this.prisma.seller.update({ where: { id: seller.id }, data: { lastLoginAt: new Date() } });
    return { seller: publicSeller(seller), ...(await this.tokens.issueForSeller(seller.id)) };
  }

  async refresh(refreshToken: string) {
    const { sellerId } = await this.tokens.consume(refreshToken);
    if (!sellerId) throw new UnauthorizedException('Invalid refresh token');
    const seller = await this.prisma.seller.findUniqueOrThrow({ where: { id: sellerId } });
    return { seller: publicSeller(seller), ...(await this.tokens.issueForSeller(seller.id)) };
  }

  async me(sellerId: string) {
    return publicSeller(await this.prisma.seller.findUniqueOrThrow({ where: { id: sellerId } }));
  }

  async updateProfile(sellerId: string, dto: SellerProfileDto) {
    if (dto.phone) {
      const taken = await this.prisma.seller.findFirst({ where: { phone: dto.phone, id: { not: sellerId } } });
      if (taken) throw new ConflictException('This phone number is used by another seller');
    }
    const seller = await this.prisma.seller.update({ where: { id: sellerId }, data: this.clean(dto) });
    await this.cache.delByPrefix('catalog:');
    return publicSeller(seller);
  }

  async changePassword(sellerId: string, dto: ChangePasswordDto) {
    const seller = await this.prisma.seller.findUniqueOrThrow({ where: { id: sellerId } });
    if (!(await bcrypt.compare(dto.currentPassword, seller.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    await this.prisma.seller.update({ where: { id: sellerId }, data: { passwordHash: await AuthService.hashPassword(dto.newPassword) } });
    await this.tokens.revokeAll({ sellerId });
    return { ok: true };
  }

  // ───────────── Seller dashboard & earnings ─────────────

  async dashboard(sellerId: string) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [productsByStatus, toShip, monthOrders, lowStock, recentOrders, earnings] = await Promise.all([
      this.prisma.product.groupBy({ by: ['status'], where: { sellerId }, _count: { _all: true } }),
      this.prisma.order.count({ where: { sellerId, status: { in: OPEN_ORDER_STATUSES } } }),
      this.prisma.order.aggregate({
        where: { sellerId, createdAt: { gte: monthStart }, status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT] } },
        _count: { _all: true },
        _sum: { subtotal: true },
      }),
      this.prisma.productVariant.count({ where: { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD }, product: { sellerId } } }),
      this.prisma.order.findMany({
        where: { sellerId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { user: { select: { name: true } } },
      }),
      this.earningsSummary(sellerId),
    ]);
    return {
      products: Object.fromEntries(productsByStatus.map((p) => [p.status, p._count._all])),
      ordersToShip: toShip,
      ordersThisMonth: monthOrders._count._all,
      salesThisMonth: monthOrders._sum.subtotal ?? 0,
      lowStock,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customer: o.user.name,
        subtotal: o.subtotal,
        status: o.status,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
      })),
      earnings: earnings.totals,
    };
  }

  /**
   * Settlement of every order of the seller that is not yet paid out, split into "on hold" (not
   * delivered yet / inside the return window) and "ready for payout", plus what was already paid.
   */
  async earningsSummary(sellerId: string) {
    const { sellerPayoutHoldDays } = await this.settings.get();
    const [orders, paid] = await Promise.all([
      this.prisma.order.findMany({
        where: { sellerId, payoutId: null, status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT] } },
        orderBy: { createdAt: 'desc' },
        include: { items: { select: { unitPrice: true, quantity: true, returnedQuantity: true } }, returns: { select: { status: true } } },
      }),
      this.prisma.sellerPayout.aggregate({ where: { sellerId }, _sum: { amount: true }, _count: { _all: true } }),
    ]);
    const rows = orders.map((o) => {
      const settlement = orderSettlement(o);
      const eligible = isPayoutEligible(o, sellerPayoutHoldDays);
      const releaseOn = o.deliveredAt ? new Date(o.deliveredAt.getTime() + sellerPayoutHoldDays * 86_400_000) : null;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        createdAt: o.createdAt,
        deliveredAt: o.deliveredAt,
        commissionPct: o.commissionPct,
        ...settlement,
        eligible,
        releaseOn,
      };
    });
    const sum = (list: typeof rows) => list.reduce((s, r) => s + r.payable, 0);
    const ready = rows.filter((r) => r.eligible);
    return {
      holdDays: sellerPayoutHoldDays,
      totals: {
        readyForPayout: sum(ready),
        onHold: sum(rows.filter((r) => !r.eligible)),
        paidOut: paid._sum.amount ?? 0,
        payouts: paid._count._all,
      },
      orders: rows,
    };
  }

  async payouts(sellerId?: string, page?: number, limit?: number) {
    const p = paginate(page, limit);
    const where = sellerId ? { sellerId } : {};
    const [items, total] = await Promise.all([
      this.prisma.sellerPayout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
        include: { seller: { select: { id: true, storeName: true } }, orders: { select: { id: true, orderNumber: true } } },
      }),
      this.prisma.sellerPayout.count({ where }),
    ]);
    return paginated(items, total, p.page, p.limit);
  }

  // ───────────── Admin: seller management ─────────────

  async adminList(query: AdminSellerQueryDto) {
    const p = paginate(query.page, query.limit);
    const q = query.q?.trim();
    const where: Prisma.SellerWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(q
        ? {
            OR: [
              { storeName: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
              { gstin: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.seller.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
        include: { _count: { select: { products: true, orders: true } } },
      }),
      this.prisma.seller.count({ where }),
    ]);
    return paginated(
      items.map(({ passwordHash: _hash, ...s }) => s),
      total,
      p.page,
      p.limit,
    );
  }

  async adminGet(id: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id },
      include: { _count: { select: { products: true, orders: true } } },
    });
    if (!seller) throw new NotFoundException('Seller not found');
    const [productsByStatus, earnings, settings] = await Promise.all([
      this.prisma.product.groupBy({ by: ['status'], where: { sellerId: id }, _count: { _all: true } }),
      this.earningsSummary(id),
      this.settings.get(),
    ]);
    const { passwordHash: _hash, ...rest } = seller;
    return {
      ...rest,
      effectiveCommissionPct: seller.commissionPct ?? settings.defaultCommissionPct,
      products: Object.fromEntries(productsByStatus.map((p) => [p.status, p._count._all])),
      earnings,
    };
  }

  async setStatus(id: string, status: SellerStatus, note?: string) {
    const current = await this.prisma.seller.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Seller not found');
    const seller = await this.prisma.seller.update({
      where: { id },
      data: {
        status,
        statusNote: status === SellerStatus.APPROVED ? null : (note ?? null),
        ...(status === SellerStatus.APPROVED && !current.approvedAt ? { approvedAt: new Date() } : {}),
      },
    });
    // Their products appear in / disappear from the store immediately
    await this.cache.delByPrefix('catalog:');

    const settings = await this.settings.get();
    const messages: Partial<Record<SellerStatus, [string, string]>> = {
      APPROVED: ['Your seller account is approved 🎉', `Your store <b>${escapeHtml(seller.storeName)}</b> is now live on ${escapeHtml(settings.storeName)}. Products you submit will appear in the store once approved.`],
      REJECTED: ['Your seller application was not approved', `We could not approve <b>${escapeHtml(seller.storeName)}</b> right now.${note ? `<br>Reason: ${escapeHtml(note)}` : ''}<br>Reply to this email if you have questions.`],
      SUSPENDED: ['Your seller account is suspended', `Your store <b>${escapeHtml(seller.storeName)}</b> is temporarily hidden from ${escapeHtml(settings.storeName)}.${note ? `<br>Reason: ${escapeHtml(note)}` : ''}`],
    };
    const message = messages[status];
    if (message && status !== current.status) {
      const html = await this.email.layout(message[0], `<p>${message[1]}</p>`, { label: 'Open seller panel', url: config.sellerPanelUrl });
      await this.email.send(seller.email, message[0], html, message[0]);
    }
    return this.adminGet(id);
  }

  async setCommission(id: string, commissionPct: number | null) {
    await this.prisma.seller.update({ where: { id }, data: { commissionPct } });
    return this.adminGet(id);
  }

  /**
   * Records a transfer to the seller covering every order that is ready for payout. The marketplace
   * team makes the bank / UPI transfer first and enters its reference here.
   */
  async createPayout(sellerId: string, dto: CreatePayoutDto, adminId: string) {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('Seller not found');
    const { sellerPayoutHoldDays } = await this.settings.get();
    const payout = await this.prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: { sellerId, payoutId: null, status: OrderStatus.DELIVERED },
        include: { items: { select: { unitPrice: true, quantity: true, returnedQuantity: true } }, returns: { select: { status: true } } },
      });
      const ready = orders.filter((o) => isPayoutEligible(o, sellerPayoutHoldDays));
      if (!ready.length) throw new BadRequestException('Nothing is ready for payout for this seller yet');
      const amount = ready.reduce((s, o) => s + orderSettlement(o).payable, 0);
      const created = await tx.sellerPayout.create({
        data: {
          payoutNumber: await nextSequenceNumber(tx, 'PAY'),
          sellerId,
          amount,
          orderCount: ready.length,
          reference: dto.reference,
          note: dto.note,
          createdBy: adminId,
        },
      });
      const claimed = await tx.order.updateMany({
        where: { id: { in: ready.map((o) => o.id) }, payoutId: null },
        data: { payoutId: created.id },
      });
      if (claimed.count !== ready.length) throw new ConflictException('Some orders were paid out at the same time, please retry');
      return created;
    });

    const settings = await this.settings.get();
    const rupees = `₹${(payout.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const html = await this.email.layout(
      `Payout ${payout.payoutNumber} sent`,
      `<p>We transferred <b>${rupees}</b> for ${payout.orderCount} delivered order(s) to your registered bank account / UPI.</p><p>Reference: ${escapeHtml(payout.reference)}</p>`,
      { label: 'View earnings', url: `${config.sellerPanelUrl}/earnings` },
    );
    await this.email.send(seller.email, `${settings.storeName} payout ${rupees}`, html, `Payout ${payout.payoutNumber}: ${rupees}`);
    return payout;
  }

  async notifyProductReview(productId: string, approved: boolean, note?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, include: { seller: true } });
    if (!product?.seller) return;
    const heading = approved ? `"${product.name}" is live` : `"${product.name}" needs changes`;
    const body = approved
      ? `<p>Your product <b>${escapeHtml(product.name)}</b> was approved${product.seller.status === SellerStatus.APPROVED ? ' and is now visible in the store' : ''}.</p>`
      : `<p>Your product <b>${escapeHtml(product.name)}</b> was not approved.${note ? `<br>Reason: ${escapeHtml(note)}` : ''}</p><p>Edit it in your seller panel and submit it again.</p>`;
    const html = await this.email.layout(heading, body, { label: 'Open product', url: `${config.sellerPanelUrl}/products/${product.id}` });
    await this.email.send(product.seller.email, heading, html, heading);
  }

  // ───────────── helpers ─────────────

  /** Empty strings from forms clear optional fields. */
  private clean<T extends object>(data: T): T {
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])) as T;
  }

  private async uniqueSlug(source: string) {
    const base = slugify(source) || 'seller';
    let slug = base;
    for (let i = 2; await this.prisma.seller.findUnique({ where: { slug }, select: { id: true } }); i++) {
      slug = `${base}-${i}`;
    }
    return slug;
  }
}
