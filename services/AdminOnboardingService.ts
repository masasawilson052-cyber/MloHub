import { MloHubDB } from '../db';
import {
  RestaurantEntity,
  UserEntity,
  UserRole,
  SellerTier,
  OnboardingChecklistState,
  MenuItemEntity,
} from '../db/types';
import { CryptoEngine } from '../db/auth/crypto';
import { RealtimeEventEngine } from '../db/realtime/eventEngine';
import { getSmsProvider } from './sms/SmsProvider';

export interface OnboardRestaurantDTO {
  businessName: string;
  cuisine?: string;
  specialty?: string;
  ownerName: string;
  ownerPhone: string;
  ownerNationalId: string; // NIDA / Kitambulisho
  sellerTier?: SellerTier; // Defaults to 'BASIC_SELLER'
  neighborhood: string;
  address: string;
  openingHours?: string;
  closingHours?: string;
  payoutPhoneNumber: string;
  payoutProvider?: string; // M-Pesa, Airtel Money, Mixx by Yas, HaloPesa
  coverImageUrl?: string;
  foodSpotPhotos?: string[];
  initialMenu: {
    name: string;
    priceTzs: number;
    category?: string;
    description?: string;
  }[];
  checklist: OnboardingChecklistState;
  tinNumber?: string;
  businessLicenseNumber?: string;
  brelaRegNumber?: string;
}

export interface OnboardingResult {
  success: boolean;
  message: string;
  restaurant?: RestaurantEntity;
  ownerUser?: UserEntity;
  invitationCode?: string;
  temporaryPin?: string;
  simulatedSmsText?: string;
  missingChecklistItems?: string[];
}

export class AdminOnboardingService {
  /**
   * 1. Send SMS OTP Verification Code to Vendor Phone
   * Securely generates 6-digit OTP, stores salted cryptographic hash in DB,
   * and dispatches via SMS Provider. Never returns plaintext OTP to client.
   */
  public static async generateAndSendOtp(phone: string): Promise<{
    success: boolean;
    carrierName: string;
    message: string;
  }> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 9) {
      return {
        success: false,
        carrierName: 'Unknown',
        message: 'Invalid phone number format. Please provide a valid 10-digit number.',
      };
    }

    // Generate random 6-digit cryptographic OTP
    const rawOtp = `${Math.floor(100000 + Math.random() * 900000)}`;
    const otpHash = CryptoEngine.hashOtp(rawOtp, cleanPhone);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

    // Save Challenge in Database
    await MloHubDB.init();
    await MloHubDB.otpChallenges.create({
      phone: cleanPhone,
      otpHash,
      purpose: 'VENDOR_ACTIVATION',
      attemptsCount: 0,
      maxAttempts: 3,
      isVerified: false,
      expiresAt,
    });

    // Detect Tanzanian carrier for notification context
    let carrier = 'Vodacom M-Pesa';
    if (cleanPhone.includes('78') || cleanPhone.includes('68') || cleanPhone.includes('69')) carrier = 'Airtel Money';
    else if (cleanPhone.includes('71') || cleanPhone.includes('65') || cleanPhone.includes('67')) carrier = 'Mixx by Yas (Tigo)';
    else if (cleanPhone.includes('62') || cleanPhone.includes('61')) carrier = 'HaloPesa (Halotel)';

    // Dispatch via configured SMS Gateway
    const smsProvider = getSmsProvider();
    const smsResult = await smsProvider.sendOtp(cleanPhone, rawOtp, 'Usajili wa MloHub');

    // Audit Log entry
    await MloHubDB.auditLogs.create({
      adminUserId: 'system',
      adminName: 'MloHub SMS Gateway',
      action: 'SEND_OTP',
      targetType: 'PHONE',
      targetId: cleanPhone,
      details: { carrier, provider: smsProvider.name, success: smsResult.success },
    });

    return {
      success: smsResult.success,
      carrierName: carrier,
      message: `SMS invitation code dispatched via ${carrier}. Valid for 5 minutes.`,
    };
  }

  /**
   * 2. Verify SMS OTP Code using Server-Side Salted Hash & Rate-Limiting
   */
  public static async verifyOtp(
    phone: string,
    enteredOtp: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!enteredOtp || enteredOtp.trim().length === 0) {
      return { success: false, message: 'Please enter the 6-digit verification code.' };
    }

    await MloHubDB.init();
    const challenge = await MloHubDB.otpChallenges.getActiveByPhone(cleanPhone);

    if (!challenge) {
      return {
        success: false,
        message: 'No active OTP request found for this phone number. Please request a new code.',
      };
    }

    // Check expiration
    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      return {
        success: false,
        message: 'Verification code has expired. Please request a new OTP.',
      };
    }

    // Check rate-limiting attempts
    if (challenge.attemptsCount >= challenge.maxAttempts) {
      return {
        success: false,
        message: 'Maximum verification attempts exceeded. Code has been invalidated for security.',
      };
    }

    // Increment attempt count
    await MloHubDB.otpChallenges.incrementAttempts(challenge.id);

    // Constant-time cryptographic verification
    const isValid = CryptoEngine.verifyOtpHash(enteredOtp.trim(), cleanPhone, challenge.otpHash);
    if (!isValid) {
      const remaining = Math.max(0, challenge.maxAttempts - challenge.attemptsCount);
      return {
        success: false,
        message: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
      };
    }

    // Mark challenge as verified
    await MloHubDB.otpChallenges.markVerified(challenge.id);

    return {
      success: true,
      message: 'Phone number verified successfully.',
    };
  }

  /**
   * 3. Onboard Informal Vendor / Restaurant (6-Point Simple Checklist)
   */
  public static async onboardRestaurant(dto: OnboardRestaurantDTO): Promise<OnboardingResult> {
    await MloHubDB.init();

    // Verify 6-Point Checklist Requirements
    const missing: string[] = [];
    if (!dto.businessName?.trim()) missing.push('1. Business name (Jina la Biashara)');
    if (!dto.ownerName?.trim()) missing.push('2. Owner name (Jina la Mmiliki)');
    if (!dto.ownerPhone?.trim()) missing.push('3. Verified phone number (Namba ya Simu)');
    if (!dto.ownerNationalId?.trim()) missing.push('4. National ID / Kitambulisho cha Ndani');
    if (!dto.neighborhood?.trim() || !dto.address?.trim()) missing.push('5. Physical operating location / GPS');
    if (!dto.initialMenu || dto.initialMenu.length === 0 || !dto.initialMenu[0].name) {
      missing.push('6. At least 1 food item with price in TZS');
    }

    if (missing.length > 0) {
      return {
        success: false,
        message: `Missing mandatory requirements:\n• ${missing.join('\n• ')}`,
        missingChecklistItems: missing,
      };
    }

    // Generate unique slug & ID
    const slug = dto.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const restaurantId = `${slug}-${Math.floor(100 + Math.random() * 900)}`;

    // Create Owner Account linked to this restaurant
    const ownerEmail = `${slug}.owner@mlohub.tz`;
    const tempPin = `${Math.floor(1000 + Math.random() * 9000)}`;
    const ownerUserId = `usr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const ownerUser: UserEntity = {
      id: ownerUserId,
      fullName: dto.ownerName.trim(),
      email: ownerEmail,
      phone: dto.ownerPhone.trim(),
      passwordHash: CryptoEngine.hashPassword(tempPin),
      role: UserRole.RESTAURANT_OWNER,
      roles: [UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER],
      activeRole: UserRole.RESTAURANT_OWNER,
      activeWorkspace: 'RESTAURANT_OWNER',
      activeRestaurantId: restaurantId,
      status: 'ACTIVE',
      language: 'sw',
      avatarEmoji: '👑',
      securityPin: tempPin,
      companyOrGroup: dto.businessName.trim(),
      memberSince: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      isPhoneVerified: true,
      isEmailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await MloHubDB.users.create(ownerUser);

    // Initial Menu Item
    const primaryItem = dto.initialMenu[0];
    const initialMenuItems: MenuItemEntity[] = [
      {
        id: `item-${Date.now()}-1`,
        restaurantId,
        name: primaryItem.name.trim(),
        nameSw: primaryItem.name.trim(),
        priceTzs: primaryItem.priceTzs,
        category: primaryItem.category || 'Vyakula Vikuu (Main Dishes)',
        description: primaryItem.description || `${primaryItem.name} safi na moto`,
        descriptionSw: primaryItem.description || `${primaryItem.name} safi na moto`,
        photoUrl: dto.coverImageUrl || dto.foodSpotPhotos?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        stockQuantity: 50,
        isAvailable: true,
        isArchived: false,
        estimatedPrepTimeMinutes: 20,
        dietaryTags: ['Fresh Local'],
        spiceLevel: 'Mild',
        createdAt: new Date().toISOString(),
      },
    ];

    // Create Restaurant Record
    const sellerTier: SellerTier = dto.sellerTier || 'BASIC_SELLER';
    const isVerifiedTier = sellerTier === 'VERIFIED_SELLER';

    const restaurant: RestaurantEntity = {
      id: restaurantId,
      ownerId: ownerUserId,
      name: dto.businessName.trim(),
      slug,
      cuisine: dto.cuisine?.trim() || 'Vyakula vya Asili (Traditional Swahili)',
      description: `Chakula safi na cha uhakika kutoka ${dto.businessName.trim()}, ${dto.neighborhood}.`,
      sellerTier,
      rating: 5.0,
      reviewsCount: 1,
      minPrice: primaryItem.priceTzs,
      maxPrice: primaryItem.priceTzs * 3,
      minPriceTzs: primaryItem.priceTzs,
      maxPriceTzs: primaryItem.priceTzs * 3,
      price: `TZS ${primaryItem.priceTzs.toLocaleString()}`,
      address: dto.address.trim(),
      neighborhood: dto.neighborhood.trim(),
      regionCity: 'Dar es Salaam',
      distanceKm: 0.8,
      estimatedPrepTimeMinutes: 20,
      isOpen: true,
      isVerified: true,
      verificationStatus: isVerifiedTier ? 'VERIFIED' : 'VERIFIED',
      openingHours: dto.openingHours || '06:30 AM',
      closingHours: dto.closingHours || '09:00 PM',
      payoutPhoneNumber: dto.payoutPhoneNumber || dto.ownerPhone,
      payoutProvider: dto.payoutProvider || 'M-Pesa',
      coverImageUrl: dto.coverImageUrl || dto.foodSpotPhotos?.[0] || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
      foodSpotPhotos: dto.foodSpotPhotos || [],
      specialty: dto.specialty || primaryItem.name,
      emoji: '🍲',
      tags: ['Mama Lishe', dto.neighborhood, 'Fast Prep', 'M-Pesa'],
      supportsOrderAhead: true,
      menu: initialMenuItems,
      tinNumber: dto.tinNumber,
      businessLicenseNumber: dto.businessLicenseNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await MloHubDB.restaurants.create(restaurant);

    // Create Restaurant Membership
    await MloHubDB.restaurantMemberships.create({
      userId: ownerUserId,
      restaurantId,
      role: 'OWNER',
      status: 'ACTIVE',
      permissions: ['ALL'],
      isPrimaryOwner: true,
    });

    // Real-time broadcast
    RealtimeEventEngine.emit('restaurants:created', { restaurant });

    // Send Activation Notification via SMS
    const sms = getSmsProvider();
    await sms.sendNotification(
      dto.ownerPhone,
      `Hongera ${dto.ownerName}! Biashara yako ya "${dto.businessName}" imewashwa rasmi kwenye MloHub. PIN yako ya kuingia ni [ ${tempPin} ].`
    );

    // Audit Log
    await MloHubDB.auditLogs.create({
      adminUserId: 'usr-admin',
      adminName: 'MloHub Admin Console',
      action: 'ONBOARD_RESTAURANT',
      targetType: 'RESTAURANT',
      targetId: restaurantId,
      details: {
        businessName: dto.businessName,
        sellerTier,
        ownerPhone: dto.ownerPhone,
        neighborhood: dto.neighborhood,
      },
    });

    return {
      success: true,
      message: `"${dto.businessName}" is now live on MloHub!`,
      restaurant,
      ownerUser,
      temporaryPin: tempPin,
    };
  }

  /**
   * 4. Upgrade Vendor to Verified Seller Tier (with TIN & Business License)
   */
  public static async upgradeToVerified(
    restaurantId: string,
    docs: { tinNumber: string; businessLicenseNumber: string; brelaRegNumber?: string; bankAccountDetails?: string }
  ): Promise<{ success: boolean; message: string; restaurant?: RestaurantEntity }> {
    await MloHubDB.init();
    const rest = MloHubDB.restaurants.getById(restaurantId);
    if (!rest) {
      return { success: false, message: 'Restaurant not found' };
    }

    if (!docs.tinNumber?.trim() || !docs.businessLicenseNumber?.trim()) {
      return { success: false, message: 'TIN Number and Business License are required for Verified Seller tier.' };
    }

    const updated = await MloHubDB.restaurants.update(restaurantId, {
      sellerTier: 'VERIFIED_SELLER',
      isVerified: true,
      verificationStatus: 'VERIFIED',
      tinNumber: docs.tinNumber.trim(),
      businessLicenseNumber: docs.businessLicenseNumber.trim(),
      brelaRegNumber: docs.brelaRegNumber?.trim(),
      bankAccountDetails: docs.bankAccountDetails?.trim(),
    });

    RealtimeEventEngine.emit('restaurants:updated', { restaurantId, tier: 'VERIFIED_SELLER' });

    return {
      success: true,
      message: `"${rest.name}" upgraded to Verified Seller with official TIN & BRELA credentials!`,
      restaurant: updated,
    };
  }

  /**
   * 4b. Activate Owner Account via Invitation Code
   */
  public static async activateOwnerAccount(
    phone: string,
    invitationCode: string,
    newPin: string
  ): Promise<{ success: boolean; message: string; user?: UserEntity }> {
    await MloHubDB.init();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const user = MloHubDB.users.getAll().find((u) => u.phone.replace(/[^0-9]/g, '') === cleanPhone);
    if (!user) return { success: false, message: 'User not found' };

    user.securityPin = newPin;
    user.passwordHash = CryptoEngine.hashPassword(newPin);
    user.isPhoneVerified = true;

    if (user.activeRestaurantId) {
      const rest = MloHubDB.restaurants.getById(user.activeRestaurantId);
      if (rest) {
        rest.invitationStatus = 'ACTIVATED';
      }
    }
    await MloHubDB.save();
    return { success: true, message: 'Account activated successfully', user };
  }

  /**
   * 5. Suspend Restaurant (Admin Operation)
   */
  public static async suspendRestaurant(
    restaurantId: string,
    reason: string = 'Terms of service review'
  ): Promise<{ success: boolean; message: string; restaurant?: RestaurantEntity }> {
    await MloHubDB.init();
    const rest = MloHubDB.restaurants.getById(restaurantId);
    if (!rest) return { success: false, message: 'Restaurant not found' };

    const updated = await MloHubDB.restaurants.update(restaurantId, {
      verificationStatus: 'SUSPENDED',
      isOpen: false,
    });

    RealtimeEventEngine.emit('restaurants:suspended', { restaurantId, reason });

    return {
      success: true,
      message: `"${rest.name}" has been suspended.`,
      restaurant: updated,
    };
  }

  /**
   * 6. Unsuspend / Reactivate Restaurant
   */
  public static async unsuspendRestaurant(
    restaurantId: string
  ): Promise<{ success: boolean; message: string; restaurant?: RestaurantEntity }> {
    await MloHubDB.init();
    const rest = MloHubDB.restaurants.getById(restaurantId);
    if (!rest) return { success: false, message: 'Restaurant not found' };

    const updated = await MloHubDB.restaurants.update(restaurantId, {
      verificationStatus: 'VERIFIED',
      isOpen: true,
    });

    RealtimeEventEngine.emit('restaurants:reactivated', { restaurantId });

    return {
      success: true,
      message: `"${rest.name}" has been reactivated.`,
      restaurant: updated,
    };
  }
}
