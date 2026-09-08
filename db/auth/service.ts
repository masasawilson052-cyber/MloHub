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
} from '../types';
import { CryptoEngine } from './crypto';
import { MloHubDB } from '../index';

// Rate Limiter tracking (in-memory per client)
const loginAttempts: { [key: string]: { count: number; lastAttempt: number } } = {};
const RATE_LIMIT_MAX = 6;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = loginAttempts[key];
  if (!record) {
    loginAttempts[key] = { count: 1, lastAttempt: now };
    return true;
  }
  if (now - record.lastAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts[key] = { count: 1, lastAttempt: now };
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  record.count++;
  record.lastAttempt = now;
  return true;
}

export const AuthService = {
  /**
   * Register a new Customer Account
   */
  async registerCustomer(dto: RegisterCustomerDTO): Promise<AuthSessionResponse> {
    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();

    // Validation
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

    // Check duplicate email or phone
    const existingEmail = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existingEmail) {
      throw new Error('An account with this email address already exists.');
    }
    const existingPhone = db.users.find((u) => u.phone === cleanPhone);
    if (existingPhone) {
      throw new Error('An account with this phone number already exists.');
    }

    // Create User
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

    // Create Customer Profile
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

    // Issue Token
    const token = CryptoEngine.signToken({
      userId,
      role: UserRole.CUSTOMER,
      email: cleanEmail,
    });

    // Create Session
    const newSession: RefreshSessionEntity = {
      id: `sess-${Date.now()}`,
      userId,
      token,
      deviceInfo: 'Expo Mobile App',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
    };

    // Save to Database
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
  },

  /**
   * Register a new Restaurant & Owner Account (Multi-step)
   */
  async registerRestaurant(dto: RegisterRestaurantDTO): Promise<AuthSessionResponse> {
    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();

    // 1. Owner Validation
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

    // 2. Restaurant Validation
    const cleanRestName = dto.restaurantName.trim();
    if (!cleanRestName) throw new Error('Restaurant name is required.');
    if (!dto.cuisine.trim()) throw new Error('Cuisine / Category is required.');
    if (!dto.address.trim()) throw new Error('Physical restaurant address is required.');
    if (!dto.agreeTerms) throw new Error('You must agree to the Merchant Terms of Service.');

    // Duplicate check
    if (db.users.some((u) => u.email.toLowerCase() === cleanOwnerEmail)) {
      throw new Error('An account with this email already exists.');
    }

    const now = new Date().toISOString();
    const userId = `usr-chef-${Date.now()}`;
    const restaurantId = `rest-${cleanRestName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;

    // Create Owner User
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

    // Create Restaurant Entity (with PENDING_VERIFICATION)
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

    // Create Restaurant Membership
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

    // Issue Token
    const token = CryptoEngine.signToken({
      userId,
      role: UserRole.RESTAURANT_OWNER,
      email: cleanOwnerEmail,
      restaurantId,
    });

    // Create Session
    const newSession: RefreshSessionEntity = {
      id: `sess-${Date.now()}`,
      userId,
      token,
      deviceInfo: 'Expo Mobile App (Merchant Portal)',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
    };

    // Save to Database
    db.users.unshift(newOwner);
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
  },

  /**
   * Unified Shared Login for all Account Types
   */
  async login(dto: LoginDTO): Promise<AuthSessionResponse> {
    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();

    const cleanInput = dto.emailOrPhone.trim().toLowerCase();
    if (!cleanInput) {
      throw new Error('Please enter your email or phone number.');
    }
    if (!dto.password) {
      throw new Error('Please enter your password.');
    }

    // Rate Limiter
    if (!checkRateLimit(cleanInput)) {
      throw new Error('Too many login attempts. Please wait 1 minute before trying again.');
    }

    // Find User by email or phone
    const user = db.users.find(
      (u) => u.email.toLowerCase() === cleanInput || u.phone.replace(/[\s-]/g, '') === cleanInput.replace(/[\s-]/g, '')
    );

    if (!user) {
      // Avoid revealing account existence
      throw new Error('Invalid email/phone or password. Please check your credentials.');
    }

    // Verify Password
    const isValid = CryptoEngine.verifyPassword(dto.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email/phone or password. Please check your credentials.');
    }

    // Resolve Customer Profile & Memberships
    const customerProfile = db.customerProfiles?.find((cp) => cp.userId === user.id);
    const memberships = db.restaurantMemberships?.filter((rm) => rm.userId === user.id) || [];
    const activeRestId = user.activeRestaurantId || (memberships.length > 0 ? memberships[0].restaurantId : undefined);
    const activeRestaurant = activeRestId ? db.restaurants.find((r) => r.id === activeRestId) : undefined;

    // Issue Token
    const token = CryptoEngine.signToken({
      userId: user.id,
      role: user.activeRole || user.role,
      email: user.email,
      restaurantId: activeRestId,
    });

    // Store Session
    const newSession: RefreshSessionEntity = {
      id: `sess-${Date.now()}`,
      userId: user.id,
      token,
      deviceInfo: 'Expo Mobile App',
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
      memberships,
      activeRestaurant,
      token,
    };
  },

  /**
   * Get list of authorized workspaces for a user based on verified roles and memberships
   */
  async getAuthorizedWorkspaces(userId: string): Promise<{
    type: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN';
    name: string;
    subtitle: string;
    icon: string;
    role: UserRole;
    restaurantId?: string;
  }[]> {
    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();

    const user = db.users.find((u) => u.id === userId);
    if (!user) return [];

    const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
    const workspaces: {
      type: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN';
      name: string;
      subtitle: string;
      icon: string;
      role: UserRole;
      restaurantId?: string;
    }[] = [];

    // 1. Personal Account — Customer (always available to valid users)
    workspaces.push({
      type: 'CUSTOMER',
      name: 'Personal Account',
      subtitle: 'Customer',
      icon: 'person-circle',
      role: UserRole.CUSTOMER,
    });

    // 2. Restaurant Owner Workspaces (only for verified active restaurant memberships)
    const memberships = db.restaurantMemberships?.filter(
      (rm) => rm.userId === userId && (!rm.status || rm.status === 'ACTIVE')
    ) || [];

    for (const mem of memberships) {
      const rest = db.restaurants.find((r) => r.id === mem.restaurantId);
      if (rest) {
        workspaces.push({
          type: 'RESTAURANT_OWNER',
          name: rest.name,
          subtitle: 'Restaurant Owner',
          icon: 'restaurant',
          role: UserRole.RESTAURANT_OWNER,
          restaurantId: rest.id,
        });
      }
    }

    // 3. MloHub Administration (ONLY if user has ADMIN or SUPER_ADMIN role)
    const isAdmin = userRoles.includes(UserRole.ADMIN) || userRoles.includes(UserRole.SUPER_ADMIN);
    if (isAdmin) {
      const isSuper = userRoles.includes(UserRole.SUPER_ADMIN);
      workspaces.push({
        type: 'MLOHUB_ADMIN',
        name: 'MloHub Administration',
        subtitle: isSuper ? 'Super Admin' : 'Admin',
        icon: 'shield-checkmark',
        role: isSuper ? UserRole.SUPER_ADMIN : UserRole.ADMIN,
      });
    }

    return workspaces;
  },

  /**
   * Switch Context between authorized workspaces with strict server-side validation
   */
  async switchWorkspace(
    userId: string,
    targetWorkspace: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN',
    restaurantId?: string
  ): Promise<AuthSessionResponse> {
    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();

    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error('404 Not Found: User account not found.');
    }

    const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
    const memberships = db.restaurantMemberships?.filter(
      (rm) => rm.userId === userId && (!rm.status || rm.status === 'ACTIVE')
    ) || [];

    let targetRole = UserRole.CUSTOMER;
    let resolvedRestId: string | undefined = undefined;

    if (targetWorkspace === 'CUSTOMER') {
      targetRole = UserRole.CUSTOMER;
      resolvedRestId = undefined;
    } else if (targetWorkspace === 'RESTAURANT_OWNER') {
      // Must have membership for requested restaurant
      const targetMem = restaurantId
        ? memberships.find((m) => m.restaurantId === restaurantId)
        : memberships[0];

      if (!targetMem && !userRoles.includes(UserRole.RESTAURANT_OWNER)) {
        throw new Error('403 Forbidden: You do not have permission to access this restaurant workspace.');
      }

      targetRole = UserRole.RESTAURANT_OWNER;
      resolvedRestId = targetMem ? targetMem.restaurantId : restaurantId || user.activeRestaurantId;
    } else if (targetWorkspace === 'MLOHUB_ADMIN') {
      const isAdmin = userRoles.includes(UserRole.ADMIN) || userRoles.includes(UserRole.SUPER_ADMIN);
      if (!isAdmin) {
        throw new Error('403 Forbidden: You do not have permission to access MloHub Administration.');
      }
      targetRole = userRoles.includes(UserRole.SUPER_ADMIN) ? UserRole.SUPER_ADMIN : UserRole.ADMIN;
      resolvedRestId = undefined;
    }

    // Update user state
    user.activeRole = targetRole;
    user.activeWorkspace = targetWorkspace;
    user.activeRestaurantId = resolvedRestId;
    user.updatedAt = new Date().toISOString();

    const token = CryptoEngine.signToken({
      userId: user.id,
      role: targetRole,
      email: user.email,
      restaurantId: resolvedRestId,
    });

    await MloHubDB.save();

    const customerProfile = db.customerProfiles?.find((cp) => cp.userId === user.id);
    const activeRestaurant = resolvedRestId ? db.restaurants.find((r) => r.id === resolvedRestId) : undefined;

    return {
      user,
      customerProfile,
      memberships,
      activeRestaurant,
      token,
    };
  },

  /**
   * Switch Context between Customer and Restaurant Owner without re-login (Legacy support)
   */
  async switchAccountContext(
    userId: string,
    targetRole: UserRole,
    restaurantId?: string
  ): Promise<AuthSessionResponse> {
    const ws: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN' =
      targetRole === UserRole.ADMIN || targetRole === UserRole.SUPER_ADMIN
        ? 'MLOHUB_ADMIN'
        : targetRole === UserRole.RESTAURANT_OWNER || targetRole === UserRole.RESTAURANT_STAFF
        ? 'RESTAURANT_OWNER'
        : 'CUSTOMER';
    return this.switchWorkspace(userId, ws, restaurantId);
  },

  /**
   * Logout current session
   */
  async logout(token: string): Promise<boolean> {
    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();

    if (db.sessions) {
      db.sessions = db.sessions.filter((s) => s.token !== token);
      await MloHubDB.save();
    }
    return true;
  },

  /**
   * Bootstrap session from active session token
   */
  async bootstrapSession(): Promise<AuthSessionResponse | null> {
    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();
    if (!db.activeUserId) return null;
    const session = db.sessions?.find((s) => s.userId === db.activeUserId);
    if (!session) return null;
    return this.verifySession(session.token);
  },

  /**
   * Verify token and restore session
   */
  async verifySession(token: string): Promise<AuthSessionResponse | null> {
    const payload = CryptoEngine.verifyToken(token);
    if (!payload) return null;

    await MloHubDB.init();
    const db = MloHubDB.getSnapshot();

    const user = db.users.find((u) => u.id === payload.userId);
    if (!user) return null;

    const customerProfile = db.customerProfiles?.find((cp) => cp.userId === user.id);
    const memberships = db.restaurantMemberships?.filter((rm) => rm.userId === user.id) || [];
    const activeRestaurant = payload.restaurantId
      ? db.restaurants.find((r) => r.id === payload.restaurantId)
      : user.activeRestaurantId
      ? db.restaurants.find((r) => r.id === user.activeRestaurantId)
      : undefined;

    return {
      user,
      customerProfile,
      memberships,
      activeRestaurant,
      token,
    };
  },
};
