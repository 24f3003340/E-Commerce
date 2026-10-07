// Shapes returned by the backend API. All money values are integer paise.

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  children: Category[];
}

export interface ListingProduct {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  price: number;
  mrp: number;
  discountPct: number;
  ratingAvg: number;
  ratingCount: number;
  isFeatured?: boolean;
  images: { url: string; alt: string | null }[];
  colors: { name: string; hex: string | null }[];
  sizes: string[];
  inStock: boolean;
}

export interface Facets {
  brands: string[];
  sizes: string[];
  colors: { name: string; hex: string | null }[];
  price: { min: number; max: number };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ProductListResponse extends Paginated<ListingProduct> {
  facets: Facets;
}

export interface Variant {
  id: string;
  sku: string;
  color: string | null;
  colorHex: string | null;
  size: string | null;
  price: number;
  mrp: number;
  stock: number;
  inStock: boolean;
}

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
  author: string;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  brand: string | null;
  material: string | null;
  specifications: Record<string, string> | null;
  sizeChart: Record<string, string>[] | null;
  videoUrl: string | null;
  price: number;
  mrp: number;
  discountPct: number;
  ratingAvg: number;
  ratingCount: number;
  images: { url: string; alt: string | null; color: string | null }[];
  variants: Variant[];
  breadcrumbs: { id: string; name: string; slug: string }[];
  returnPolicy: { isReturnable: boolean; returnWindowDays: number };
  /** Marketplace seller; null when sold by the store itself */
  seller: { storeName: string; slug: string } | null;
  reviews: Review[];
  ratingBreakdown: Record<string, number>;
  related: ListingProduct[];
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  ctaText: string | null;
  position: 'HERO' | 'OFFER';
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export type CartIssue = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';

export interface CartItem {
  id: string;
  quantity: number;
  issue?: CartIssue;
  lineTotal: number;
  product: { id: string; name: string; slug: string };
  /** Marketplace seller's store name; null when sold by the store itself */
  soldBy: string | null;
  variant: { id: string; sku: string; color: string | null; size: string | null; label: string; price: number; mrp: number; maxQuantity: number };
  image: string | null;
}

export interface CartSummary {
  itemCount: number;
  mrpTotal: number;
  subtotal: number;
  productDiscount: number;
  couponDiscount: number;
  shippingFee: number;
  codFee: number;
  total: number;
  freeShippingThreshold: number;
  codAvailable: boolean;
  /** False until Razorpay keys are configured — checkout shows "Coming soon" */
  onlinePaymentsAvailable: boolean;
  /** Items from different sellers arrive as separate orders / packages */
  packageCount: number;
}

export interface Cart {
  items: CartItem[];
  summary: CartSummary;
  coupon?: { code: string };
  couponError?: string;
  hasIssues: boolean;
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'PACKED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantLabel: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  mrp: number;
  quantity: number;
  total: number;
  returnedQuantity: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: 'COD' | 'ONLINE';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  subtotal: number;
  discount: number;
  shippingFee: number;
  codFee: number;
  total: number;
  couponCode: string | null;
  seller: { id: string; storeName: string; slug: string } | null;
  shippingAddress: Address;
  createdAt: string;
  deliveredAt: string | null;
  cancelReason: string | null;
  items: OrderItem[];
  history: { id: string; status: OrderStatus; note: string | null; createdAt: string }[];
  shipments: {
    id: string;
    carrier: string;
    awb: string | null;
    trackingUrl: string | null;
    status: string;
    events: { id: string; status: string; location: string | null; note: string | null; occurredAt: string }[];
  }[];
  returns: ReturnRequest[];
  refunds: { id: string; amount: number; status: string; mode: string; createdAt: string }[];
  canCancel: boolean;
  canReturn: boolean;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: Order['paymentStatus'];
  total: number;
  createdAt: string;
  items: { productName: string; imageUrl: string | null; quantity: number; variantLabel: string }[];
}

export interface ReturnRequest {
  id: string;
  returnNumber: string;
  status: string;
  reason: string;
  comment: string | null;
  adminNote: string | null;
  refundAmount: number;
  createdAt: string;
  items: { id: string; orderItemId: string; quantity: number; orderItem?: OrderItem }[];
  order?: { orderNumber: string };
}

export interface GatewayPayment {
  provider: 'RAZORPAY' | 'MOCK';
  providerOrderId: string;
  amount: number;
  currency: string;
  keyId?: string;
  orderNumber: string;
  prefill: { name: string; email: string; contact: string };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  data: { orderNumber?: string } | null;
}
