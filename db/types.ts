export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  RESTAURANT_OWNER = 'RESTAURANT_OWNER',
  RESTAURANT_STAFF = 'RESTAURANT_STAFF',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export type WorkspaceType = 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN';

export type RestaurantVerificationStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export type RestaurantMemberRole = 'OWNER' | 'MANAGER' | 'CHEF' | 'STAFF';

export interface UserEntity {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  roles?: UserRole[];
  activeRole?: UserRole;
  activeWorkspace?: WorkspaceType;
  status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  activeRestaurantId?: string;
  location?: string;
  language: 'en' | 'sw';
  avatarEmoji?: string;
  securityPin?: string;
  companyOrGroup?: string;
  memberSince?: string;
  dietaryPreferences?: string[];
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProfileEntity {
  id: string;
  userId: string;
  deliveryAddress: string;
  neighborhood: string;
  dietaryPreferences: string[];
  favoriteCuisineTypes: string[];
  orderNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantMembershipEntity {
  id: string;
  userId: string;
  restaurantId: string;
  role: RestaurantMemberRole;
  status?: 'ACTIVE' | 'REVOKED';
  permissions: string[];
  isPrimaryOwner: boolean;
  createdAt: string;
}

export interface AuditLogEntity {
  id: string;
  adminUserId: string;
  adminName?: string;
  action:
    | 'ONBOARD_RESTAURANT'
    | 'APPROVE_RESTAURANT'
    | 'REJECT_RESTAURANT'
    | 'SUSPEND_RESTAURANT'
    | 'REACTIVATE_RESTAURANT'
    | 'SEND_OTP'
    | 'GRANT_ADMIN'
    | 'REVOKE_ADMIN'
    | string;
  targetType: 'RESTAURANT' | 'USER' | 'PAYMENT' | 'MEMBERSHIP' | 'PHONE' | string;
  targetId: string;
  details: Record<string, any>;
  ipAddress?: string;
  timestamp: string;
}

export interface RefreshSessionEntity {
  id: string;
  userId: string;
  token: string;
  deviceInfo: string;
  expiresAt: string;
  createdAt: string;
}

export interface OtpChallengeEntity {
  id: string;
  phone: string;
  otpHash: string;
  purpose: 'VENDOR_ACTIVATION' | 'PASSWORD_RESET' | 'LOGIN';
  attemptsCount: number;
  maxAttempts: number;
  isVerified: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface RestaurantApplicationEntity {
  id: string;
  businessName: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  cuisineType: string;
  neighborhood: string;
  address: string;
  hasTinOrLicense: boolean;
  tinNumber?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItemEntity {
  id: string;
  restaurantId: string;
  name: string;
  nameSw?: string;
  desc?: string;
  description?: string;
  descriptionSw?: string;
  price?: string;
  priceNum?: number;
  priceTzs?: number;
  category: string;
  photoUrl?: string;
  stockQuantity?: number;
  estimatedPrepTimeMinutes?: number;
  dietaryTags?: string[];
  spiceLevel?: string;
  popular?: boolean;
  isAvailable: boolean;
  isArchived?: boolean;
  createdAt: string;
}

export type SellerTier = 'BASIC_SELLER' | 'VERIFIED_SELLER' | 'VERIFIED_RESTAURANT';

export interface OnboardingChecklistState {
  phoneVerified: boolean;
  ownerIdentified: boolean;
  locationConfirmed: boolean;
  businessPhotoAttached: boolean;
  menuWithPricesAdded: boolean;
  termsAccepted: boolean;
}

export interface RestaurantEntity {
  id: string;
  ownerId: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerNationalId?: string;
  sellerTier: SellerTier;
  phone?: string;
  name: string;
  slug: string;
  cuisine: string;
  description?: string;
  rating: number;
  reviews?: number;
  reviewsCount?: number;
  price?: string;
  minPrice: number;
  maxPrice: number;
  minPriceTzs?: number;
  maxPriceTzs?: number;
  budgetTier?: 'budget' | 'mid' | 'premium';
  address: string;
  neighborhood: string;
  regionCity: string;
  distance?: string;
  distanceKm: number;
  time?: string;
  estimatedPrepTimeMinutes?: number;
  isOpen: boolean;
  isVerified: boolean;
  verificationStatus: RestaurantVerificationStatus;
  payoutPhoneNumber?: string;
  payoutProvider?: string;
  foodSpotPhotos?: string[];
  onboardingChecklist?: OnboardingChecklistState;
  invitationStatus?: 'NOT_SENT' | 'INVITATION_SENT' | 'ACTIVATED';
  invitationCode?: string;
  invitationSentAt?: string;
  isSuspended?: boolean;
  suspensionReason?: string;
  platformCommissionRate?: number;
  tinNumber?: string;
  businessLicenseNumber?: string;
  brelaRegNumber?: string;
  bankAccountDetails?: string;
  businessRegNumber?: string;
  verificationDocUrl?: string;
  openingHours?: string;
  closingHours?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  specialty: string;
  specialistBadge?: string;
  specialistBadgeSw?: string;
  specialistCategory?: string;
  emoji: string;
  bgGradient?: [string, string];
  tags: string[];
  lat?: number;
  lng?: number;
  supportsOrderAhead?: boolean;
  maxGroupCapacity?: number;
  menu: MenuItemEntity[];
  createdAt: string;
  updatedAt?: string;
}

export type PaymentGatewayProvider = 'CLICKPESA' | 'SELCOM' | 'PESAPAL' | 'CASH';

export type PaymentMethodCode =
  | 'MPESA'
  | 'AIRTEL_MONEY'
  | 'MIXX_BY_YAS'
  | 'HALOPESA'
  | 'CARD'
  | 'CASH_ON_DELIVERY';

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export type PaymentType =
  | 'ORDER_FULL'
  | 'RESERVATION_DEPOSIT_50'
  | 'RESERVATION_FULL_100';

export interface PaymentBreakdown {
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  paidAmount: number;
  remainingBalance: number;
}

export interface ReservationEntity {
  id: string;
  userId: string;
  restaurantId: string;
  restaurantName: string;
  guestsCount: string;
  reservationDate: string;
  timeSlot: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  address: string;
  specialNotes?: string;
  depositOption?: 'deposit_50' | 'full_100';
  depositAmountTzs?: number;
  totalBillTzs?: number;
  remainingBalanceTzs?: number;
  isDepositPaid?: boolean;
  paymentId?: string;
  createdAt: string;
}

export interface CustomMealRequestEntity {
  id: string;
  userId: string;
  orderNumber: string;
  dishName: string;
  restaurantName: string;
  targetRestaurantId?: string;
  specialInstructions: string;
  budgetTzs: number;
  servingsCount: string;
  diningOption: 'Delivery' | 'Dine-In' | 'Takeaway';
  status: 'Pending Confirmation' | 'Confirmed' | 'Cooking' | 'Ready' | 'Completed' | 'Cancelled';
  statusMessageEn: string;
  statusMessageSw: string;
  paymentStatus?: 'UNPAID' | 'AWAITING_PAYMENT' | 'PAID' | 'REFUNDED';
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTransactionEntity {
  id: string;
  userId: string;
  orderId?: string;
  reservationId?: string;
  restaurantId?: string;
  restaurantName: string;
  provider: PaymentGatewayProvider;
  providerReference: string;
  amountTzs: number;
  currency: 'TZS';
  paymentMethod: 'M-Pesa' | 'Tigo Pesa' | 'Airtel Money' | 'HaloPesa' | 'Mixx by Yas' | 'Credit Card' | 'Cash on Delivery' | string;
  methodCode: PaymentMethodCode;
  status: PaymentStatus | 'success' | 'failed' | 'pending';
  paymentType: PaymentType;
  payerPhone?: string;
  breakdown?: PaymentBreakdown;
  failureReason?: string;
  paidAt?: string;
  refundedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReviewEntity {
  id: string;
  userId: string;
  userName: string;
  restaurantId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface NotificationEntity {
  id: string;
  userId: string;
  type: string;
  category?: 'reservation' | 'order' | 'payment' | 'offer' | 'auth' | 'general';
  titleEn: string;
  titleSw: string;
  messageEn: string;
  messageSw: string;
  isRead: boolean;
  createdAt: string;
  timeAgoEn: string;
  timeAgoSw: string;
  restaurantName?: string;
  restaurantId?: string;
  reservationDate?: string;
  reservationTime?: string;
  guests?: string;
  address?: string;
  dishName?: string;
  price?: number;
  paymentAmount?: number;
  paymentMethod?: string;
  referenceNumber?: string;
  discountPercentage?: number;
  cancellationReasonEn?: string;
  cancellationReasonSw?: string;
  actionType?: string;
  data?: any;
}

export interface MloHubDatabaseSchema {
  version: number;
  hasCompletedOnboarding: boolean;
  users: UserEntity[];
  customerProfiles: CustomerProfileEntity[];
  restaurantMemberships: RestaurantMembershipEntity[];
  sessions: RefreshSessionEntity[];
  activeUserId?: string;
  restaurants: RestaurantEntity[];
  reservations: ReservationEntity[];
  customMealRequests: CustomMealRequestEntity[];
  payments: PaymentTransactionEntity[];
  reviews: ReviewEntity[];
  notifications: NotificationEntity[];
  favorites: string[];
  auditLogs?: AuditLogEntity[];
  otpChallenges?: OtpChallengeEntity[];
  restaurantApplications?: RestaurantApplicationEntity[];
  lastSyncedAt: string;
}

export function getUserRoles(user?: Partial<UserEntity> | null): UserRole[] {
  if (!user) return [];
  const roles: UserRole[] = [];
  if (user.roles && Array.isArray(user.roles)) {
    roles.push(...user.roles);
  }
  if (user.role && !roles.includes(user.role)) {
    roles.push(user.role);
  }
  if (user.activeRole && !roles.includes(user.activeRole)) {
    roles.push(user.activeRole);
  }
  if (user.id === 'usr-admin' || user.email === 'admin@mlohub.tz') {
    if (!roles.includes(UserRole.SUPER_ADMIN)) roles.push(UserRole.SUPER_ADMIN);
    if (!roles.includes(UserRole.ADMIN)) roles.push(UserRole.ADMIN);
  }
  if (roles.length === 0) {
    roles.push(UserRole.CUSTOMER);
  }
  return roles;
}

export function hasAdminAccess(user?: Partial<UserEntity> | null): boolean {
  if (!user) return false;
  if (user.id === 'usr-admin' || user.email === 'admin@mlohub.tz') return true;
  if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) return true;
  if (user.activeRole === UserRole.ADMIN || user.activeRole === UserRole.SUPER_ADMIN) return true;
  if (user.activeWorkspace === 'MLOHUB_ADMIN') return true;
  const roles = getUserRoles(user);
  return roles.includes(UserRole.ADMIN) || roles.includes(UserRole.SUPER_ADMIN);
}

// DTOs & Auth Payloads
export interface RegisterCustomerDTO {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  location?: string;
  dietaryPreferences?: string[];
  agreeTerms: boolean;
}

export interface RegisterRestaurantDTO {
  // Step 1: Owner Information
  ownerFullName: string;
  ownerEmail: string;
  ownerPhone: string;
  password: string;
  // Step 2: Restaurant Information
  restaurantName: string;
  cuisine: string;
  restaurantPhone: string;
  address: string;
  neighborhood: string;
  regionCity: string;
  openingHours: string;
  closingHours: string;
  description?: string;
  lat?: number;
  lng?: number;
  // Step 3: Business Setup
  logoUrl?: string;
  coverImageUrl?: string;
  businessRegNumber?: string;
  verificationDocUrl?: string;
  agreeTerms: boolean;
}

export interface LoginDTO {
  emailOrPhone: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthSessionResponse {
  user: UserEntity;
  customerProfile?: CustomerProfileEntity;
  memberships: RestaurantMembershipEntity[];
  activeRestaurant?: RestaurantEntity;
  token: string;
}
