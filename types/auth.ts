import { UserRole } from '../db/types';

export type PlatformRole = 'CUSTOMER' | 'RESTAURANT' | 'ADMIN' | 'SUPER_ADMIN';

export type AccountType = PlatformRole;

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

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  accountType: AccountType;
  role: UserRole;
  roles: UserRole[];
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  preferredLanguage?: 'en' | 'sw';
  language?: 'en' | 'sw';
  avatarUrl?: string;
  avatarEmoji?: string;
  securityPin?: string;
  passwordHash?: string;
  location?: string;
  deliveryAddress?: string;
  neighborhood?: string;
  companyOrGroup?: string;
  dietaryPreferences?: string[];
  isPhoneVerified?: boolean;
  activeRestaurantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestaurantMemberRecord {
  id: string;
  userId: string;
  restaurantId: string;
  role: RestaurantRole;
  status: 'ACTIVE' | 'PENDING' | 'REVOKED' | 'SUSPENDED';
  permissions?: string[];
  isPrimaryOwner?: boolean;
  restaurantName?: string;
  createdAt?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  isPhoneVerified?: boolean;
  accountType: AccountType;
  role: UserRole;
  roles: UserRole[];
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  avatarUrl?: string;
  avatarEmoji?: string;
  securityPin?: string;
  passwordHash?: string;
  language?: 'en' | 'sw';
  location?: string;
  companyOrGroup?: string;
  dietaryPreferences?: string[];
  restaurantMemberships: RestaurantMemberRecord[];
  activeRestaurantId?: string;
  activeRole?: UserRole;
  activeWorkspace?: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN';
  createdAt?: string;
  updatedAt?: string;
}

