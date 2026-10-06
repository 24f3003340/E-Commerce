// All money values are integer paise.
export type OrderStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'PROCESSING' | 'PACKED' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'PRODUCT_MANAGER' | 'ORDER_MANAGER' | 'SUPPORT_MANAGER' | 'MARKETING_MANAGER';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  twoFactorEnabled: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  isReturnable: boolean | null;
  returnWindowDays: number | null;
  children: Category[];
}

export type SellerStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string;
  storeName: string;
  slug: string;
  description: string | null;
  gstin: string | null;
  pan: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  status: SellerStatus;
  statusNote: string | null;
  commissionPct: number | null;
  approvedAt: string | null;
  createdAt: string;
}

/** Seller earnings as computed by the API (all amounts in paise). */
export interface Earnings {
  holdDays: number;
  totals: { readyForPayout: number; onHold: number; paidOut: number; payouts: number };
  orders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    createdAt: string;
    deliveredAt: string | null;
    commissionPct: number;
    itemValue: number;
    commission: number;
    payable: number;
    eligible: boolean;
    releaseOn: string | null;
  }[];
}

export interface Payout {
  id: string;
  payoutNumber: string;
  amount: number;
  orderCount: number;
  reference: string | null;
  note: string | null;
  createdAt: string;
  seller: { id: string; storeName: string };
  orders: { id: string; orderNumber: string }[];
}
