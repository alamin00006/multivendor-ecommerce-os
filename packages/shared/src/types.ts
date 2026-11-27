/**
 * Response view-models returned by the API (`data` field of ApiResponse).
 * Shared by the API (return types) and the web/mobile clients (RTK Query types).
 * Dates are ISO strings on the wire.
 */
import type { OwnCourier } from './schemas/own-delivery.js';
import type {
  AddressLabel,
  BannerPlacement,
  CampaignType,
  CouponScope,
  CouponType,
  Gender,
  LinkTargetType,
  Locale,
  NotificationType,
  OnlinePaymentMethod,
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  RefundStatus,
  ReturnStatus,
  Role,
  SellerStatus,
  ShippingZone,
} from './enums.js';

export type IsoDate = string;

// ───────── Auth & users ─────────

export interface SellerBadge {
  id: string;
  shopName: string;
  slug: string;
  status: SellerStatus;
  isHouseStore: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
  locale: Locale;
  sellerProfile: SellerBadge | null;
  /** YYYY-MM-DD */
  birthday: string | null;
  gender: Gender | null;
  /** Set once the address was confirmed (OTP / email link). */
  emailVerified: boolean;
  phoneVerified: boolean;
  /** Admin staff areas (`all` for the owner); empty for customers and sellers. */
  adminPermissions: string[];
  createdAt: IsoDate;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface OtpRequestResult {
  expiresIn: number;
  resendIn: number;
}

export interface PublicSettings {
  multiVendorEnabled: boolean;
  /** Brand colours set in Admin → Settings. */
  theme: { primary: string; accent: string };
  shipping: {
    /** Fees in poisha. */
    insideDhaka: number;
    outsideDhaka: number;
    insideDhakaEta: string;
    outsideDhakaEta: string;
  };
  returns: { days: number; policy: string };
  store: {
    address: string;
    phone: string;
    email: string;
    hours: string;
    social: Partial<Record<'facebook' | 'instagram' | 'youtube' | 'tiktok' | 'linkedin', string>>;
  };
}

// ───────── Geo & addresses ─────────

export interface GeoOption {
  id: number;
  name: string;
  nameBn: string;
}

export interface AreaOption extends GeoOption {
  districtId: number;
  isInsideDhaka: boolean;
}

export interface AddressView {
  id: string;
  label: AddressLabel;
  fullName: string;
  phone: string;
  division: GeoOption;
  district: GeoOption;
  area: AreaOption;
  addressLine: string;
  landmark: string | null;
  isDefault: boolean;
  shippingZone: ShippingZone;
}

// ───────── Catalog ─────────

export interface CategoryNode {
  id: string;
  parentId: string | null;
  name: string;
  nameBn: string;
  slug: string;
  iconUrl: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
  /** Only included for a single category (category page, admin). */
  seoContent?: string | null;
  children: CategoryNode[];
}

export interface CategoryRef {
  id: string;
  name: string;
  nameBn: string;
  slug: string;
}

export interface BrandView {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
}

export interface SellerSummary {
  id: string;
  shopName: string;
  slug: string;
  logoUrl: string | null;
  ratingAvg: number;
  isHouseStore: boolean;
}

export interface FlashPrice {
  flashSaleId: string;
  specialPrice: number;
  stockLimit: number;
  soldCount: number;
  endsAt: IsoDate;
}

export interface ProductCard {
  id: string;
  slug: string;
  title: string;
  titleBn: string | null;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  discountPercent: number;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  inStock: boolean;
  /** Null when multi-vendor mode is off. */
  seller: SellerSummary | null;
  flash: FlashPrice | null;
  /** Variant shown on the card — used by the card's "Add to cart" when the product has one variant. */
  defaultVariant: { id: string; sku: string; stock: number; attributes: Record<string, string> } | null;
  variantCount: number;
}

export interface VariantView {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  isActive: boolean;
  flash: FlashPrice | null;
}

export interface ProductImageView {
  id: string;
  url: string;
  alt: string | null;
  variantId: string | null;
}

export interface ProductDetail extends ProductCard {
  description: string;
  descriptionBn: string | null;
  status: ProductStatus;
  category: CategoryRef;
  breadcrumbs: CategoryRef[];
  brand: BrandView | null;
  images: ProductImageView[];
  variants: VariantView[];
  /** Variant option dimensions, e.g. { color: ['Black','Blue'], size: ['M','L'] }. */
  options: Record<string, string[]>;
  highlights: string[];
  specifications: Array<{ label: string; value: string }>;
  warranty: string | null;
  createdAt: IsoDate;
}

export interface ManagedProduct {
  id: string;
  slug: string;
  title: string;
  titleBn: string | null;
  description: string;
  descriptionBn: string | null;
  highlights: string[];
  specifications: Array<{ label: string; value: string }>;
  warranty: string | null;
  status: ProductStatus;
  categoryId: string;
  brandId: string | null;
  seller: SellerSummary;
  imageUrl: string | null;
  images: ProductImageView[];
  variants: VariantView[];
  minPrice: number;
  totalStock: number;
  soldCount: number;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface ProductFacets {
  brands: Array<{ slug: string; name: string; count: number }>;
  priceRange: { min: number; max: number };
  attributes: Record<string, string[]>;
}

export interface SearchSuggestion {
  products: Array<{ id: string; slug: string; title: string; imageUrl: string | null; price: number }>;
  categories: CategoryRef[];
  keywords: string[];
}

export interface ShopView extends SellerSummary {
  description: string | null;
  bannerUrl: string | null;
  productCount: number;
  /** Visible reviews across the shop's products. */
  reviewCount: number;
  createdAt: IsoDate;
}

// ───────── Cart & wishlist ─────────

export interface CartItemView {
  id: string;
  variantId: string;
  quantity: number;
  selected: boolean;
  available: boolean;
  unavailableReason: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  lineTotal: number;
  isFlashPrice: boolean;
  product: { id: string; slug: string; title: string; titleBn: string | null; imageUrl: string | null };
  variant: { sku: string; attributes: Record<string, string>; stock: number };
  seller: SellerSummary | null;
}

export interface CartView {
  items: CartItemView[];
  summary: {
    itemCount: number;
    selectedCount: number;
    unavailableCount: number;
    subtotal: number;
  };
}

export interface WishlistItemView {
  product: ProductCard;
  addedAt: IsoDate;
}

// ───────── Checkout & orders ─────────

export interface CheckoutGroup {
  seller: SellerSummary | null;
  items: CartItemView[];
  subtotal: number;
  shippingFee: number;
  /** Who delivers this package and when it should arrive. */
  delivery: { by: 'PLATFORM' | 'SHOP'; courier: string | null; eta: string | null };
}

export interface CheckoutPreview {
  groups: CheckoutGroup[];
  shippingZone: ShippingZone | null;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  coupon: { code: string; discount: number; appliesTo: 'items' | 'shipping' } | null;
  couponError: string | null;
  blockedItems: number;
  paymentMethods: Array<{ method: OnlinePaymentMethod; enabled: boolean; note?: string | null }>;
}

export interface OrderItemView {
  id: string;
  productId: string;
  productSlug: string;
  variantId: string;
  title: string;
  variantLabel: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  reviewed: boolean;
}

export interface StatusEvent {
  status: OrderStatus;
  note: string | null;
  createdAt: IsoDate;
}

export interface SubOrderView {
  id: string;
  seller: SellerSummary | null;
  status: OrderStatus;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  commissionRate: number;
  commissionAmount: number;
  trackingNumber: string | null;
  /** Latest courier booking for this package, if any. */
  shipment: ShipmentView | null;
  /** PLATFORM = MarketBD's couriers; SELLER = the shop's own courier. */
  fulfillment: 'PLATFORM' | 'SELLER';
  courierName: string | null;
  /** COD package delivered by the shop: the shop collects the cash. */
  sellerCollectsCash: boolean;
  dispute: DeliveryDisputeView | null;
  items: OrderItemView[];
  history: StatusEvent[];
}

export interface ShippingAddressSnapshot {
  fullName: string;
  phone: string;
  addressLine: string;
  landmark: string | null;
  area: string;
  district: string;
  division: string;
}

export interface ReturnView {
  id: string;
  subOrderId: string | null;
  reason: string;
  imageUrls: string[];
  status: ReturnStatus;
  adminNote: string | null;
  /** Note from the shop (approve / reject / received). */
  sellerNote: string | null;
  createdAt: IsoDate;
}

/** A customer's own return request, with the order it belongs to. */
export interface MyReturnView extends ReturnView {
  orderId: string;
  orderNumber: string;
  orderTotal: number;
  /** Shop of the returned package (the brand name in single-vendor mode). */
  shopName: string | null;
  items: { title: string; imageUrl: string | null; quantity: number }[];
  updatedAt: IsoDate;
}

/** A delivered order the customer can still send back, with its returnable packages. */
export interface ReturnableOrder {
  orderId: string;
  orderNumber: string;
  deliveredAt: IsoDate | null;
  /** Last day of the return window. */
  returnBy: IsoDate | null;
  packages: {
    subOrderId: string;
    shopName: string | null;
    items: { title: string; imageUrl: string | null; variantLabel: string; quantity: number; lineTotal: number }[];
  }[];
}

export interface PaymentView {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  gatewayTrxId: string | null;
  paidAt: IsoDate | null;
  refunds: Array<{ id: string; amount: number; reason: string; status: RefundStatus; createdAt: IsoDate }>;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** ONLINE checkout or a POS counter sale. */
  channel: OrderChannel;
  total: number;
  itemCount: number;
  previewImages: string[];
  /** Shops in the order (one per package). Hide them in single-vendor mode. */
  shopNames: string[];
  customer?: { id: string; name: string; phone: string | null };
  createdAt: IsoDate;
}

export interface OrderDetail extends OrderSummary {
  shippingZone: ShippingZone;
  shippingAddress: ShippingAddressSnapshot;
  subtotal: number;
  shippingFee: number;
  discount: number;
  couponCode: string | null;
  note: string | null;
  subOrders: SubOrderView[];
  history: StatusEvent[];
  payments: PaymentView[];
  returns: ReturnView[];
  canCancel: boolean;
  canReturn: boolean;
  canPay: boolean;
}

export interface SellerOrderView {
  id: string;
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  shippingFee: number;
  total: number;
  commissionAmount: number;
  trackingNumber: string | null;
  /** Latest courier booking for this package, if any. */
  shipment: ShipmentView | null;
  /** PLATFORM = MarketBD's couriers; SELLER = the shop's own courier. */
  fulfillment: 'PLATFORM' | 'SELLER';
  courierName: string | null;
  /** COD package delivered by the shop: the shop collects the cash. */
  sellerCollectsCash: boolean;
  dispute: DeliveryDisputeView | null;
  shippingAddress: ShippingAddressSnapshot;
  items: OrderItemView[];
  history: StatusEvent[];
  createdAt: IsoDate;
}

export interface PlaceOrderResult {
  order: OrderSummary;
  payment: PaymentInitResult | null;
}

export interface PaymentInitResult {
  paymentId: string;
  method: PaymentMethod;
  /** Gateway page to redirect the customer to; null for COD. */
  redirectUrl: string | null;
}

// ───────── Reviews ─────────

export interface ReviewView {
  id: string;
  rating: number;
  comment: string | null;
  images: string[];
  isVerifiedPurchase: boolean;
  isVisible: boolean;
  /** Public reply from the shop. */
  sellerReply: string | null;
  sellerRepliedAt: IsoDate | null;
  user: { name: string; avatarUrl: string | null };
  product?: { id: string; slug: string; title: string };
  createdAt: IsoDate;
}

export interface ReviewSummary {
  average: number;
  count: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

// ───────── Merchandising ─────────

export interface CampaignView {
  id: string;
  slug: string;
  title: string;
  titleBn: string | null;
  description: string | null;
  bannerUrl: string;
  mobileBannerUrl: string | null;
  themeColor: string | null;
  type: CampaignType;
  startAt: IsoDate;
  endAt: IsoDate;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  terms: string[];
  voucherCodes: string[];
}

export interface FlashSaleItemView {
  id: string;
  variantId: string;
  specialPrice: number;
  stockLimit: number;
  soldCount: number;
  sortOrder: number;
  product: ProductCard;
  variantLabel: string;
  regularPrice: number;
}

export interface FlashSaleView {
  id: string;
  title: string;
  titleBn: string | null;
  startAt: IsoDate;
  endAt: IsoDate;
  isActive: boolean;
  items: FlashSaleItemView[];
}

export interface BannerView {
  id: string;
  title: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  placement: BannerPlacement;
  linkType: LinkTargetType;
  linkValue: string;
  sortOrder: number;
  isActive: boolean;
  startAt: IsoDate | null;
  endAt: IsoDate | null;
}

export interface QuickLinkView {
  id: string;
  label: string;
  labelBn: string;
  iconUrl: string;
  linkType: LinkTargetType;
  linkValue: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CouponView {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number;
  usedCount: number;
  startsAt: IsoDate;
  endsAt: IsoDate;
  isActive: boolean;
  scope: CouponScope;
  /** STORE vouchers: the shop whose items it applies to. */
  seller: { id: string; shopName: string; slug: string; logoUrl: string | null } | null;
  /** PAYMENT vouchers: the method that unlocks it. */
  paymentMethod: PaymentMethod | null;
  /** Whether the signed-in viewer saved it ("Collect"); false for guests. */
  collected: boolean;
}

/** A voucher in the customer's wallet. */
export interface MyVoucherView extends CouponView {
  collectedAt: IsoDate;
  /** AVAILABLE = can still be used; USED = per-user limit reached; EXPIRED = ended or switched off. */
  status: 'AVAILABLE' | 'USED' | 'EXPIRED';
}

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string> | null;
  readAt: IsoDate | null;
  createdAt: IsoDate;
}

export interface UploadResult {
  key: string;
  url: string;
}

// ───────── Seller & admin ─────────

export interface SellerProfileView extends ShopView {
  status: SellerStatus;
  phone: string | null;
  pickupAddress: string | null;
  commissionRate: number;
  approvedAt: IsoDate | null;
  owner: { id: string; name: string; email: string | null; phone: string | null };
}

export interface SellerDashboard {
  salesTotal: number;
  ordersCount: number;
  pendingOrders: number;
  productsCount: number;
  lowStock: Array<{ productId: string; title: string; sku: string; variantId: string; stock: number }>;
  recentOrders: SellerOrderView[];
}

export interface AdminDashboard {
  revenue: number;
  ordersCount: number;
  customersCount: number;
  sellersCount: number;
  pendingSellers: number;
  productsCount: number;
  commissionEarned: number;
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  salesLast30Days: Array<{ date: string; total: number; orders: number }>;
  recentOrders: OrderSummary[];
}

export interface AdminUserView {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  isActive: boolean;
  ordersCount: number;
  createdAt: IsoDate;
}

export interface StaffView {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  /** Areas this admin can open; `['all']` for full access. */
  permissions: string[];
  lastActivityAt: IsoDate | null;
  createdAt: IsoDate;
}

export interface ActivityView {
  id: string;
  actor: { id: string; name: string } | null;
  method: string;
  /** API path below the version prefix, e.g. `/admin/orders/abc/status`. */
  path: string;
  /** Permission area of the route (`owner` for staff/log routes). */
  area: string;
  /** Human summary from the route, e.g. "Category updated". */
  summary: string | null;
  /** Request body with secrets removed. */
  details: unknown;
  ip: string | null;
  createdAt: IsoDate;
}

// ───────── Product Q&A ─────────

export interface QuestionView {
  id: string;
  question: string;
  answer: string | null;
  askedBy: { name: string };
  /** Who answered — the seller's shop name, or the store name when staff answered. */
  answeredBy: { name: string; role: 'seller' | 'store' } | null;
  answeredAt: IsoDate | null;
  isVisible: boolean;
  product?: { id: string; slug: string; title: string; imageUrl: string | null };
  createdAt: IsoDate;
}

// ───────── Customer ↔ seller chat ─────────

export type ChatSide = 'customer' | 'seller';

export interface ChatProductRef {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  price: number;
}

export interface ChatMessageView {
  id: string;
  side: ChatSide;
  body: string;
  product: ChatProductRef | null;
  createdAt: IsoDate;
}

export interface ConversationView {
  id: string;
  /** The shop; in single-vendor mode this is the store itself, shown under the brand name. */
  shop: { id: string; name: string; slug: string; logoUrl: string | null; isHouseStore: boolean };
  customer: { id: string; name: string; avatarUrl: string | null };
  lastMessage: { body: string; side: ChatSide; createdAt: IsoDate } | null;
  /** Unread messages for the viewer's side. */
  unread: number;
  /** When the other side last read the thread — messages sent before this are "seen". */
  otherLastReadAt: IsoDate | null;
  /** Which side the viewer is on. */
  viewerSide: ChatSide;
  createdAt: IsoDate;
}

export interface ChatThread {
  conversation: ConversationView;
  /** Oldest first. */
  messages: ChatMessageView[];
  hasMore: boolean;
}

/** A delivered purchase the customer has not reviewed yet. */
export interface ReviewableItem {
  productId: string;
  productSlug: string;
  title: string;
  imageUrl: string | null;
  variantLabel: string;
  orderId: string;
  orderNumber: string;
  deliveredAt: IsoDate | null;
}

// ───────── Point of sale ─────────

export interface PosVariant {
  id: string;
  sku: string;
  label: string;
  /** Regular selling price in poisha (counter sales ignore flash deals). */
  price: number;
  stock: number;
}

export interface PosProduct {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  brand: string | null;
  variants: PosVariant[];
}

export interface PosSaleResult {
  order: OrderDetail;
  cashReceived: number;
  change: number;
  /** Registered customer the sale was linked to (null = walk-in). */
  customer: { id: string; name: string; phone: string | null } | null;
  cashier: string;
  /** Receipt header: the shop that made the sale. */
  shop: { name: string; phone: string | null; address: string | null };
}

// ───────── Seller business: earnings, payouts, returns, reviews, reports ─────────

export interface PayoutAccountView {
  method: 'BKASH' | 'NAGAD' | 'BANK';
  accountName: string;
  accountNumber: string;
  bankName?: string;
  branch?: string;
}

export interface SellerEarnings {
  /** Delivered sales (incl. delivery fee, after discounts), all time. */
  gross: number;
  commission: number;
  /** What the shop earned: online sales minus commission; counter sales only owe the commission. */
  net: number;
  /** Delivered inside the return window, or with an open return. */
  onHold: number;
  /** Cleared earnings not yet requested or paid out. */
  available: number;
  /** Payout requests waiting for admin. */
  requested: number;
  paidOut: number;
  /** Payments the shop made to the platform and other manual corrections. */
  adjustments: number;
  /** Cleared earnings + adjustments − payouts; negative = the shop owes commission. */
  balance: number;
  holdDays: number;
  minPayout: number;
  payoutAccount: PayoutAccountView | null;
}

export interface EarningRow {
  subOrderId: string;
  orderId: string;
  orderNumber: string;
  channel: OrderChannel;
  deliveredAt: IsoDate | null;
  total: number;
  commissionRate: number;
  commissionAmount: number;
  net: number;
  state: 'ON_HOLD' | 'AVAILABLE';
  /** When an on-hold amount becomes available (null while a return is open). */
  availableOn: IsoDate | null;
}

export interface PayoutView {
  id: string;
  amount: number;
  status: 'REQUESTED' | 'PAID' | 'REJECTED';
  method: 'BKASH' | 'NAGAD' | 'BANK';
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  branch: string | null;
  sellerNote: string | null;
  adminNote: string | null;
  reference: string | null;
  processedAt: IsoDate | null;
  createdAt: IsoDate;
  /** Admin list only. */
  seller?: { id: string; shopName: string; slug: string; available: number };
}

export interface SellerReturnView {
  id: string;
  orderId: string;
  orderNumber: string;
  subOrderId: string | null;
  /** False for whole-order returns (admin handles those). */
  canAct: boolean;
  reason: string;
  imageUrls: string[];
  status: ReturnStatus;
  adminNote: string | null;
  sellerNote: string | null;
  customer: { name: string; phone: string | null };
  items: Array<{ title: string; variantLabel: string; imageUrl: string | null; quantity: number; lineTotal: number }>;
  amount: number;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface SellerReviewView extends ReviewView {
  product: { id: string; slug: string; title: string };
  imageUrl: string | null;
}

export interface SellerReviewStats {
  average: number;
  count: number;
  unreplied: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface SellerReport {
  from: string;
  to: string;
  totals: { orders: number; units: number; gross: number; commission: number; net: number; avgOrder: number; cancelled: number; returned: number };
  daily: Array<{ date: string; orders: number; gross: number; net: number }>;
  topProducts: Array<{ productId: string; title: string; imageUrl: string | null; units: number; gross: number }>;
  byStatus: Array<{ status: OrderStatus; count: number }>;
  byChannel: Array<{ channel: OrderChannel; orders: number; gross: number }>;
}

/** Marketplace-wide sales report. In `daily`, `net` is the platform commission. */
export interface AdminReport extends SellerReport {
  totals: SellerReport['totals'] & { customers: number; newCustomers: number; shipping: number; discount: number };
  bySeller: Array<{ sellerId: string; shopName: string; orders: number; gross: number; commission: number }>;
  byCategory: Array<{ categoryId: string; name: string; units: number; gross: number }>;
  byPayment: Array<{ method: PaymentMethod; orders: number; gross: number }>;
}

export interface BulkStockResult {
  updated: number;
  errors: Array<{ row: number; sku: string; message: string }>;
}

// ───── Courier / shipping ─────

export type CourierProvider = 'PATHAO' | 'STEADFAST';

export interface CourierLocation {
  id: number;
  name: string;
}

export interface CourierStoreView {
  provider: CourierProvider;
  name: string;
  contactName: string;
  contactNumber: string;
  address: string;
  cityId: number;
  zoneId: number;
  areaId: number;
  /** False while the courier is still approving the new pickup store. */
  ready: boolean;
}

/** A courier a seller (or the admin, for the house store) can book with. */
export interface CourierOption {
  provider: CourierProvider;
  name: string;
  supportsStores: boolean;
  needsWeight: boolean;
  note: string | null;
  /** Pickup store of this shop; always null for couriers without stores. */
  store: CourierStoreView | null;
  /** Can book right now (store approved, or the courier needs no store). */
  ready: boolean;
}

/** Admin view of one courier account. Secret credentials are never returned, only whether they are set. */
export interface CourierAccountView {
  provider: CourierProvider;
  name: string;
  enabled: boolean;
  sandbox: boolean;
  hasSandbox: boolean;
  supportsStores: boolean;
  /** Non-secret values as saved; secret keys map to null. */
  credentials: Record<string, string | null>;
  /** Credential keys that have a saved value. */
  configured: string[];
  webhookUrl: string;
  webhookSecret: string;
  updatedAt: IsoDate | null;
}

/** A shop's own courier account: same as the platform's, plus the shop's pickup store id. */
export interface SellerCourierAccountView extends CourierAccountView {
  storeExternalId: string | null;
}

export interface ShipmentView {
  id: string;
  provider: CourierProvider;
  consignmentId: string;
  /** Customer-facing tracking code (Steadfast) or the consignment id. */
  trackingCode: string;
  merchantOrderId: string;
  /** Raw courier status, e.g. "order.picked" or "delivered". */
  courierStatus: string;
  /** False after the courier cancelled the booking; the package can be booked again. */
  active: boolean;
  codAmount: number;
  deliveryFee: number | null;
  collectedAmount: number | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

// ───────── Own delivery (shop's own courier) ─────────

export interface DeliveryDisputeView {
  note: string;
  createdAt: IsoDate;
  resolution: 'DELIVERED' | 'NOT_DELIVERED' | null;
  resolvedAt: IsoDate | null;
}

export interface OwnDeliverySettingsView {
  courier: OwnCourier;
  courierName: string | null;
  insideDhakaFee: number;
  outsideDhakaFee: number;
  insideDhakaEta: string;
  outsideDhakaEta: string;
}

export interface OwnDeliveryView {
  /** null = MarketBD Delivery. */
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  settings: OwnDeliverySettingsView | null;
  /** Admin's note on the last decision. */
  note: string | null;
  updatedAt: IsoDate | null;
  /** Balance can go below zero when the shop collected COD cash and owes commission. */
  balance: number;
  dueLimit: number;
  /** COD is paused for this shop's own deliveries until dues are paid. */
  codPaused: boolean;
}

export interface OwnDeliveryShopView extends OwnDeliveryView {
  seller: { id: string; shopName: string; slug: string; phone: string | null };
  stats: {
    shipped: number;
    delivered: number;
    returned: number;
    /** Average days from shipped to delivered (null with no deliveries yet). */
    avgDeliveryDays: number | null;
    openDisputes: number;
    disputes: number;
  };
}

export interface SellerAdjustmentView {
  id: string;
  amount: number;
  note: string;
  reference: string | null;
  createdAt: IsoDate;
}

export interface OpenDisputeView {
  orderId: string;
  orderNumber: string;
  subOrderId: string;
  shopName: string;
  courierName: string | null;
  trackingNumber: string | null;
  total: number;
  customer: { name: string; phone: string | null };
  note: string;
  createdAt: IsoDate;
}
