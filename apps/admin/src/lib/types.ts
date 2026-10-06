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
