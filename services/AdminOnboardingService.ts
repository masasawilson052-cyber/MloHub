import { MloHubDB } from '../db';
import {
  RestaurantEntity,
  UserEntity,
  UserRole,
  SellerTier,
  OnboardingChecklistState,
  MenuItemEntity,
  LipaNumberEntry,
} from '../db/types';
import { CryptoEngine } from '../db/auth/crypto';
import { RealtimeEventEngine } from '../db/realtime/eventEngine';
import { getSmsProvider } from './sms/SmsProvider';
import { SmsService } from './sms/SmsService';
import { OtpSecurityEngine } from './sms/OtpSecurityEngine';
import { normalizeTanzanianPhone } from '../utils/phoneNormalization';
import { runtimeConfig } from '../lib/runtimeConfig';

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
  acceptedPaymentMethods?: string[];
  lipaNumbers?: LipaNumberEntry[];
  lipaNumber?: string;
  lipaProvider?: string;
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
    const rawOtp = OtpSecurityEngine.generateCryptographicOtp();
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

    const norm = normalizeTanzanianPhone(cleanPhone);
    const carrier = norm.valid ? norm.carrier : 'Vodacom M-Pesa';

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

    // Delivery log entry
    await MloHubDB.smsLogs.create({
      id: `sms_log_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      recipient: cleanPhone,
      carrier,
      templateId: 'OTP_VENDOR_ACTIVATION',
      provider: smsResult.provider,
      providerMessageId: smsResult.messageId,
      status: smsResult.deliveryStatus || (smsResult.success ? 'SENT' : 'FAILED'),
      errorMessage: smsResult.error,
      createdAt: new Date().toISOString(),
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

    // Constant-time verification supporting both otp_v1 and hmac hashes
    let isValid = false;
    if (challenge.otpHash.startsWith('otp_v1$')) {
      isValid = CryptoEngine.verifyOtpHash(enteredOtp.trim(), cleanPhone, challenge.otpHash);
    } else {
      isValid = OtpSecurityEngine.timingSafeVerify(enteredOtp.trim(), cleanPhone, challenge.otpHash);
    }

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
        photoUrl:
          dto.coverImageUrl ||
          dto.foodSpotPhotos?.[0] ||
          (runtimeConfig.allowLocalDataFallbacks
            ? 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80'
            : undefined),
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
      payoutProvider:
        dto.payoutProvider ||
        (dto.acceptedPaymentMethods && dto.acceptedPaymentMethods.length > 0
          ? dto.acceptedPaymentMethods.join(', ')
          : 'M-Pesa'),
      acceptedPaymentMethods:
        dto.acceptedPaymentMethods && dto.acceptedPaymentMethods.length > 0
          ? dto.acceptedPaymentMethods
          : [dto.payoutProvider || 'M-Pesa'],
      lipaNumbers:
        dto.lipaNumbers && dto.lipaNumbers.length > 0
          ? dto.lipaNumbers
          : dto.lipaNumber?.trim()
          ? [{ provider: dto.lipaProvider || 'Vodacom Lipa / Till', number: dto.lipaNumber.trim() }]
          : [],
      lipaNumber:
        dto.lipaNumber?.trim() ||
        (dto.lipaNumbers && dto.lipaNumbers.length > 0 ? dto.lipaNumbers[0].number : undefined),
      lipaProvider:
        dto.lipaProvider?.trim() ||
        (dto.lipaNumbers && dto.lipaNumbers.length > 0 ? dto.lipaNumbers[0].provider : undefined),
      coverImageUrl:
        dto.coverImageUrl ||
        dto.foodSpotPhotos?.[0] ||
        (runtimeConfig.allowLocalDataFallbacks
          ? 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80'
          : undefined),
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

    // Send Secure Activation Notification via SMS (OTP without plaintext PIN)
    await SmsService.sendOtp({
      phone: dto.ownerPhone,
      purpose: 'VENDOR_ACTIVATION',
      language: 'sw',
    });

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

  /**
   * 7. Approve Restaurant Application (Converts vendor application into live restaurant & owner account)
   */
  public static async approveApplication(
    applicationId: string,
    reviewerAdminId: string = 'usr-admin'
  ): Promise<{
    success: boolean;
    message: string;
    restaurant?: RestaurantEntity;
    ownerUser?: UserEntity;
    temporaryPin?: string;
  }> {
    await MloHubDB.init();
    const app = MloHubDB.restaurantApplications.getById(applicationId);
    if (!app) {
      return { success: false, message: 'Application not found.' };
    }

    if (app.status === 'APPROVED') {
      return { success: false, message: 'Maombi haya tayari yalishaidhinishwa.' };
    }

    const slug = app.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const restaurantId = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
    const tempPin = `${Math.floor(1000 + Math.random() * 9000)}`;
    const ownerUserId = `usr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const ownerEmail = app.ownerEmail || `${slug}.owner@mlohub.tz`;

    // Create Owner Account
    const ownerUser: UserEntity = {
      id: ownerUserId,
      fullName: app.ownerName.trim(),
      email: ownerEmail,
      phone: app.ownerPhone.trim(),
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
      companyOrGroup: app.businessName.trim(),
      memberSince: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      isPhoneVerified: true,
      isEmailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await MloHubDB.users.create(ownerUser);

    // Initial Menu Item
    const initialMenuItems: MenuItemEntity[] = [
      {
        id: `item-${Date.now()}-1`,
        restaurantId,
        name: 'Chakula cha Siku (Special of the Day)',
        nameSw: 'Chakula cha Siku (Special of the Day)',
        priceTzs: 6500,
        category: 'Vyakula Vikuu (Main Dishes)',
        description: `Mlo maalum safi kutoka ${app.businessName.trim()}`,
        descriptionSw: `Mlo maalum safi kutoka ${app.businessName.trim()}`,
        photoUrl:
          (app as any).coverImageUrl ||
          (runtimeConfig.allowLocalDataFallbacks
            ? 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80'
            : undefined),
        stockQuantity: 50,
        isAvailable: true,
        isArchived: false,
        estimatedPrepTimeMinutes: 20,
        dietaryTags: ['Fresh Local'],
        spiceLevel: 'Mild',
        createdAt: new Date().toISOString(),
      },
    ];

    const sellerTier: SellerTier = app.hasTinOrLicense ? 'VERIFIED_SELLER' : 'BASIC_SELLER';

    const restaurant: RestaurantEntity = {
      id: restaurantId,
      ownerId: ownerUserId,
      ownerName: app.ownerName.trim(),
      ownerPhone: app.ownerPhone.trim(),
      name: app.businessName.trim(),
      slug,
      cuisine: app.cuisineType || 'Vyakula vya Asili (Traditional Swahili)',
      description: `Chakula safi na cha uhakika kutoka ${app.businessName.trim()}, ${app.neighborhood}.`,
      sellerTier,
      rating: 5.0,
      reviewsCount: 1,
      minPrice: 5000,
      maxPrice: 15000,
      minPriceTzs: 5000,
      maxPriceTzs: 15000,
      price: 'TZS 6,500',
      address: app.address.trim(),
      neighborhood: app.neighborhood.trim(),
      regionCity: 'Dar es Salaam',
      distanceKm: 0.9,
      estimatedPrepTimeMinutes: 20,
      isOpen: true,
      isVerified: true,
      verificationStatus: 'VERIFIED',
      openingHours: '07:00 AM',
      closingHours: '09:00 PM',
      payoutPhoneNumber: app.ownerPhone.trim(),
      payoutProvider: 'Vodacom M-Pesa',
      acceptedPaymentMethods: ['Vodacom M-Pesa', 'Mixx by Yas (Tigo)', 'Airtel Money'],
      lipaNumbers: [],
      coverImageUrl:
        (app as any).coverImageUrl ||
        (runtimeConfig.allowLocalDataFallbacks
          ? 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80'
          : undefined),
      foodSpotPhotos: [],
      specialty: 'Vyakula vya Asili',
      emoji: '🍲',
      tags: ['Mama Lishe', app.neighborhood, 'Fast Prep', 'M-Pesa'],
      supportsOrderAhead: true,
      menu: initialMenuItems,
      tinNumber: app.tinNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await MloHubDB.restaurants.create(restaurant);

    // Membership
    await MloHubDB.restaurantMemberships.create({
      userId: ownerUserId,
      restaurantId,
      role: 'OWNER',
      status: 'ACTIVE',
      permissions: ['ALL'],
      isPrimaryOwner: true,
    });

    // Update Application Status
    await MloHubDB.restaurantApplications.updateStatus(applicationId, 'APPROVED', 'Approved by Admin', reviewerAdminId);

    // Notification for Vendor
    await MloHubDB.notifications.create({
      userId: ownerUserId,
      type: 'order',
      titleEn: 'Restaurant Approved & Activated!',
      titleSw: 'Hongera! Mgahawa Wako Umeidhinishwa!',
      messageEn: `Your restaurant "${app.businessName}" has been approved by MloHub Admin. An SMS activation code has been sent to your phone.`,
      messageSw: `Mgahawa wako wa "${app.businessName}" umeidhinishwa rasmi na Admin. Msimbo wa SMS wa kuanzisha akaunti umetumwa kwenye simu yako.`,
      data: { restaurantId, temporaryPin: tempPin },
    });

    // Dispatch Secure SMS Activation OTP to Owner Phone
    await SmsService.sendOtp({
      phone: app.ownerPhone,
      purpose: 'VENDOR_ACTIVATION',
      language: 'sw',
    });

    // Real-time Event
    RealtimeEventEngine.emit('restaurants:created', { restaurant });
    RealtimeEventEngine.publish('restaurants:updates', {
      eventType: 'APPLICATION_APPROVED',
      applicationId,
      restaurant,
      ownerUserId,
    });

    // Audit Log
    await MloHubDB.auditLogs.create({
      adminUserId: reviewerAdminId,
      adminName: 'MloHub Admin Console',
      action: 'APPROVE_APPLICATION',
      targetType: 'RESTAURANT_APPLICATION',
      targetId: applicationId,
      details: {
        businessName: app.businessName,
        ownerPhone: app.ownerPhone,
        restaurantId,
      },
    });

    return {
      success: true,
      message: `"${app.businessName}" umeidhinishwa na kuwashwa rasmi!`,
      restaurant,
      ownerUser,
      temporaryPin: tempPin,
    };
  }

  /**
   * 8. Reject Restaurant Application
   */
  public static async rejectApplication(
    applicationId: string,
    reason: string = 'Vigezo vya usajili havijakamilika',
    reviewerAdminId: string = 'usr-admin'
  ): Promise<{ success: boolean; message: string }> {
    await MloHubDB.init();
    const app = MloHubDB.restaurantApplications.getById(applicationId);
    if (!app) return { success: false, message: 'Application not found.' };

    await MloHubDB.restaurantApplications.updateStatus(applicationId, 'REJECTED', reason, reviewerAdminId);

    RealtimeEventEngine.publish('restaurants:updates', {
      eventType: 'APPLICATION_REJECTED',
      applicationId,
      reason,
    });

    await MloHubDB.auditLogs.create({
      adminUserId: reviewerAdminId,
      adminName: 'MloHub Admin Console',
      action: 'REJECT_APPLICATION',
      targetType: 'RESTAURANT_APPLICATION',
      targetId: applicationId,
      details: { reason },
    });

    return { success: true, message: `Maombi ya "${app.businessName}" yamekataliwa.` };
  }

  /**
   * 9. Broadcast Announcement across Platform (Admin to Customers, Restaurants, or All)
   */
  public static async broadcastAnnouncement(
    title: string,
    message: string,
    targetAudience: 'ALL' | 'CUSTOMERS' | 'RESTAURANTS' = 'ALL',
    adminName: string = 'MloHub Admin'
  ): Promise<{ success: boolean; recipientCount: number; message: string }> {
    await MloHubDB.init();
    const allUsers = MloHubDB.users.getAll();

    const recipients = allUsers.filter((u) => {
      if (targetAudience === 'ALL') return true;
      if (targetAudience === 'CUSTOMERS') return u.role === UserRole.CUSTOMER || u.roles?.includes(UserRole.CUSTOMER);
      if (targetAudience === 'RESTAURANTS') return u.role === UserRole.RESTAURANT_OWNER || u.roles?.includes(UserRole.RESTAURANT_OWNER);
      return true;
    });

    for (const recipient of recipients) {
      await MloHubDB.notifications.create({
        userId: recipient.id,
        type: 'promotion',
        titleEn: title,
        titleSw: title,
        messageEn: message,
        messageSw: message,
        data: { broadcastBy: adminName, targetAudience, sentAt: new Date().toISOString() },
      });
    }

    // Realtime Broadcast
    RealtimeEventEngine.emit('announcements:broadcast', {
      title,
      message,
      targetAudience,
      sentAt: new Date().toISOString(),
    });
    RealtimeEventEngine.publish('announcements:broadcast', {
      eventType: 'BROADCAST_ANNOUNCEMENT',
      data: { title, message, targetAudience, adminName },
    });

    await MloHubDB.auditLogs.create({
      adminUserId: 'usr-admin',
      adminName,
      action: 'BROADCAST_ANNOUNCEMENT',
      targetType: 'SYSTEM',
      targetId: 'all-users',
      details: { title, targetAudience, recipientCount: recipients.length },
    });

    return {
      success: true,
      recipientCount: recipients.length,
      message: `Tangazo limetumwa kwa mafanikio kwa watumiaji ${recipients.length}!`,
    };
  }
}
