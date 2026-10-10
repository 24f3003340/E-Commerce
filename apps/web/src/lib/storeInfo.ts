import 'server-only';
import { serverGetSafe } from './server';

export interface StoreInfo {
  storeName: string;
  legalName: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  gstin: string;
  whatsappNumber: string;
  freeShippingThreshold: number;
  standardShippingFee: number;
  expressShippingFee: number;
  codEnabled: boolean;
  codFee: number;
  defaultReturnWindowDays: number;
  /** Online payments switch on once Razorpay keys are added on the API */
  onlinePayments: boolean;
  sellerRegistrationOpen: boolean;
}

const FALLBACK: StoreInfo = {
  storeName: process.env.NEXT_PUBLIC_STORE_NAME ?? 'DukaanX',
  legalName: process.env.NEXT_PUBLIC_STORE_NAME ?? 'DukaanX',
  supportEmail: 'support@example.com',
  supportPhone: '',
  address: '',
  gstin: '',
  whatsappNumber: '',
  freeShippingThreshold: 99900,
  standardShippingFee: 7900,
  expressShippingFee: 14900,
  codEnabled: true,
  codFee: 4900,
  defaultReturnWindowDays: 7,
  onlinePayments: false,
  sellerRegistrationOpen: true,
};

/** Public store details maintained from Admin → Settings. */
export async function getStoreInfo(): Promise<StoreInfo> {
  return { ...FALLBACK, ...(await serverGetSafe<Partial<StoreInfo>>('/settings/public', {})) };
}
