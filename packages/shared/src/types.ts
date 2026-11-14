/**
 * Response view-models returned by the API (`data` field of ApiResponse).
 * Shared by the API (return types) and the web/mobile clients (RTK Query types).
 * Dates are ISO strings on the wire.
 */
import type {
  AddressLabel,
  BannerPlacement,
  CampaignType,
  CouponType,
  LinkTargetType,
  Locale,
  NotificationType,
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
}

export interface CheckoutPreview {
  groups: CheckoutGroup[];
  shippingZone: ShippingZone | null;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  coupon: { code: string; discount: number } | null;
  couponError: string | null;
  blockedItems: number;
  paymentMethods: Array<{ method: PaymentMethod; enabled: boolean }>;
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
  createdAt: IsoDate;
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
  total: number;
  itemCount: number;
  previewImages: string[];
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
