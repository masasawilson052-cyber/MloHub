import { UserRole } from '../db/types';

// ============================================================================
// 1. RESTAURANT & MULTI-BRANCH DOMAIN MODELS
// ============================================================================

export type SellerTier = 'BASIC_SELLER' | 'VERIFIED_SELLER';
export type VerificationStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export interface Restaurant {
  id: string;
  ownerId?: string;
  name: string;
  slug: string;
  cuisine: string;
  description?: string;
  sellerTier: SellerTier;
  rating: number;
  reviewsCount: number;
  minPriceTzs: number;
  maxPriceTzs: number;
  address: string;
  neighborhood: string;
  regionCity: string;
  distanceKm: number;
  estimatedPrepTimeMinutes: number;
  isOpen: boolean;
  isVerified: boolean;
  isPublished?: boolean;
  isActive?: boolean;
  verificationStatus: VerificationStatus;
  tinNumber?: string;
  businessLicenseNumber?: string;
  payoutPhoneNumber?: string;
  payoutProvider?: string;
  openingHours?: string;
  closingHours?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  foodSpotPhotos?: string[];
  specialty?: string;
  specialistBadge?: string;
  specialistCategory?: string;
  emoji?: string;
  tags?: string[];
  lat?: number;
  lng?: number;
  supportsOrderAhead: boolean;
  bgGradient?: string[];
  specialistBadgeSw?: string;
  price?: string;
  distance?: string;
  time?: string;
  reviews?: number;
  menu?: MenuItem[];
  branches?: RestaurantBranch[];
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantBranch {
  id: string;
  restaurantId: string;
  name: string;
  address: string;
  region: string;
  district?: string;
  ward?: string;
  latitude?: number;
  longitude?: number;
  phone: string;
  openingHours?: Record<string, any>;
  isActive: boolean;
  operationalMode?: BranchOperationalMode;
  pauseReason?: string;
  pausedUntil?: string;
  busyDelayMinutes?: number;
  basePrepMinutes?: number;
  minPrepMinutes?: number;
  maxPrepMinutes?: number;
  capacityControlMode?: CapacityControlMode;
  maxOrdersPerInterval?: number;
  maxItemsPerInterval?: number;
  capacityIntervalMinutes?: number;
  pickupEnabled?: boolean;
  dineInEnabled?: boolean;
  deliveryEnabled?: boolean;
  reservationsEnabled?: boolean;
  customMealsEnabled?: boolean;
  minOrderAmountTzs?: number;
  baseDeliveryFeeTzs?: number;
  estimatedDeliveryMinutes?: number;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

export type PlatformRole = 'CUSTOMER' | 'RESTAURANT' | 'ADMIN' | 'SUPER_ADMIN';
export type RestaurantRole = 'OWNER' | 'MANAGER' | 'CHEF' | 'STAFF';

export type RestaurantPermission =
  | 'VIEW_DASHBOARD'
  | 'VIEW_ORDERS'
  | 'MANAGE_ORDERS'
  | 'VIEW_MENU'
  | 'MANAGE_MENU'
  | 'VERIFY_MENU'
  | 'VIEW_RESERVATIONS'
  | 'MANAGE_RESERVATIONS'
  | 'VIEW_REVIEWS'
  | 'VIEW_ANALYTICS'
  | 'VIEW_EARNINGS'
  | 'MANAGE_STAFF'
  | 'MANAGE_RESTAURANT';

export interface RestaurantMember {
  id: string;
  userId: string;
  restaurantId: string;
  role: RestaurantRole;
  permissions: RestaurantPermission[] | string[];
  isPrimaryOwner: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantApplication {
  id: string;
  applicantUserId?: string;
  businessName: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  cuisineType: string;
  neighborhood: string;
  address: string;
  businessType?: string;
  hasTinOrLicense: boolean;
  tinNumber?: string;
  licenseNumber?: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  /** Populated after approval — the ID of the restaurant record created by the server RPC. */
  restaurantId?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 2. MENU & FRESHNESS DOMAIN MODELS
// ============================================================================

export interface MenuCategory {
  id: string;
  restaurantId: string;
  nameEn: string;
  nameSw: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId?: string;
  name: string;
  nameEn?: string;
  nameSw?: string;
  description?: string;
  descriptionEn?: string;
  descriptionSw?: string;
  basePrice: number;
  priceTzs: number;
  currency: string;
  photoUrl?: string;
  imageUrl?: string;
  stockQuantity?: number;
  isAvailable: boolean;
  isArchived?: boolean;
  preparationMinutes?: number;
  dietaryTags?: string[];
  spiceLevel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BranchMenuItem {
  id: string;
  branchId: string;
  menuItemId: string;
  price: number;
  isAvailable: boolean;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  operationalStatus?: ItemStockStatus;
  unavailableUntil?: string;
  unavailableReason?: string;
  prepTimeMinutes?: number;
  daypartStart?: string;
  daypartEnd?: string;
  lastPriceVerifiedAt?: string;
  lastAvailabilityVerifiedAt?: string;
  updatedAt: string;
}

export type VerificationType = 'MENU' | 'PRICE' | 'AVAILABILITY' | 'HOURS';
export type VerificationSource = 'RESTAURANT' | 'ADMIN' | 'CUSTOMER_REPORT' | 'SYSTEM';

export interface MenuVerification {
  id: string;
  restaurantId: string;
  branchId?: string;
  menuItemId?: string;
  verificationType: VerificationType;
  verifiedBy: string;
  verificationSource: VerificationSource;
  previousValue?: Record<string, any>;
  verifiedValue?: Record<string, any>;
  createdAt: string;
}

// ============================================================================
// 3. ORDERS & COMMERCE DOMAIN MODELS
// ============================================================================

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  restaurantId: string;
  restaurantName?: string;
  branchId?: string;
  deliveryZoneId?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotalTzs: number;
  serviceFeeTzs: number;
  deliveryFeeTzs: number;
  totalTzs: number;
  currency: string;
  fulfillmentType: 'Delivery' | 'Dine-In' | 'Takeaway';
  deliveryAddress?: string;
  specialInstructions?: string;
  estimatedPrepMinutes?: number;
  acceptedAt?: string;
  readyAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  items?: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export type OrderEntity = Order;

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId?: string;
  itemNameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
  subtotal: number;
  specialNotes?: string;
  createdAt: string;
}

export type ReservationStatus =
  | 'PENDING'
  | 'PENDING_RESTAURANT_APPROVAL'
  | 'AWAITING_DEPOSIT'
  | 'CONFIRMED'
  | 'SEATED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'NO_SHOW'
  | 'EXPIRED'
  | 'PAYMENT_REVIEW_REQUIRED';

export type CapacityMode = 'CAPACITY_ONLY' | 'TABLE_BASED';
export type ConfirmationMode = 'AUTO' | 'MANUAL';
export type DepositPolicy = 'NONE' | 'FIXED' | 'PERCENTAGE';
export type AreaPreference = 'INDOOR' | 'OUTDOOR' | 'QUIET' | 'WINDOW' | 'ANY';
export type RefundEligibility = 'NONE' | 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'MANUAL_REVIEW';
export type ReservationRejectionReason =
  | 'FULL'
  | 'PRIVATE_EVENT'
  | 'CLOSING_EARLY'
  | 'PARTY_SIZE_UNSUPPORTED'
  | 'TIME_UNAVAILABLE'
  | 'SPECIAL_REQUIREMENT_UNSUPPORTED'
  | 'RESTAURANT_UNABLE_TO_ACCOMMODATE'
  | 'OTHER';

export interface ReservationSettings {
  id: string;
  restaurantId: string;
  branchId: string;
  reservationsEnabled: boolean;
  capacityMode: CapacityMode;
  confirmationMode: ConfirmationMode;
  slotDurationMinutes: number;
  minimumAdvanceMinutes: number;
  maximumAdvanceDays: number;
  minimumPartySize: number;
  maximumPartySize: number;
  defaultSlotCapacity: number;
  gracePeriodMinutes: number;
  turnTimeMinutes: number;
  depositPolicy: DepositPolicy;
  depositFixedTzs: number;
  depositPercentage: number;
  depositDueMinutes: number;
  allowSameDay: boolean;
  acceptsWalkIns: boolean;
  autoExpirePendingMinutes: number;
  freeCancellationBeforeMinutes: number;
  lateCancellationBehavior: string;
  noShowBehavior: string;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantTable {
  id: string;
  restaurantId: string;
  branchId: string;
  label: string;
  capacity: number;
  area: AreaPreference;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationSlot {
  slotStart: string;
  slotEnd: string;
  availableCapacity: number;
  isAvailable: boolean;
  depositRequired: boolean;
  depositAmountTzs: number;
  confirmationMode: ConfirmationMode;
  availabilityStatus: string;
}

export interface Reservation {
  id: string;
  customerId: string;
  restaurantId: string;
  restaurantName?: string;
  branchId?: string;
  branchName?: string;
  partySize: number;
  scheduledAt?: string;
  slotEndAt?: string;
  reservationDate: string;
  reservationTime: string;
  reference?: string;
  tableId?: string;
  tableName?: string;
  status: ReservationStatus;
  customerNote?: string;
  restaurantNote?: string;
  rejectionReason?: string;
  confirmationMode?: ConfirmationMode;
  depositPolicy?: DepositPolicy;
  depositOption?: 'deposit_50' | 'full_100';
  depositAmountTzs?: number;
  totalBillTzs?: number;
  remainingBalanceTzs?: number;
  isDepositPaid?: boolean;
  depositDueAt?: string;
  noShowEligibleAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  paymentId?: string;
  areaPreference?: AreaPreference;
  refundEligibility?: RefundEligibility;
  createdAt: string;
  updatedAt: string;
}

export type CustomMealOccasion = 'PERSONAL' | 'FAMILY' | 'OFFICE' | 'EVENT' | 'PARTY' | 'OTHER';
export type BudgetType = 'FIXED' | 'RANGE' | 'OPEN_TO_QUOTES';
export type SpiceLevel = 'NONE' | 'MILD' | 'MEDIUM' | 'HOT' | 'EXTRA_HOT';
export type CustomMealFulfillmentMode = 'PICKUP' | 'DINE_IN' | 'RESTAURANT_DELIVERY';
export type CustomMealRequestStatus =
  | 'PENDING'
  | 'QUOTES_RECEIVED'
  | 'QUOTE_ACCEPTED'
  | 'ORDER_CREATED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export type RestaurantQuoteStatus =
  | 'SUBMITTED'
  | 'OFFERED'
  | 'REVISED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'EXPIRED'
  | 'SUPERSEDED';

export type InvitationStatus = 'INVITED' | 'VIEWED' | 'DECLINED' | 'QUOTED' | 'EXPIRED';
export type DeclineReason =
  | 'TOO_BUSY'
  | 'UNABLE_TO_MEET_TIME'
  | 'OUTSIDE_SERVICE_AREA'
  | 'INGREDIENT_UNAVAILABLE'
  | 'DIETARY_REQUIREMENT_UNSUPPORTED'
  | 'PRICE_EXPECTATION'
  | 'OTHER';

export interface RestaurantQuoteItem {
  id: string;
  quoteId: string;
  name: string;
  description?: string;
  quantity: number;
  unitPriceTzs: number;
  lineTotalTzs: number;
  sortOrder?: number;
}

export interface RestaurantQuoteVersion {
  id: string;
  quoteId: string;
  revisionNumber: number;
  subtotalTzs: number;
  deliveryFeeTzs: number;
  totalTzs: number;
  estimatedPrepMinutes: number;
  promisedReadyAt: string;
  restaurantNote?: string;
  itemsSnapshot: any[];
  createdAt: string;
}

export interface CustomMealInvitation {
  id: string;
  requestId: string;
  restaurantId: string;
  restaurantName?: string;
  branchId?: string;
  status: InvitationStatus;
  matchScore?: number;
  matchReasons: string[];
  invitedAt: string;
  viewedAt?: string;
  declinedAt?: string;
  declineReason?: DeclineReason;
  declineNotes?: string;
  quoteDeadline: string;
}

export interface CustomMealMessage {
  id: string;
  requestId: string;
  quoteId?: string;
  restaurantId: string;
  senderUserId: string;
  senderRole: 'CUSTOMER' | 'RESTAURANT' | 'SYSTEM';
  messageType: 'TEXT' | 'CLARIFICATION' | 'QUOTE_REVISION_REQUEST' | 'SYSTEM';
  body: string;
  createdAt: string;
  editedAt?: string;
}

export interface RestaurantCustomMealSettings {
  restaurantId: string;
  acceptsCustomMeals: boolean;
  minimumNoticeMinutes: number;
  minimumOrderTzs: number;
  maximumServings: number;
  maximumActiveRequests: number;
  supportedFulfillmentModes: CustomMealFulfillmentMode[];
  supportedCuisines: string[];
  dietaryCapabilities: string[];
  allergyHandlingCapabilities: string[];
  serviceRadiusKm: number;
  serviceAreas: string[];
  pausedUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomMealRequest {
  id: string;
  orderNumber: string;
  customerId: string;
  title: string;
  dishName: string;
  description?: string;
  specialInstructions?: string;
  occasion?: CustomMealOccasion;
  cuisineType?: string;
  budgetType?: BudgetType;
  budgetMin?: number;
  budgetMax?: number;
  budgetMinTzs?: number;
  budgetMaxTzs?: number;
  budgetTzs: number;
  servings: string;
  servingsCount: string;
  spiceLevel?: SpiceLevel;
  ingredientsRequested?: string[];
  ingredientsToAvoid?: string[];
  dietaryTags?: string[];
  allergens?: string[];
  desiredAt?: string;
  quoteDeadline?: string;
  expiresAt?: string;
  fulfillmentMode?: CustomMealFulfillmentMode;
  diningOption?: 'Delivery' | 'Dine-In' | 'Takeaway';
  customerArea?: string;
  landmark?: string;
  exactDeliveryAddress?: string;
  exactDeliveryPhone?: string;
  desiredDate?: string;
  preferredTime?: string;
  location?: string;
  deliveryLocation?: string;
  referenceImages?: string[];
  status: CustomMealRequestStatus | OrderStatus;
  statusMessageEn?: string;
  statusMessageSw?: string;
  acceptedQuoteId?: string;
  lockedQuoteSnapshot?: any;
  convertedOrderId?: string;
  quotes?: RestaurantQuote[];
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantQuote {
  id: string;
  requestId: string;
  restaurantId: string;
  restaurantName?: string;
  branchId?: string;
  submittedByUserId?: string;
  subtotalTzs?: number;
  deliveryFeeTzs?: number;
  otherAuthorizedFeeTzs?: number;
  totalTzs?: number;
  amountTzs: number;
  quotedPriceTzs: number;
  estimatedPrepMinutes: number;
  promisedReadyAt?: string;
  fulfillmentMode?: CustomMealFulfillmentMode;
  message?: string;
  chefNotes?: string;
  restaurantNote?: string;
  substitutionNotes?: string;
  dietaryAcknowledged?: boolean;
  allergyAcknowledged?: boolean;
  validUntil?: string;
  revisionNumber?: number;
  items?: RestaurantQuoteItem[];
  status: RestaurantQuoteStatus | 'OFFERED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
}

// ============================================================================
// 4. PAYMENTS, REVIEWS & NOTIFICATIONS DOMAIN MODELS
// ============================================================================

export interface Payment {
  id: string;
  orderId?: string;
  reservationId?: string;
  customerId: string;
  restaurantId?: string;
  provider: string;
  externalReference?: string;
  providerTransactionId?: string;
  amountTzs: number;
  platformCommissionTzs: number;
  netRestaurantPayoutTzs: number;
  currency: string;
  paymentMethod: string;
  phoneNumber: string;
  status: PaymentStatus;
  idempotencyKey?: string;
  webhookVerified: boolean;
  paidAt?: string;
  refundedAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  category: 'ORDER' | 'PAYMENT' | 'SYSTEM' | 'RESTAURANT' | 'QUOTE';
  titleEn: string;
  titleSw: string;
  messageEn: string;
  messageSw: string;
  isRead: boolean;
  orderId?: string;
  restaurantId?: string;
  actionType?: string;
  payload?: Record<string, any>;
  eventId?: string;
  communicationClass?: CommunicationClass;
  priority?: NotificationPriority;
  locale?: string;
  dedupeKey?: string;
  readAt?: string;
  archivedAt?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  customerId: string;
  restaurantId: string;
  orderId?: string;
  customMealRequestId?: string;
  reservationId?: string;
  branchId?: string;
  sourceType?: ReviewSourceType;
  verifiedExperience?: boolean;
  overallRating: number;
  rating?: number;
  customerName?: string;
  respondedAt?: string;
  title?: string;
  comment?: string;
  languageCode?: string;
  visibilityStatus?: ReviewVisibilityStatus;
  moderationStatus?: ReviewModerationStatus;
  helpfulCount?: number;
  notHelpfulCount?: number;
  submittedAt?: string;
  publishedAt?: string;
  editedAt?: string;
  deletedAt?: string;
  status?: 'PUBLISHED' | 'FLAGGED' | 'HIDDEN' | 'REMOVED_POLICY' | 'DELETED_BY_AUTHOR';
  aspects?: ReviewAspectRating[];
  itemRatings?: ReviewItemRating[];
  tags?: ReviewTagCode[];
  response?: ReviewResponse;
  media?: ReviewMedia[];
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  adminName?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export type DataReportType =
  | 'WRONG_PRICE'
  | 'ITEM_UNAVAILABLE'
  | 'WRONG_HOURS'
  | 'WRONG_LOCATION'
  | 'RESTAURANT_CLOSED'
  | 'OTHER';

export type DataReportStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED';

export interface DataReport {
  id: string;
  reporterUserId: string;
  reporterName?: string;
  restaurantId: string;
  restaurantName?: string;
  branchId?: string;
  menuItemId?: string;
  menuItemName?: string;
  reportType: DataReportType;
  message: string;
  reportedValue?: string;
  catalogValue?: string;
  status: DataReportStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
}

// ============================================================================
// 10. PACK 4C — FINANCIAL AUTHORITY, LEDGER, REFUNDS, DISPUTES, SETTLEMENTS & RECONCILIATION
// ============================================================================

export type FinancialEntryType =
  | 'PAYMENT_COLLECTION'
  | 'PLATFORM_COMMISSION'
  | 'RESTAURANT_PAYABLE_CREDIT'
  | 'RESERVATION_DEPOSIT_HELD'
  | 'RESERVATION_DEPOSIT_REVENUE'
  | 'REFUND_REVERSAL'
  | 'DISPUTE_HOLD'
  | 'DISPUTE_RELEASE'
  | 'SETTLEMENT_PAYOUT'
  | 'FINANCIAL_ADJUSTMENT';

export type FinancialAccountType =
  | 'CUSTOMER_PAYMENT_CLEARING'
  | 'RESTAURANT_PAYABLE'
  | 'PLATFORM_REVENUE'
  | 'RESERVATION_DEPOSIT_HOLDING'
  | 'REFUND_PAYABLE'
  | 'PROVIDER_RECEIVABLE'
  | 'PAYOUT_CLEARING'
  | 'DISPUTE_RESERVE'
  | 'ADJUSTMENT';

export type FinancialDirection = 'DEBIT' | 'CREDIT';

export type RefundStatus =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PROVIDER_PROCESSING'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED'
  | 'MANUAL_ACTION_REQUIRED';

export type RefundResponsibility =
  | 'PLATFORM'
  | 'RESTAURANT'
  | 'CUSTOMER'
  | 'PROVIDER'
  | 'SHARED'
  | 'UNDETERMINED';

export type FinancialDisputeType =
  | 'CUSTOMER_REFUND_DISPUTE'
  | 'MERCHANT_ADJUSTMENT_DISPUTE'
  | 'PAYOUT_DISPUTE'
  | 'PAYMENT_MISMATCH'
  | 'DUPLICATE_CHARGE'
  | 'RESERVATION_DEPOSIT_DISPUTE'
  | 'OTHER';

export type FinancialDisputeStatus =
  | 'OPEN'
  | 'EVIDENCE_REQUIRED'
  | 'UNDER_REVIEW'
  | 'RESOLVED_CUSTOMER'
  | 'RESOLVED_RESTAURANT'
  | 'RESOLVED_PLATFORM'
  | 'PARTIAL_RESOLUTION'
  | 'REJECTED'
  | 'CLOSED';

export type MerchantSettlementStatus =
  | 'DRAFT'
  | 'CALCULATED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PAYOUT_PENDING'
  | 'PAID'
  | 'FAILED'
  | 'ON_HOLD'
  | 'CANCELLED';

export type MerchantPayoutStatus =
  | 'QUEUED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'REVERSED'
  | 'ON_HOLD'
  | 'MANUAL_REVIEW';

export type PayoutDestinationType = 'MOBILE_MONEY' | 'BANK';

export type DestinationVerificationStatus =
  | 'UNVERIFIED'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'REJECTED';

export type ReconciliationResult =
  | 'MATCHED'
  | 'STATUS_MISMATCH'
  | 'AMOUNT_MISMATCH'
  | 'MISSING_INTERNAL'
  | 'MISSING_PROVIDER'
  | 'DUPLICATE'
  | 'REVIEW_REQUIRED';

export interface FinancialPostingBatch {
  id: string;
  batchType: string;
  totalAmountTzs: string;
  isBalanced: boolean;
  idempotencyKey: string;
  createdAt: string;
}

export interface FinancialLedgerEntry {
  id: string;
  batchId: string;
  entryType: FinancialEntryType;
  entityType: string;
  entityId: string;
  restaurantId?: string;
  customerUserId?: string;
  paymentId?: string;
  refundId?: string;
  disputeId?: string;
  settlementId?: string;
  payoutId?: string;
  currency: 'TZS';
  amountTzs: string; // string representation of BIGINT for safety
  direction: FinancialDirection;
  accountType: FinancialAccountType;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  occurredAt: string;
  createdAt: string;
  createdByType: string;
  idempotencyKey: string;
  metadata?: Record<string, any>;
}

export interface MerchantFeePolicy {
  id: string;
  restaurantId?: string;
  commissionBasisPoints: number; // e.g. 1000 = 10%
  commissionFixedTzs: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  createdBy?: string;
  createdAt: string;
}

export interface OrderFinancialSnapshot {
  orderId: string;
  restaurantId: string;
  paymentId?: string;
  grossFoodSalesTzs: string;
  customerServiceFeeTzs: string;
  restaurantDeliveryFeeTzs: string;
  discountTzs: string;
  platformCommissionTzs: string;
  providerFeeTzs?: string;
  restaurantNetPayableTzs: string;
  commissionPolicyId?: string;
  commissionBasisPointsSnapshot: number;
  currency: 'TZS';
  createdAt: string;
}

export interface RefundRequest {
  id: string;
  paymentId: string;
  orderId?: string;
  reservationId?: string;
  customMealRequestId?: string;
  customerUserId: string;
  restaurantId?: string;
  requestedAmountTzs: string;
  approvedAmountTzs?: string;
  reasonCode: string;
  reasonDetail?: string;
  responsibility: RefundResponsibility;
  status: RefundStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  providerRefundReference?: string;
  completedAt?: string;
  failureReason?: string;
  idempotencyKey: string;
  affectedItems?: Array<{
    orderItemId?: string;
    componentType: string;
    quantity?: number;
    amountTzs: number;
    notes?: string;
  }>;
}

export interface FinancialDispute {
  id: string;
  disputeType: FinancialDisputeType;
  entityType: string;
  entityId: string;
  customerUserId?: string;
  restaurantId?: string;
  refundRequestId?: string;
  paymentId?: string;
  settlementId?: string;
  disputedAmountTzs: string;
  openedBy: string;
  reasonCode: string;
  description: string;
  status: FinancialDisputeStatus;
  openedAt: string;
  evidenceDeadlineAt?: string;
  assignedAdmin?: string;
  resolvedAt?: string;
  resolution?: string;
  financialAdjustmentId?: string;
}

export interface FinancialDisputeEvidence {
  id: string;
  disputeId: string;
  uploaderId: string;
  filePath: string;
  fileType: string;
  description?: string;
  createdAt: string;
}

export interface MerchantSettlement {
  id: string;
  restaurantId: string;
  periodStart: string;
  periodEnd: string;
  currency: 'TZS';
  grossSalesTzs: string;
  platformFeesTzs: string;
  refundAdjustmentsTzs: string;
  disputeAdjustmentsTzs: string;
  otherAdjustmentsTzs: string;
  netPayableTzs: string;
  status: MerchantSettlementStatus;
  reference: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  payoutId?: string;
}

export interface MerchantSettlementItem {
  id: string;
  settlementId: string;
  ledgerEntryId: string;
  orderId?: string;
  paymentId?: string;
  entryType: FinancialEntryType;
  grossTzs: string;
  feeTzs: string;
  adjustmentTzs: string;
  netTzs: string;
}

export interface MerchantPayoutDestination {
  id: string;
  restaurantId: string;
  destinationType: PayoutDestinationType;
  provider: string;
  maskedAccountIdentifier: string;
  accountName: string;
  verificationStatus: DestinationVerificationStatus;
  isDefault: boolean;
  createdAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  createdBy: string;
}

export interface MerchantPayout {
  id: string;
  settlementId: string;
  restaurantId: string;
  destinationId: string;
  destinationTypeSnapshot: PayoutDestinationType;
  providerSnapshot: string;
  maskedIdentifierSnapshot: string;
  accountNameSnapshot: string;
  amountTzs: string;
  currency: 'TZS';
  provider: string;
  providerReference?: string;
  providerPayoutId?: string;
  status: MerchantPayoutStatus;
  idempotencyKey: string;
  requestedAt: string;
  processingAt?: string;
  completedAt?: string;
  failedAt?: string;
  failureCode?: string;
  failureReason?: string;
  rawProviderStatus?: string;
}

export interface FinancialAdjustment {
  id: string;
  restaurantId: string;
  orderId?: string;
  paymentId?: string;
  disputeId?: string;
  amountTzs: string;
  direction: FinancialDirection;
  reason: string;
  notes?: string;
  createdBy: string;
  approvedBy?: string;
  approvalStatus: string;
  batchId?: string;
  createdAt: string;
}

export interface ReconciliationRun {
  id: string;
  provider: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  createdBy?: string;
  summary?: Record<string, any>;
}

export interface ReconciliationItem {
  id: string;
  runId: string;
  paymentId?: string;
  payoutId?: string;
  providerReference: string;
  internalAmountTzs?: string;
  providerAmountTzs?: string;
  internalStatus?: string;
  rawProviderStatus?: string;
  result: ReconciliationResult;
  notes?: string;
  createdAt: string;
}

export interface RestaurantFinancialSummary {
  restaurantId: string;
  totalGrossFoodSalesTzs: string;
  totalPlatformCommissionTzs: string;
  totalNetEntitlementTzs: string;
  totalSettledPaidTzs: string;
  unsettledPayableTzs: string;
  heldDisputedTzs: string;
  activeDisputesCount: number;
  lastSettlementAt?: string;
}

// ============================================================================
// 12. PACK 4D: RATINGS, REVIEWS, DISH TRUST & CONTENT INTEGRITY
// ============================================================================

export type ReviewSourceType = 'ORDER' | 'CUSTOM_MEAL' | 'RESERVATION';

export type ReviewVisibilityStatus =
  | 'PENDING_MODERATION'
  | 'PUBLISHED'
  | 'HIDDEN'
  | 'REMOVED_POLICY'
  | 'DELETED_BY_AUTHOR';

export type ReviewModerationStatus =
  | 'NOT_REVIEWED'
  | 'AUTO_FLAGGED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export type ReviewAspectType =
  | 'FOOD_QUALITY'
  | 'ORDER_ACCURACY'
  | 'VALUE_FOR_MONEY'
  | 'PACKAGING'
  | 'PORTION_SIZE'
  | 'PREPARATION'
  | 'RESTAURANT_DELIVERY'
  | 'SERVICE'
  | 'CLEANLINESS'
  | 'ATMOSPHERE';

export type ReviewTagCode =
  | 'GREAT_FLAVOR'
  | 'FRESH_FOOD'
  | 'GOOD_PORTION'
  | 'GOOD_VALUE'
  | 'ACCURATE_ORDER'
  | 'GOOD_PACKAGING'
  | 'FRIENDLY_SERVICE'
  | 'CLEAN_LOCATION'
  | 'FAST_PREPARATION'
  | 'ON_TIME_RESTAURANT_DELIVERY'
  | 'POOR_FLAVOR'
  | 'SMALL_PORTION'
  | 'POOR_VALUE'
  | 'INCORRECT_ITEM'
  | 'MISSING_ITEM'
  | 'POOR_PACKAGING'
  | 'SLOW_PREPARATION'
  | 'POOR_SERVICE'
  | 'UNCLEAN_LOCATION'
  | 'LATE_RESTAURANT_DELIVERY';

export type ReviewReportReason =
  | 'FAKE_EXPERIENCE'
  | 'CONFLICT_OF_INTEREST'
  | 'HARASSMENT'
  | 'HATE_OR_ABUSE'
  | 'PERSONAL_INFORMATION'
  | 'SPAM'
  | 'OFF_TOPIC'
  | 'INCENTIVIZED_REVIEW'
  | 'THREAT'
  | 'OTHER';

export type ReviewModerationOutcome =
  | 'NO_VIOLATION'
  | 'KEEP_PUBLISHED'
  | 'HIDE_PENDING_REVIEW'
  | 'REMOVE_POLICY'
  | 'RESTORE'
  | 'WARN_AUTHOR'
  | 'RESTRICT_REVIEWING';

export type ReviewSortMode =
  | 'MOST_RELEVANT'
  | 'NEWEST'
  | 'HIGHEST'
  | 'LOWEST'
  | 'MOST_HELPFUL';

export interface ReviewAspectRating {
  id?: string;
  reviewId: string;
  aspectType: ReviewAspectType;
  ratingValue: number;
  createdAt?: string;
}

export interface ReviewItemRating {
  id?: string;
  reviewId: string;
  orderId: string;
  orderItemId: string;
  menuItemId: string;
  restaurantId: string;
  branchId?: string;
  rating: number;
  createdAt?: string;
}

export interface ReviewTag {
  id?: string;
  reviewId: string;
  tagCode: ReviewTagCode;
  createdAt?: string;
}

export interface ReviewVersion {
  id: string;
  reviewId: string;
  versionNumber: number;
  overallRating: number;
  title?: string;
  body?: string;
  aspectSnapshot?: Record<string, any>[];
  tagSnapshot?: string[];
  editorUserId: string;
  editedAt: string;
}

export interface ReviewResponse {
  id: string;
  reviewId: string;
  restaurantId: string;
  responderUserId: string;
  body: string;
  status: 'PUBLISHED' | 'HIDDEN' | 'DELETED';
  createdAt: string;
  updatedAt: string;
}

export interface ReviewResponseVersion {
  id: string;
  responseId: string;
  versionNumber: number;
  body: string;
  editorUserId: string;
  editedAt: string;
}

export interface ReviewHelpfulnessVote {
  id?: string;
  reviewId: string;
  userId: string;
  isHelpful: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewMedia {
  id: string;
  reviewId: string;
  storagePath: string;
  mediaType: string;
  sortOrder: number;
  moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface ReviewReport {
  id: string;
  reviewId: string;
  reporterUserId: string;
  reasonCode: ReviewReportReason;
  details?: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ReviewModerationCase {
  id: string;
  reviewId: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  openedReason: string;
  openedAt: string;
  assignedAdmin?: string;
  resolvedAt?: string;
  resolutionCode?: ReviewModerationOutcome;
  resolutionNotes?: string;
}

export interface ReviewModerationEvent {
  id: string;
  caseId: string;
  reviewId: string;
  actorUserId?: string;
  actorType: 'SYSTEM' | 'ADMIN';
  action: string;
  reasonCode?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ReviewIntegrityFlag {
  id: string;
  reviewId: string;
  signalType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: Record<string, any>;
  createdAt: string;
  resolvedAt?: string;
}

export interface RestaurantRatingAggregate {
  restaurantId: string;
  verifiedReviewCount: number;
  averageRating: number;
  recent90dAverage: number;
  rating1Count: number;
  rating2Count: number;
  rating3Count: number;
  rating4Count: number;
  rating5Count: number;
  bayesianRating: number;
  lastReviewAt?: string;
  updatedAt: string;
}

export interface BranchRatingAggregate {
  branchId: string;
  restaurantId: string;
  verifiedReviewCount: number;
  averageRating: number;
  recent90dAverage: number;
  rating1Count: number;
  rating2Count: number;
  rating3Count: number;
  rating4Count: number;
  rating5Count: number;
  bayesianRating: number;
  lastReviewAt?: string;
  updatedAt: string;
}

export interface DishRatingAggregate {
  menuItemId: string;
  restaurantId: string;
  branchId?: string;
  verifiedRatingCount: number;
  averageRating: number;
  recent90dAverage: number;
  rating1Count: number;
  rating2Count: number;
  rating3Count: number;
  rating4Count: number;
  rating5Count: number;
  bayesianRating: number;
  lastRatingAt?: string;
  updatedAt: string;
}

export interface ReviewEligibilityResult {
  eligible: boolean;
  reason?: string;
  sourceType?: ReviewSourceType;
  orderId?: string;
  reservationId?: string;
  restaurantId?: string;
  restaurantName?: string;
  branchId?: string;
  items?: Array<{
    order_item_id: string;
    menu_item_id: string;
    item_name: string;
    unit_price_tzs: number;
  }>;
  allowedAspects?: ReviewAspectType[];
  existingReviewId?: string;
}


// ============================================================================
// PACK 4E: NOTIFICATIONS, COMMUNICATION & DELIVERY RELIABILITY TYPES
// ============================================================================

export type NotificationChannel = 'IN_APP' | 'PUSH' | 'SMS' | 'EMAIL';

export type CommunicationClass =
  | 'SECURITY'
  | 'TRANSACTIONAL_CRITICAL'
  | 'TRANSACTIONAL'
  | 'OPERATIONAL'
  | 'REMINDER'
  | 'SOCIAL'
  | 'MARKETING';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type NotificationDeliveryStatus =
  | 'PENDING'
  | 'SUPPRESSED'
  | 'QUEUED'
  | 'PROVIDER_ACCEPTED'
  | 'SENT'
  | 'PROVIDER_DELIVERED'
  | 'FAILED_RETRYABLE'
  | 'FAILED_PERMANENT'
  | 'EXPIRED'
  | 'CANCELLED';

export type NotificationEventType =
  | 'ORDER_CREATED'
  | 'ORDER_ACCEPTED'
  | 'ORDER_PREPARING'
  | 'ORDER_READY'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'RESERVATION_CREATED'
  | 'RESERVATION_APPROVAL_REQUIRED'
  | 'RESERVATION_AWAITING_DEPOSIT'
  | 'RESERVATION_CONFIRMED'
  | 'RESERVATION_REMINDER'
  | 'RESERVATION_SEATED'
  | 'RESERVATION_COMPLETED'
  | 'RESERVATION_CANCELLED'
  | 'RESERVATION_REJECTED'
  | 'RESERVATION_NO_SHOW'
  | 'CUSTOM_MEAL_CREATED'
  | 'CUSTOM_MEAL_INVITATION_SENT'
  | 'CUSTOM_MEAL_QUOTE_RECEIVED'
  | 'CUSTOM_MEAL_QUOTE_ACCEPTED'
  | 'CUSTOM_MEAL_READY'
  | 'STAFF_INVITATION'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'REFUND_REQUESTED'
  | 'REFUND_PROCESSED'
  | 'SETTLEMENT_GENERATED'
  | 'DISPUTE_OPENED'
  | 'REVIEW_SUBMITTED'
  | 'REVIEW_RESPONSE_PUBLISHED'
  | 'REVIEW_MODERATED'
  | 'SECURITY_LOGIN_ALERT'
  | 'SECURITY_PASSWORD_CHANGED'
  | 'SECURITY_DEVICE_LINKED'
  | 'PROMOTIONAL_CAMPAIGN'
  | 'SYSTEM_ANNOUNCEMENT';

export interface NotificationEventOutbox {
  id: string;
  eventType: NotificationEventType;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, any>;
  idempotencyKey: string;
  priority: NotificationPriority;
  communicationClass: CommunicationClass;
  processingStatus: 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'DEAD_LETTER';
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  processedAt?: string;
  lastError?: string;
  workerId?: string;
  claimedAt?: string;
  leaseUntil?: string;
  createdAt: string;
}

export interface NotificationDelivery {
  id: string;
  notificationId?: string;
  outboxEventId?: string;
  userId: string;
  channel: NotificationChannel;
  recipientAddress: string;
  provider: string;
  status: NotificationDeliveryStatus;
  idempotencyKey: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: string;
  lastAttemptAt?: string;
  providerMessageId?: string;
  providerResponse?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
  deliveredAt?: string;
  workerId?: string;
  claimedAt?: string;
  leaseUntil?: string;
  templateId?: string;
  templateVersion?: number;
  locale?: string;
  renderedTitle?: string;
  renderedBody?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDeliveryAttempt {
  id: string;
  deliveryId: string;
  attemptNumber: number;
  channel: NotificationChannel;
  provider: string;
  status: NotificationDeliveryStatus;
  providerMessageId?: string;
  providerStatusCode?: string;
  providerRawResponse?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
  attemptedAt: string;
  durationMs: number;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  channel: NotificationChannel;
  category: string;
  enabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
  updatedAt: string;
}

export interface MarketingConsent {
  id: string;
  userId: string;
  channel: NotificationChannel;
  consented: boolean;
  consentedAt?: string;
  withdrawnAt?: string;
  consentPolicyVersion: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PushDevice {
  id: string;
  userId: string;
  deviceFingerprint: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  deviceModel?: string;
  appVersion?: string;
  osVersion?: string;
  isActive: boolean;
  lastSeenAt: string;
  createdAt: string;
}

export interface PushDeviceToken {
  id: string;
  deviceId: string;
  userId: string;
  tokenType: 'EXPO' | 'FCM' | 'APNS';
  token: string;
  isValid: boolean;
  invalidatedAt?: string;
  invalidationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTemplate {
  id: string;
  eventType: string;
  channel: NotificationChannel;
  locale: 'en' | 'sw';
  titleTemplate: string;
  bodyTemplate: string;
  allowlistedKeys: string[];
  isActive: boolean;
  version: number;
  createdAt: string;
}

export interface CommunicationSuppression {
  id: string;
  channel: NotificationChannel;
  destination: string;
  reason:
    | 'HARD_BOUNCE'
    | 'SPAM_REPORT'
    | 'SPAM_COMPLAINT'
    | 'UNSUBSCRIBED'
    | 'USER_MARKETING_OPT_OUT'
    | 'INVALID_NUMBER'
    | 'INVALID_DESTINATION'
    | 'CARRIER_BLOCKED'
    | 'CARRIER_BLOCK'
    | 'DEVICE_NOT_REGISTERED'
    | 'PROVIDER_SUPPRESSION'
    | 'MANUAL_SUPPRESSION';
  details?: string;
  createdAt: string;
}

// ============================================================================
// 12. PACK 4F: ADVANCED RESTAURANT & BRANCH OPERATIONS
// ============================================================================

export type BranchOperationalMode = 'OPEN' | 'BUSY' | 'PAUSED' | 'CLOSED';

export type BranchServiceType =
  | 'PICKUP'
  | 'DINE_IN'
  | 'RESTAURANT_DELIVERY'
  | 'RESERVATIONS'
  | 'CUSTOM_MEALS';

export type ItemStockStatus =
  | 'IN_STOCK'
  | 'SOLD_OUT_TEMPORARILY'
  | 'UNAVAILABLE_UNTIL_MANUAL'
  | 'ARCHIVED';

export type CapacityControlMode = 'NONE' | 'ORDER_COUNT' | 'ITEM_COUNT';

export interface BranchOperatingHour {
  id: string;
  branchId: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday ... 6=Saturday
  serviceType: BranchServiceType;
  opensAt: string; // HH:MM:SS
  closesAt: string; // HH:MM:SS
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BranchScheduleOverride {
  id: string;
  branchId: string;
  overrideDate: string; // YYYY-MM-DD
  serviceType: BranchServiceType;
  opensAt?: string | null;
  closesAt?: string | null;
  isClosed: boolean;
  reasonCode: string;
  noteInternal?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BranchDeliveryZone {
  id: string;
  branchId: string;
  zoneName: string;
  feeTzs: number;
  minimumOrderTzs: number;
  estimatedDeliveryMinutes: number;
  supportedWards: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KitchenCapacityBucket {
  id: string;
  branchId: string;
  bucketWindowStart: string; // ISO 8601
  ordersCount: number;
  itemsCount: number;
  createdAt: string;
  updatedAt: string;
}

export type OrderOperationalEventType =
  | 'ORDER_RECEIVED'
  | 'ORDER_VIEWED'
  | 'ORDER_ACCEPTED'
  | 'PREP_STARTED'
  | 'READY'
  | 'DELAY_ADDED'
  | 'ITEM_ISSUE'
  | 'CANCELLED'
  | 'DISPATCHED_INTERNAL';

export interface OrderOperationalEvent {
  id: string;
  orderId: string;
  restaurantId: string;
  branchId?: string | null;
  eventType: OrderOperationalEventType | string;
  actorUserId?: string | null;
  actorRole?: string | null;
  reasonCode?: string | null;
  eventDetails: Record<string, any>;
  createdAt: string;
}

export interface RestaurantOperationalAuditLog {
  id: string;
  restaurantId: string;
  branchId?: string | null;
  action: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  reason?: string | null;
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  createdAt: string;
}

export interface BranchOperationalStatus {
  available: boolean;
  reason?: string;
  pauseReason?: string;
  pausedUntil?: string;
  mode?: BranchOperationalMode;
  estimatedPrepMinutes?: number;
  busyDelayMinutes?: number;
  timezone?: string;
  opensAt?: string;
  closesAt?: string;
  reasonCode?: string;
}

