/**
 * ============================================================================
 * MLOHUB DEMO & TEST AUTH ADAPTER
 * Strictly isolated for test suites and explicit demo mode.
 * Production auth modules must NEVER statically bundle or call this adapter.
 * ============================================================================
 */

import { MloHubDB } from '../../db';
import {
  UserEntity,
  UserRole,
  CustomerProfileEntity,
  RestaurantEntity,
  RestaurantMembershipEntity,
  RefreshSessionEntity,
  RegisterCustomerDTO,
  RegisterRestaurantDTO,
  LoginDTO,
  AuthSessionResponse,
  isMembershipActive,
  getUserRoles,
} from '../../db/types';
import { UserProfile, AuthenticatedUser, RestaurantRole } from '../../types/auth';
import { CryptoEngine } from '../../db/auth/crypto';
import { getSmsProvider } from '../sms/SmsProvider';

export class DemoAuthAdapter {
  /**
   * Access the local prototype datastore snapshot for offline test assertions.
   */
  public static getSnapshot() {
    return MloHubDB.getSnapshot();
  }

  /**
   * Resolves active restaurant from local database snapshot for a given restaurantId.
   */
  public static resolveActiveRestaurant(restaurantId: string): RestaurantEntity | null {
    const db = MloHubDB.getSnapshot();
    return db.restaurants?.find((r) => r.id === restaurantId) || null;
  }

  /**
   * Resolves memberships for a user from local database snapshot.
   */
  public static resolveMemberships(userId: string, email?: string): RestaurantMembershipEntity[] {
    const db = MloHubDB.getSnapshot();
    return (db.restaurantMemberships || []).filter(
      (m) => m.userId === userId || (email && db.users?.some((u) => u.id === m.userId && u.email === email))
    );
  }

  /**
   * Offline / Demo fallback bootstrap for AuthContext.
   */
  public static async fallbackBootstrap(): Promise<{
    profile: UserProfile | null;
    memberships: RestaurantMembershipEntity[];
    activeRest: RestaurantEntity | null;
    user: AuthenticatedUser | null;
    activeWorkspace: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN';
  }> {
    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();
    const activeId = db.activeUserId;
    if (!activeId) {
      return { profile: null, memberships: [], activeRest: null, user: null, activeWorkspace: 'CUSTOMER' };
    }

    const localUser = db.users?.find((u) => u.id === activeId);
    if (!localUser || localUser.status === 'SUSPENDED' || localUser.status === 'INACTIVE') {
      return { profile: null, memberships: [], activeRest: null, user: null, activeWorkspace: 'CUSTOMER' };
    }

    const roles = localUser.roles || [localUser.role];
    const role = localUser.activeRole || localUser.role;
    const activeWs: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN' =
      role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN
        ? 'MLOHUB_ADMIN'
        : role === UserRole.RESTAURANT_OWNER || role === UserRole.RESTAURANT_STAFF
        ? 'RESTAURANT_OWNER'
        : 'CUSTOMER';

    const localProfile: UserProfile = {
      id: localUser.id,
      fullName: localUser.fullName,
      email: localUser.email,
      phone: localUser.phone,
      accountType:
        role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN
          ? 'ADMIN'
          : role === UserRole.RESTAURANT_OWNER
          ? 'RESTAURANT'
          : 'CUSTOMER',
      role,
      roles,
      status: localUser.status || 'ACTIVE',
      preferredLanguage: localUser.language || 'sw',
      avatarUrl: localUser.avatarEmoji,
      avatarEmoji: localUser.avatarEmoji,
      location: localUser.location,
      companyOrGroup: localUser.companyOrGroup,
      dietaryPreferences: localUser.dietaryPreferences,
      activeRestaurantId: localUser.activeRestaurantId,
    };

    const userMems = (db.restaurantMemberships || []).filter((m) => m.userId === localUser.id);
    const activeRest = localUser.activeRestaurantId
      ? db.restaurants?.find((r) => r.id === localUser.activeRestaurantId) || null
      : null;

    const user: AuthenticatedUser = {
      ...localProfile,
      restaurantMemberships: userMems as any,
      activeRole: role,
      activeWorkspace: activeWs,
    };

    return {
      profile: localProfile,
      memberships: userMems,
      activeRest,
      user,
      activeWorkspace: activeWs,
    };
  }

  /**
   * Switch active user in demo / test mode.
   */
  public static async switchUser(userId: string): Promise<{
    user: AuthenticatedUser | null;
    profile: UserProfile | null;
    memberships: RestaurantMembershipEntity[];
    activeRestaurant: RestaurantEntity | null;
    token: string;
    activeWorkspace: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN';
  }> {
    const db = MloHubDB.getSnapshot();
    const targetUser = db.users?.find((u) => u.id === userId);
    if (!targetUser) {
      throw new Error('Unauthorized: Cannot switch user context without credentials.');
    }

    db.activeUserId = targetUser.id;
    await MloHubDB.save();

    const bootstrap = await this.fallbackBootstrap();
    return {
      user: bootstrap.user,
      profile: bootstrap.profile,
      memberships: bootstrap.memberships,
      activeRestaurant: bootstrap.activeRest,
      token: `local_switched_${targetUser.id}`,
      activeWorkspace: bootstrap.activeWorkspace,
    };
  }

  /**
   * Send Customer OTP in Demo / Test mode.
   */
  public static async sendCustomerOtp(phone: string, purpose: string = 'Uthibitisho'): Promise<{
    success: boolean;
    carrierName: string;
    message: string;
    error?: string;
  }> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 9) {
      return {
        success: false,
        carrierName: 'Unknown',
        message: 'Invalid phone number format. Please provide a valid number.',
      };
    }

    const rawOtp = `${Math.floor(100000 + Math.random() * 900000)}`;
    const otpHash = CryptoEngine.hashOtp(rawOtp, cleanPhone);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await MloHubDB.init();
    await MloHubDB.otpChallenges.create({
      phone: cleanPhone,
      otpHash,
      purpose: 'CUSTOMER_VERIFICATION',
      attemptsCount: 0,
      maxAttempts: 3,
      isVerified: false,
      expiresAt,
    });

    let carrier = 'Vodacom M-Pesa';
    if (cleanPhone.includes('78') || cleanPhone.includes('68') || cleanPhone.includes('69')) carrier = 'Airtel Money';
    else if (cleanPhone.includes('71') || cleanPhone.includes('65') || cleanPhone.includes('67')) carrier = 'Mixx by Yas (Tigo)';
    else if (cleanPhone.includes('62') || cleanPhone.includes('61')) carrier = 'HaloPesa (Halotel)';

    const smsProvider = getSmsProvider();
    const smsResult = await smsProvider.sendOtp(cleanPhone, rawOtp, purpose);

    await MloHubDB.auditLogs.create({
      adminUserId: 'system',
      adminName: 'MloHub Demo SMS Gateway',
      action: 'SEND_CUSTOMER_OTP',
      targetType: 'PHONE',
      targetId: cleanPhone,
      details: { carrier, provider: smsProvider.name, success: smsResult.success },
    });

    return {
      success: smsResult.success,
      carrierName: carrier,
      message: smsResult.success
        ? `Nambari ya siri ya uthibitisho imetumwa kwa SMS (${carrier}).`
        : smsResult.error || 'Failed to dispatch SMS OTP.',
      error: smsResult.error,
    };
  }

  /**
   * Verify Customer OTP in Demo / Test mode.
   */
  public static async verifyCustomerOtp(
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

    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      return {
        success: false,
        message: 'Verification code has expired. Please request a new code.',
      };
    }

    if (challenge.attemptsCount >= challenge.maxAttempts) {
      return {
        success: false,
        message: 'Maximum verification attempts exceeded. Code has been invalidated for security.',
      };
    }

    await MloHubDB.otpChallenges.incrementAttempts(challenge.id);

    const isValid = CryptoEngine.verifyOtpHash(enteredOtp.trim(), cleanPhone, challenge.otpHash);
    if (!isValid) {
      const remaining = Math.max(0, challenge.maxAttempts - challenge.attemptsCount);
      return {
        success: false,
        message: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
      };
    }

    await MloHubDB.otpChallenges.markVerified(challenge.id);

    const db = MloHubDB.getSnapshot();
    const existingUser = db.users?.find((u) => u.phone.replace(/[^0-9]/g, '') === cleanPhone);
    if (existingUser) {
      existingUser.isPhoneVerified = true;
      existingUser.updatedAt = new Date().toISOString();
      await MloHubDB.save();
    }

    return {
      success: true,
      message: 'Phone number verified successfully.',
    };
  }

  /**
   * Register customer into local mock datastore.
   */
  public static async registerCustomer(dto: RegisterCustomerDTO): Promise<AuthSessionResponse> {
    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();

    const cleanEmail = dto.email.trim().toLowerCase();
    const cleanPhone = dto.phone.trim();
    const cleanName = dto.fullName.trim();

    if (!cleanName || cleanName.length < 2) {
      throw new Error('Full name is required (minimum 2 characters).');
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Please provide a valid email address.');
    }
    if (!cleanPhone || cleanPhone.length < 9) {
      throw new Error('Please provide a valid phone number (e.g. +255 754 123 456).');
    }
    if (!dto.password || dto.password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    if (!dto.agreeTerms) {
      throw new Error('You must agree to the Terms of Service and Privacy Policy.');
    }

    const existingEmail = db.users?.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existingEmail) {
      throw new Error('An account with this email address already exists.');
    }
    const existingPhone = db.users?.find((u) => u.phone === cleanPhone);
    if (existingPhone) {
      throw new Error('An account with this phone number already exists.');
    }

    const userId = `usr-${Date.now()}`;
    const passwordHash = CryptoEngine.hashPassword(dto.password);
    const now = new Date().toISOString();

    const newUser: UserEntity = {
      id: userId,
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash,
      role: UserRole.CUSTOMER,
      activeRole: UserRole.CUSTOMER,
      location: dto.location || 'Dar es Salaam',
      language: 'en',
      avatarEmoji: '👤',
      securityPin: '1234',
      isEmailVerified: false,
      isPhoneVerified: false,
      memberSince: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      createdAt: now,
      updatedAt: now,
    };

    const profileId = `cp-${Date.now()}`;
    const newProfile: CustomerProfileEntity = {
      id: profileId,
      userId,
      deliveryAddress: dto.location || 'Dar es Salaam',
      neighborhood: dto.location || 'Mikocheni',
      dietaryPreferences: dto.dietaryPreferences || [],
      favoriteCuisineTypes: ['Swahili', 'Healthy'],
      createdAt: now,
      updatedAt: now,
    };

    const jti = `sess_${CryptoEngine.generateSalt(24)}`;
    const token = CryptoEngine.signToken({
      userId,
      role: UserRole.CUSTOMER,
      email: cleanEmail,
      sessionId: jti,
      jti,
    });

    const newSession: RefreshSessionEntity = {
      id: jti,
      sessionId: jti,
      userId,
      token,
      deviceInfo: 'Expo Mobile App (Demo Mode)',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
    };

    db.users = db.users || [];
    db.users.unshift(newUser);
    db.customerProfiles = db.customerProfiles || [];
    db.customerProfiles.unshift(newProfile);
    db.sessions = db.sessions || [];
    db.sessions.unshift(newSession);
    db.activeUserId = userId;

    await MloHubDB.save();

    return {
      user: newUser,
      customerProfile: newProfile,
      memberships: [],
      token,
    };
  }

  /**
   * Register restaurant & owner into local mock datastore.
   */
  public static async registerRestaurant(dto: RegisterRestaurantDTO): Promise<AuthSessionResponse> {
    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();

    const cleanOwnerEmail = dto.ownerEmail.trim().toLowerCase();
    const cleanOwnerPhone = dto.ownerPhone.trim();
    const cleanOwnerName = dto.ownerFullName.trim();

    if (!cleanOwnerName) throw new Error('Owner full name is required.');
    if (!cleanOwnerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanOwnerEmail)) {
      throw new Error('Please provide a valid owner email.');
    }
    if (!cleanOwnerPhone) throw new Error('Owner phone number is required.');
    if (!dto.password || dto.password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const cleanRestName = dto.restaurantName.trim();
    if (!cleanRestName) throw new Error('Restaurant name is required.');
    if (!dto.cuisine.trim()) throw new Error('Cuisine / Category is required.');
    if (!dto.address.trim()) throw new Error('Physical restaurant address is required.');
    if (!dto.agreeTerms) throw new Error('You must agree to the Merchant Terms of Service.');

    if (db.users?.some((u) => u.email.toLowerCase() === cleanOwnerEmail)) {
      throw new Error('An account with this email already exists.');
    }

    const now = new Date().toISOString();
    const userId = `usr-chef-${Date.now()}`;
    const restaurantId = `rest-${cleanRestName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;

    const newOwner: UserEntity = {
      id: userId,
      fullName: cleanOwnerName,
      email: cleanOwnerEmail,
      phone: cleanOwnerPhone,
      passwordHash: CryptoEngine.hashPassword(dto.password),
      role: UserRole.RESTAURANT_OWNER,
      activeRole: UserRole.RESTAURANT_OWNER,
      activeRestaurantId: restaurantId,
      location: dto.address,
      language: 'en',
      avatarEmoji: '👑',
      securityPin: '1234',
      companyOrGroup: cleanRestName,
      memberSince: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      createdAt: now,
      updatedAt: now,
    };

    const newRestaurant: RestaurantEntity = {
      id: restaurantId,
      ownerId: userId,
      ownerName: cleanOwnerName,
      ownerPhone: cleanOwnerPhone,
      sellerTier: 'BASIC_SELLER',
      name: cleanRestName,
      slug: restaurantId,
      cuisine: dto.cuisine,
      description: dto.description || `${cleanRestName} specializing in authentic fresh dishes.`,
      rating: 5.0,
      reviews: 0,
      price: 'TZS 10,000 - 30,000',
      minPrice: 10000,
      maxPrice: 30000,
      budgetTier: 'mid',
      address: dto.address,
      neighborhood: dto.neighborhood || 'Mikocheni',
      regionCity: dto.regionCity || 'Dar es Salaam',
      distance: '1.2 km',
      distanceKm: 1.2,
      time: '25-35m',
      isOpen: true,
      isVerified: false,
      verificationStatus: 'PENDING_VERIFICATION',
      businessRegNumber: dto.businessRegNumber || undefined,
      verificationDocUrl: dto.verificationDocUrl || undefined,
      openingHours: dto.openingHours || '08:00 AM',
      closingHours: dto.closingHours || '10:00 PM',
      logoUrl: dto.logoUrl,
      coverImageUrl: dto.coverImageUrl,
      specialty: `${dto.cuisine} Specialist`,
      specialistBadge: `👑 ${dto.cuisine} Specialist`,
      specialistBadgeSw: `👑 Mtaalamu wa ${dto.cuisine}`,
      specialistCategory: dto.cuisine.toLowerCase(),
      emoji: '🍽️',
      bgGradient: ['#113a26', '#1d6637'],
      tags: [dto.cuisine, 'Fresh Cook', 'Advance Batch'],
      lat: dto.lat || -6.7780,
      lng: dto.lng || 39.2660,
      supportsOrderAhead: true,
      maxGroupCapacity: 50,
      menu: [],
      createdAt: now,
      updatedAt: now,
    };

    const membershipId = `rm-${Date.now()}`;
    const newMembership: RestaurantMembershipEntity = {
      id: membershipId,
      userId,
      restaurantId,
      role: 'OWNER',
      permissions: ['MANAGE_MENU', 'MANAGE_ORDERS', 'MANAGE_RESERVATIONS', 'VIEW_FINANCES', 'MANAGE_STAFF'],
      isPrimaryOwner: true,
      createdAt: now,
    };

    const jti = `sess_${CryptoEngine.generateSalt(24)}`;
    const token = CryptoEngine.signToken({
      userId,
      role: UserRole.RESTAURANT_OWNER,
      email: cleanOwnerEmail,
      restaurantId,
      sessionId: jti,
      jti,
    });

    const newSession: RefreshSessionEntity = {
      id: jti,
      sessionId: jti,
      userId,
      token,
      deviceInfo: 'Expo Mobile App (Demo Mode)',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
    };

    db.users = db.users || [];
    db.users.unshift(newOwner);
    db.restaurants = db.restaurants || [];
    db.restaurants.unshift(newRestaurant);
    db.restaurantMemberships = db.restaurantMemberships || [];
    db.restaurantMemberships.unshift(newMembership);
    db.sessions = db.sessions || [];
    db.sessions.unshift(newSession);
    db.activeUserId = userId;

    await MloHubDB.save();

    return {
      user: newOwner,
      memberships: [newMembership],
      activeRestaurant: newRestaurant,
      token,
    };
  }

  /**
   * Demo / Test login against local datastore.
   */
  public static async login(dto: LoginDTO): Promise<AuthSessionResponse> {
    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();

    const cleanInput = dto.emailOrPhone.trim().toLowerCase();
    if (!cleanInput) throw new Error('Please enter your email or phone number.');
    if (!dto.password) throw new Error('Please enter your password.');

    const digitsOnly = cleanInput.replace(/[^0-9]/g, '');
    const normClean = digitsOnly.startsWith('0') ? '255' + digitsOnly.slice(1) : digitsOnly;

    const user = db.users?.find((u) => {
      if (u.email.toLowerCase() === cleanInput) return true;
      const uDigits = (u.phone || '').replace(/[^0-9]/g, '');
      const normU = uDigits.startsWith('0') ? '255' + uDigits.slice(1) : uDigits;
      return (
        (normClean.length >= 9 && normClean === normU) ||
        (u.phone && u.phone.replace(/[\s-]/g, '') === cleanInput.replace(/[\s-]/g, ''))
      );
    });

    if (!user) {
      throw new Error('Invalid email/phone or password. Please check your credentials.');
    }

    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      throw new Error('This account has been suspended or deactivated. Please contact support.');
    }

    const isValid = CryptoEngine.verifyPassword(dto.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email/phone or password. Please check your credentials.');
    }

    if (CryptoEngine.shouldUpgradeHash(user.passwordHash)) {
      user.passwordHash = CryptoEngine.hashPassword(dto.password);
    }

    const customerProfile = db.customerProfiles?.find((cp) => cp.userId === user.id);
    const userMemberships = db.restaurantMemberships?.filter((rm) => rm.userId === user.id) || [];
    const activeMemberships = userMemberships.filter((m) => isMembershipActive(m));

    const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
    const isAdmin = userRoles.includes(UserRole.ADMIN) || userRoles.includes(UserRole.SUPER_ADMIN);

    let activeRestId: string | undefined = undefined;
    if (user.activeRestaurantId) {
      const hasMem = activeMemberships.some((m) => m.restaurantId === user.activeRestaurantId);
      const restExists = db.restaurants?.some((r) => r.id === user.activeRestaurantId);
      if (restExists && (hasMem || isAdmin)) {
        activeRestId = user.activeRestaurantId;
      }
    }
    if (!activeRestId && activeMemberships.length > 0) {
      const candidateRest = db.restaurants?.find((r) => r.id === activeMemberships[0].restaurantId);
      if (candidateRest) {
        activeRestId = candidateRest.id;
      }
    }

    const activeRestaurant = activeRestId ? db.restaurants?.find((r) => r.id === activeRestId) : undefined;

    const jti = `sess_${CryptoEngine.generateSalt(24)}`;
    const token = CryptoEngine.signToken({
      userId: user.id,
      role: user.activeRole || user.role,
      email: user.email,
      restaurantId: activeRestId,
      sessionId: jti,
      jti,
    });

    const newSession: RefreshSessionEntity = {
      id: jti,
      sessionId: jti,
      userId: user.id,
      token,
      deviceInfo: 'Expo Mobile App (Demo Mode)',
      expiresAt: new Date(Date.now() + (dto.rememberMe ? 60 : 30) * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    db.sessions = db.sessions || [];
    db.sessions.unshift(newSession);
    db.activeUserId = user.id;

    await MloHubDB.save();

    return {
      user,
      customerProfile,
      memberships: activeMemberships,
      activeRestaurant,
      token,
    };
  }

  /**
   * Switch workspace in demo/test mode.
   */
  public static async switchWorkspace(
    currentToken: string,
    targetWorkspace: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN',
    restaurantId?: string
  ): Promise<AuthSessionResponse> {
    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();

    if (!currentToken || typeof currentToken !== 'string' || !currentToken.includes('.')) {
      throw new Error('401 Unauthorized: Valid session token is required to switch workspace.');
    }

    const verified = await this.verifySession(currentToken);
    if (!verified) {
      throw new Error('401 Unauthorized: Valid active session is required to switch workspace.');
    }

    const user = verified.user;
    const currentSession = db.sessions?.find((s) => s.token === currentToken);
    if (!currentSession) {
      throw new Error('401 Unauthorized: Stored session matching current token not found.');
    }

    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      throw new Error('403 Forbidden: Account is suspended or inactive.');
    }

    const userRoles = getUserRoles(user);
    const isAdmin = userRoles.includes(UserRole.ADMIN) || userRoles.includes(UserRole.SUPER_ADMIN);
    const activeMemberships = (db.restaurantMemberships || []).filter(
      (rm) => rm.userId === user.id && isMembershipActive(rm)
    );

    let targetRole = UserRole.CUSTOMER;
    let resolvedRestId: string | undefined = undefined;

    if (targetWorkspace === 'CUSTOMER') {
      targetRole = UserRole.CUSTOMER;
      resolvedRestId = undefined;
    } else if (targetWorkspace === 'RESTAURANT_OWNER') {
      if (!restaurantId) {
        if (activeMemberships.length === 0 && !isAdmin) {
          throw new Error('403 Forbidden: You do not have an active membership for any restaurant.');
        }
        resolvedRestId = activeMemberships.length > 0 ? activeMemberships[0].restaurantId : undefined;
      } else {
        const rest = db.restaurants?.find((r) => r.id === restaurantId);
        if (!rest) {
          throw new Error(`404 Not Found: Restaurant '${restaurantId}' does not exist.`);
        }
        const hasMembership = activeMemberships.some((m) => m.restaurantId === restaurantId);
        if (!hasMembership && !isAdmin) {
          throw new Error('403 Forbidden: You do not have an active membership for this restaurant.');
        }
        resolvedRestId = restaurantId;
      }

      if (!resolvedRestId && !isAdmin) {
        throw new Error('403 Forbidden: An authorized restaurant ID is required.');
      }

      targetRole = isAdmin
        ? userRoles.includes(UserRole.SUPER_ADMIN)
          ? UserRole.SUPER_ADMIN
          : UserRole.ADMIN
        : UserRole.RESTAURANT_OWNER;
    } else if (targetWorkspace === 'MLOHUB_ADMIN') {
      if (!isAdmin) {
        throw new Error('403 Forbidden: You do not have permission to access MloHub Administration.');
      }
      targetRole = userRoles.includes(UserRole.SUPER_ADMIN) ? UserRole.SUPER_ADMIN : UserRole.ADMIN;
      resolvedRestId = undefined;
    }

    // Invalidate the current session token being replaced
    db.sessions = (db.sessions || []).filter((s) => s.token !== currentSession.token);

    user.activeRole = targetRole;
    user.activeWorkspace = targetWorkspace;
    user.activeRestaurantId = resolvedRestId;
    user.updatedAt = new Date().toISOString();

    const jti = `sess_${CryptoEngine.generateSalt(24)}`;
    const token = CryptoEngine.signToken({
      userId: user.id,
      role: targetRole,
      email: user.email,
      restaurantId: resolvedRestId,
      sessionId: jti,
      jti,
    });

    const newSession: RefreshSessionEntity = {
      id: jti,
      sessionId: jti,
      userId: user.id,
      token,
      deviceInfo: currentSession.deviceInfo || 'Expo Mobile App (Demo Mode)',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.sessions = db.sessions || [];
    db.sessions.unshift(newSession);
    db.activeUserId = user.id;

    await MloHubDB.save();

    const customerProfile = db.customerProfiles?.find((cp) => cp.userId === user.id);
    const activeRestaurant = resolvedRestId ? db.restaurants?.find((r) => r.id === resolvedRestId) : undefined;

    return {
      user,
      customerProfile,
      memberships: activeMemberships,
      activeRestaurant,
      token,
    };
  }

  /**
   * Switch role context in demo/test mode.
   */
  public static async switchAccountContext(
    currentToken: string,
    targetRole: UserRole,
    restaurantId?: string
  ): Promise<AuthSessionResponse> {
    const ws: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN' =
      targetRole === UserRole.ADMIN || targetRole === UserRole.SUPER_ADMIN
        ? 'MLOHUB_ADMIN'
        : targetRole === UserRole.RESTAURANT_OWNER || targetRole === UserRole.RESTAURANT_STAFF
        ? 'RESTAURANT_OWNER'
        : 'CUSTOMER';
    return this.switchWorkspace(currentToken, ws, restaurantId);
  }

  /**
   * Logout session in demo/test mode.
   */
  public static async logout(token: string): Promise<boolean> {
    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();
    if (db.sessions) {
      db.sessions = db.sessions.filter((s) => s.token !== token);
    }
    db.activeUserId = undefined;
    await MloHubDB.save();
    return true;
  }

  /**
   * Verify session in demo/test mode.
   */
  public static async verifySession(token: string): Promise<AuthSessionResponse | null> {
    if (!token || typeof token !== 'string') return null;
    const payload = CryptoEngine.verifyToken(token);
    if (!payload || !payload.userId) return null;

    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
      return null;
    }

    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();

    const sessionRecord = db.sessions?.find((s) => s.token === token);
    if (!sessionRecord) return null;

    if (sessionRecord.userId !== payload.userId) return null;

    const sessionExpiryMs = new Date(sessionRecord.expiresAt).getTime();
    if (isNaN(sessionExpiryMs) || !Number.isFinite(sessionExpiryMs) || sessionExpiryMs <= Date.now()) {
      return null;
    }

    const user = db.users?.find((u) => u.id === payload.userId);
    if (!user || user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      return null;
    }

    const userMemberships = db.restaurantMemberships?.filter((rm) => rm.userId === user.id) || [];
    const activeMemberships = userMemberships.filter((m) => isMembershipActive(m));

    const userRoles = getUserRoles(user);
    const isAdmin = userRoles.includes(UserRole.ADMIN) || userRoles.includes(UserRole.SUPER_ADMIN);

    if (payload.role) {
      if (payload.role === UserRole.ADMIN || payload.role === UserRole.SUPER_ADMIN) {
        if (!isAdmin) {
          return null;
        }
      } else if (payload.role === UserRole.RESTAURANT_OWNER) {
        const hasOwnerRole = userRoles.includes(UserRole.RESTAURANT_OWNER);
        const hasOwnerMembership = activeMemberships.some((m) => m.role === 'OWNER' || m.isPrimaryOwner);
        if (!hasOwnerRole && !hasOwnerMembership && !isAdmin) {
          return null;
        }
      } else if (payload.role === UserRole.RESTAURANT_STAFF) {
        const hasStaffRole = userRoles.includes(UserRole.RESTAURANT_STAFF);
        if (!hasStaffRole && activeMemberships.length === 0 && !isAdmin) {
          return null;
        }
      }
    }

    let activeRestaurant: RestaurantEntity | undefined = undefined;
    const targetRestId = payload.restaurantId;

    if (targetRestId) {
      const rest = db.restaurants?.find((r) => r.id === targetRestId);
      if (!rest) return null;
      const mem = activeMemberships.find((m) => m.restaurantId === targetRestId);
      if (!mem && !isAdmin) return null;
      activeRestaurant = rest;
    }

    const customerProfile = db.customerProfiles?.find((cp) => cp.userId === user.id);

    return {
      user,
      customerProfile,
      memberships: activeMemberships,
      activeRestaurant,
      token,
    };
  }

  /**
   * Bootstrap session in demo/test mode.
   */
  public static async bootstrapSession(): Promise<AuthSessionResponse | null> {
    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();
    const activeUserId = db.activeUserId;
    if (!activeUserId) return null;

    const session = db.sessions?.find(
      (s) => s.userId === activeUserId && new Date(s.expiresAt).getTime() > Date.now()
    );
    if (!session || !session.token) {
      db.activeUserId = undefined;
      await MloHubDB.save();
      return null;
    }

    const verified = await this.verifySession(session.token);
    if (!verified) {
      db.activeUserId = undefined;
      db.sessions = (db.sessions || []).filter((s) => s.token !== session.token);
      await MloHubDB.save();
      return null;
    }

    return verified;
  }
}
