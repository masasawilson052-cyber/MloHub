import { UserRole, RestaurantMembershipEntity } from '../types';
import { CryptoEngine } from './crypto';
import { MloHubDB } from '../index';

export interface GuardAuthResult {
  isAuthenticated: boolean;
  userId?: string;
  role?: UserRole;
  email?: string;
  restaurantId?: string;
  error?: string;
  statusCode?: number;
}

export const AuthGuards = {
  /**
   * Validates that the request has a valid, non-expired authentication token.
   */
  requireAuth: (token?: string): GuardAuthResult => {
    if (!token) {
      return {
        isAuthenticated: false,
        error: '401 Unauthorized: Authentication token required.',
        statusCode: 401,
      };
    }

    const payload = CryptoEngine.verifyToken(token);
    if (!payload) {
      return {
        isAuthenticated: false,
        error: '401 Unauthorized: Invalid or expired session token.',
        statusCode: 401,
      };
    }

    return {
      isAuthenticated: true,
      userId: payload.userId,
      role: payload.role as UserRole,
      email: payload.email,
      restaurantId: payload.restaurantId,
    };
  },

  /**
   * Validates that the user has one of the required roles.
   */
  requireRole: (token: string | undefined, allowedRoles: UserRole[]): GuardAuthResult => {
    const auth = AuthGuards.requireAuth(token);
    if (!auth.isAuthenticated) return auth;

    if (!auth.role || !allowedRoles.includes(auth.role)) {
      return {
        isAuthenticated: false,
        userId: auth.userId,
        role: auth.role,
        error: `403 Forbidden: Insufficient permissions for role '${auth.role}'. Required: ${allowedRoles.join(', ')}`,
        statusCode: 403,
      };
    }

    return auth;
  },

  /**
   * Validates that the authenticated user belongs to the target restaurant
   * and optionally holds specific permissions.
   */
  requireRestaurantMembership: (
    token: string | undefined,
    restaurantId: string,
    requiredPermissions?: string[]
  ): GuardAuthResult => {
    const auth = AuthGuards.requireRole(token, [
      UserRole.RESTAURANT_OWNER,
      UserRole.RESTAURANT_STAFF,
      UserRole.ADMIN,
    ]);
    if (!auth.isAuthenticated) return auth;

    const db = MloHubDB.getSnapshot();
    const membership = db.restaurantMemberships?.find(
      (rm) => rm.userId === auth.userId && rm.restaurantId === restaurantId
    );

    // Admin bypass
    if (auth.role === UserRole.ADMIN) {
      return auth;
    }

    if (!membership) {
      return {
        isAuthenticated: false,
        userId: auth.userId,
        role: auth.role,
        error: `403 Forbidden: You do not have access to restaurant '${restaurantId}'.`,
        statusCode: 403,
      };
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAll = requiredPermissions.every((p) => membership.permissions.includes(p));
      if (!hasAll) {
        return {
          isAuthenticated: false,
          userId: auth.userId,
          role: auth.role,
          error: `403 Forbidden: Missing required restaurant permission(s): ${requiredPermissions.join(', ')}`,
          statusCode: 403,
        };
      }
    }

    return auth;
  },

  /**
   * Validates that the user is the primary owner of the target restaurant.
   */
  requireRestaurantOwnership: (token: string | undefined, restaurantId: string): GuardAuthResult => {
    const auth = AuthGuards.requireRole(token, [UserRole.RESTAURANT_OWNER, UserRole.ADMIN]);
    if (!auth.isAuthenticated) return auth;

    if (auth.role === UserRole.ADMIN) return auth;

    const db = MloHubDB.getSnapshot();
    const restaurant = db.restaurants.find((r) => r.id === restaurantId);

    if (!restaurant) {
      return {
        isAuthenticated: false,
        error: '404 Not Found: Restaurant not found.',
        statusCode: 404,
      };
    }

    if (restaurant.ownerId !== auth.userId) {
      return {
        isAuthenticated: false,
        userId: auth.userId,
        role: auth.role,
        error: '403 Forbidden: Only the verified owner can perform this operation.',
        statusCode: 403,
      };
    }

    return auth;
  },
};
