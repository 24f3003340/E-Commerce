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
