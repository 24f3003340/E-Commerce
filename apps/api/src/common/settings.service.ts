import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from './cache.service';

/** Store-wide settings editable from the admin panel. Amounts are in paise. */
export interface StoreSettings {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  freeShippingThreshold: number;
  standardShippingFee: number;
  expressShippingFee: number;
  codEnabled: boolean;
  codFee: number;
  codMaxOrderValue: number;
  defaultReturnWindowDays: number;
  /** Pincode prefixes we do not deliver to */
  blockedPincodePrefixes: string[];
  /** Pincode prefixes with faster (metro) delivery */
  metroPincodePrefixes: string[];
  gstin: string;
  invoiceAddress: string;
  /** Registered business name shown on invoices and policy pages */
  legalName: string;
  /** State the goods ship from — decides CGST+SGST (same state) vs IGST */
  sellerState: string;
  /** GST % for items priced at or below `gstHighRateAbove` (per unit, paise) */
  gstRateLow: number;
  /** GST % for items priced above `gstHighRateAbove` */
  gstRateHigh: number;
  gstHighRateAbove: number;
  /** HSN code used when a product has none */
  defaultHsn: string;
  /** New-order alerts are emailed here (empty = off) */
  orderAlertEmail: string;
  /** WhatsApp support number with country code, e.g. 919876543210 */
  whatsappNumber: string;
  // ── Marketplace ──
  /** Whether outside sellers can sign up from the seller panel */
  sellerRegistrationOpen: boolean;
  /** Commission (% of item value) kept by the marketplace when a seller has no custom rate */
  defaultCommissionPct: number;
  /** Seller products go live only after the marketplace team approves them */
  sellerProductApproval: boolean;
  /** Days after delivery before an order's earnings can be paid out (covers the return window) */
  sellerPayoutHoldDays: number;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'StyleKart',
  supportEmail: 'support@example.com',
  supportPhone: '+91 90000 00000',
  freeShippingThreshold: 99900,
  standardShippingFee: 7900,
  expressShippingFee: 14900,
  codEnabled: true,
  codFee: 4900,
  codMaxOrderValue: 1000000,
  defaultReturnWindowDays: 7,
  blockedPincodePrefixes: [],
  metroPincodePrefixes: ['11', '40', '56', '60', '50', '70', '41', '38'],
  gstin: '',
  invoiceAddress: 'Registered office address',
  legalName: 'StyleKart Retail',
  sellerState: 'Karnataka',
  // Apparel GST slabs change from time to time — confirm the current rates with your CA.
  gstRateLow: 5,
  gstRateHigh: 18,
  gstHighRateAbove: 250000,
  defaultHsn: '6109',
  orderAlertEmail: '',
  whatsappNumber: '',
  sellerRegistrationOpen: true,
  defaultCommissionPct: 10,
  sellerProductApproval: true,
  sellerPayoutHoldDays: 10,
};

const CACHE_KEY = 'settings:store';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async get(): Promise<StoreSettings> {
    return this.cache.wrap(CACHE_KEY, 60, async () => {
      const row = await this.prisma.setting.findUnique({ where: { key: 'store' } });
      return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<StoreSettings>) ?? {}) };
    });
  }

  async update(patch: Partial<StoreSettings>): Promise<StoreSettings> {
    const current = await this.get();
    const next = { ...current, ...patch };
    await this.prisma.setting.upsert({
      where: { key: 'store' },
      create: { key: 'store', value: next as unknown as Prisma.InputJsonValue },
      update: { value: next as unknown as Prisma.InputJsonValue },
    });
    await this.cache.delByPrefix(CACHE_KEY);
    return next;
  }
}
