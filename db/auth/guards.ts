import {
  UserRole,
  RestaurantMembershipEntity,
  RestaurantEntity,
  UserEntity,
  CustomMealRequestEntity,
  isMembershipActive,
  getUserRoles,
} from '../types';
import { RestaurantRole, RestaurantPermission } from '../../types/auth';
import { CryptoEngine } from './crypto';
import { runtimeConfig } from '../../lib/runtimeConfig';

export interface GuardAuthResult {
  isAuthenticated: boolean;
  userId?: string;
  role?: UserRole;
  email?: string;
  restaurantId?: string;
  error?: string;
  statusCode?: number;
}

export interface RoleAuthorizationResult {
  isAuthorized: boolean;
  error?: string;
  statusCode?: number;
}

/**
 * Shared Role Authorization Policy
 * Evaluates whether a user's current account state entitles them to a requested role or workspace.
 * Real Supabase authoritative; demo fallbacks isolated.
 */
export function authorizeAccountRole(
  user: UserEntity,
  targetRole: UserRole,
  restaurantId?: string,
  requiredPermissions?: string[],
  memberships?: RestaurantMembershipEntity[],
  restaurants?: RestaurantEntity[]
): RoleAuthorizationResult {
  if (!user) {
    return { isAuthorized: false, statusCode: 401, error: '401 Unauthorized: User account required.' };
  }

  if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
    return { isAuthorized: false, statusCode: 403, error: '403 Forbidden: Account is suspended or inactive.' };
  }

  // 1. CUSTOMER workspace is always available to all active users
  if (targetRole === UserRole.CUSTOMER) {
    return { isAuthorized: true };
  }

  const currentRoles = getUserRoles(user);
  const isAdmin = currentRoles.includes(UserRole.ADMIN) || currentRoles.includes(UserRole.SUPER_ADMIN);

  // 2. ADMIN and SUPER_ADMIN claims must be backed by current account roles
  if (targetRole === UserRole.ADMIN || targetRole === UserRole.SUPER_ADMIN) {
    if (!isAdmin) {
      return {
        isAuthorized: false,
        statusCode: 403,
        error: '403 Forbidden: Administrator privileges have been revoked for this account.',
      };
    }
    return { isAuthorized: true };
  }

  // 3. RESTAURANT_OWNER and RESTAURANT_STAFF claims
  if (targetRole === UserRole.RESTAURANT_OWNER || targetRole === UserRole.RESTAURANT_STAFF) {
    if (isAdmin) {
      // Platform admins hold elevated management access
      return { isAuthorized: true };
    }

    let userMemberships = memberships || (user as any).restaurantMemberships;
    let availableRestaurants = restaurants;

    if (!userMemberships && runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      const db = DemoAuthAdapter.getSnapshot();
      userMemberships = (db.restaurantMemberships || []).filter(
        (m: any) => m.userId === user.id && isMembershipActive(m)
      );
      if (!availableRestaurants) {
        availableRestaurants = db.restaurants;
      }
    } else if (!userMemberships) {
      userMemberships = [];
    }

    const activeMems = (userMemberships || []).filter((m: any) => isMembershipActive(m));

    if (activeMems.length === 0) {
      return {
        isAuthorized: false,
        statusCode: 403,
        error: '403 Forbidden: Account has no active restaurant memberships.',
      };
    }

    if (restaurantId) {
      if (availableRestaurants && availableRestaurants.length > 0) {
        const rest = availableRestaurants.find((r: any) => r.id === restaurantId);
        if (!rest) {
          return {
            isAuthorized: false,
            statusCode: 404,
            error: `404 Not Found: Restaurant '${restaurantId}' does not exist.`,
          };
        }
      }

      const mem = activeMems.find((m: any) => m.restaurantId === restaurantId);
      if (!mem) {
        return {
          isAuthorized: false,
          statusCode: 403,
          error: `403 Forbidden: No active membership for restaurant '${restaurantId}'.`,
        };
      }

      // Staff membership must not automatically grant owner-only privileges
      if (targetRole === UserRole.RESTAURANT_OWNER) {
        const isOwner = mem.role === 'OWNER' || mem.isPrimaryOwner;
        const ownsRestaurant = availableRestaurants?.some((r: any) => r.id === restaurantId && r.ownerId === user.id);
        if (!isOwner && !ownsRestaurant) {
          return {
            isAuthorized: false,
            statusCode: 403,
            error: '403 Forbidden: Staff membership does not grant restaurant owner privileges.',
          };
        }
      }

      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasAll = requiredPermissions.every((p) => mem.permissions && mem.permissions.includes(p));
        if (!hasAll) {
          return {
            isAuthorized: false,
            statusCode: 403,
            error: `403 Forbidden: Missing required restaurant permission(s): ${requiredPermissions.join(', ')}`,
          };
        }
      }
    } else {
      if (targetRole === UserRole.RESTAURANT_OWNER) {
        const hasOwnerMem = activeMems.some(
          (m: any) =>
            m.role === 'OWNER' ||
            m.isPrimaryOwner ||
            (availableRestaurants && availableRestaurants.some((r: any) => r.id === m.restaurantId && r.ownerId === user.id))
        );
        if (!hasOwnerMem) {
          return {
            isAuthorized: false,
            statusCode: 403,
            error: '403 Forbidden: Staff membership does not grant restaurant owner privileges.',
          };
        }
      }
    }

    return { isAuthorized: true };
  }

  return { isAuthorized: false, statusCode: 403, error: `403 Forbidden: Unknown role '${targetRole}'.` };
}

export const AuthGuards = {
  /**
   * Validates that the request has a valid, non-expired authentication token matching an active session and active account.
   */
  requireAuth: (token?: string): GuardAuthResult => {
    if (!token || typeof token !== 'string') {
      return {
        isAuthenticated: false,
        error: '401 Unauthorized: Authentication token required.',
        statusCode: 401,
      };
    }

    const payload = CryptoEngine.verifyToken(token);
    if (!payload || !payload.userId) {
      return {
        isAuthenticated: false,
        error: '401 Unauthorized: Invalid or expired session token.',
        statusCode: 401,
      };
    }

    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
      return {
        isAuthenticated: false,
        error: '401 Unauthorized: Session token has expired.',
        statusCode: 401,
      };
    }

    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      const db = DemoAuthAdapter.getSnapshot();

      // 1. Matching stored session record must exist
      const sessionRecord = db.sessions?.find((s: any) => s.token === token);
      if (!sessionRecord) {
        return {
          isAuthenticated: false,
          error: '401 Unauthorized: Stored session record not found or revoked.',
          statusCode: 401,
        };
      }

      // 2. Stored session user ID must match token user ID
      if (sessionRecord.userId !== payload.userId) {
        return {
          isAuthenticated: false,
          error: '401 Unauthorized: Session user mismatch.',
          statusCode: 401,
        };
      }

      // 3. Stored-session expiry must be valid and unexpired
      const sessionExpiryMs = new Date(sessionRecord.expiresAt).getTime();
      if (isNaN(sessionExpiryMs) || !Number.isFinite(sessionExpiryMs) || sessionExpiryMs <= Date.now()) {
        return {
          isAuthenticated: false,
          error: '401 Unauthorized: Stored session has expired.',
          statusCode: 401,
        };
      }

      // 4. User account must exist in database
      const user = db.users?.find((u: any) => u.id === payload.userId);
      if (!user) {
        return {
          isAuthenticated: false,
          error: '401 Unauthorized: User account does not exist.',
          statusCode: 401,
        };
      }

      // 5. Account must not be suspended or inactive
      if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
        return {
          isAuthenticated: false,
          userId: user.id,
          role: payload.role as UserRole,
          error: '403 Forbidden: Account is suspended or inactive.',
          statusCode: 403,
        };
      }

      // 6. Confirm current account holds entitlement to the role/workspace claimed by the token
      const tokenRole = (payload.role as UserRole) || UserRole.CUSTOMER;
      const roleAuth = authorizeAccountRole(user, tokenRole, payload.restaurantId);
      if (!roleAuth.isAuthorized) {
        return {
          isAuthenticated: false,
          userId: user.id,
          role: tokenRole,
          error: roleAuth.error || '403 Forbidden: Account is not entitled to this role.',
          statusCode: roleAuth.statusCode || 403,
        };
      }

      return {
        isAuthenticated: true,
        userId: payload.userId,
        role: tokenRole,
        email: payload.email,
        restaurantId: payload.restaurantId,
      };
    }

    // Production Mode: Token verified via Cryptographic Signature & Expiry
    return {
      isAuthenticated: true,
      userId: payload.userId,
      role: (payload.role as UserRole) || UserRole.CUSTOMER,
      email: payload.email,
      restaurantId: payload.restaurantId,
    };
  },

  /**
   * Validates that the user has one of the required roles and holds current account entitlement.
   */
  requireRole: (
    token: string | undefined,
    allowedRoles: UserRole[],
    restaurantId?: string,
    requiredPermissions?: string[]
  ): GuardAuthResult => {
    const auth = AuthGuards.requireAuth(token);
    if (!auth.isAuthenticated || !auth.userId) return auth;

    if (!auth.role || !allowedRoles.includes(auth.role)) {
      return {
        isAuthenticated: false,
        userId: auth.userId,
        role: auth.role,
        error: `403 Forbidden: Insufficient permissions for role '${auth.role}'. Required: ${allowedRoles.join(', ')}`,
        statusCode: 403,
      };
    }

    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      const db = DemoAuthAdapter.getSnapshot();
      const user = db.users?.find((u: any) => u.id === auth.userId);
      if (!user) {
        return { isAuthenticated: false, error: '401 Unauthorized: User account not found.', statusCode: 401 };
      }

      const entitlementCheck = authorizeAccountRole(user, auth.role, restaurantId, requiredPermissions);
      if (!entitlementCheck.isAuthorized) {
        return {
          isAuthenticated: false,
          userId: auth.userId,
          role: auth.role,
          error: entitlementCheck.error || `403 Forbidden: Insufficient permissions.`,
          statusCode: entitlementCheck.statusCode || 403,
        };
      }
    }

    return auth;
  },

  /**
   * Validates that the authenticated user belongs to the target restaurant
   * and holds an active, non-revoked membership.
   */
  requireRestaurantMembership: (
    token: string | undefined,
    restaurantId: string,
    requiredPermissions?: string[]
  ): GuardAuthResult => {
    const auth = AuthGuards.requireAuth(token);
    if (!auth.isAuthenticated || !auth.userId) return auth;

    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      const db = DemoAuthAdapter.getSnapshot();
      const user = db.users?.find((u: any) => u.id === auth.userId);
      if (!user) {
        return { isAuthenticated: false, error: '401 Unauthorized: User account not found.', statusCode: 401 };
      }

      const currentRoles = getUserRoles(user);
      const isAdmin = currentRoles.includes(UserRole.ADMIN) || currentRoles.includes(UserRole.SUPER_ADMIN);
      if (isAdmin) return auth;

      const rest = db.restaurants?.find((r: any) => r.id === restaurantId);
      if (!rest) {
        return {
          isAuthenticated: false,
          userId: auth.userId,
          role: auth.role,
          error: `404 Not Found: Restaurant '${restaurantId}' does not exist.`,
          statusCode: 404,
        };
      }

      const mem = db.restaurantMemberships?.find(
        (m: any) => m.userId === user.id && m.restaurantId === restaurantId
      );

      if (!mem || !isMembershipActive(mem)) {
        return {
          isAuthenticated: false,
          userId: auth.userId,
          role: auth.role,
          error: `403 Forbidden: You do not have an active membership for restaurant '${restaurantId}'.`,
          statusCode: 403,
        };
      }

      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasAll = requiredPermissions.every((p) => mem.permissions && mem.permissions.includes(p));
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
    }

    return auth;
  },

  /**
   * Requires verified ownership over a restaurant.
   * Staff memberships are explicitly disallowed from owner-only operations.
   */
  requireRestaurantOwner: (token: string | undefined, restaurantId: string): GuardAuthResult => {
    const auth = AuthGuards.requireRole(
      token,
      [UserRole.RESTAURANT_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN],
      restaurantId
    );
    if (!auth.isAuthenticated || !auth.userId) return auth;

    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      const db = DemoAuthAdapter.getSnapshot();
      const user = db.users?.find((u: any) => u.id === auth.userId);
      const currentRoles = user ? getUserRoles(user) : [];
      const isAdmin = currentRoles.includes(UserRole.ADMIN) || currentRoles.includes(UserRole.SUPER_ADMIN);
      if (isAdmin) return auth;

      const restaurant = db.restaurants?.find((r: any) => r.id === restaurantId);
      if (!restaurant) {
        return {
          isAuthenticated: false,
          error: '404 Not Found: Restaurant not found.',
          statusCode: 404,
        };
      }

      const membership = db.restaurantMemberships?.find(
        (rm: any) => rm.userId === auth.userId && rm.restaurantId === restaurantId
      );

      if (
        !membership ||
        !isMembershipActive(membership) ||
        (membership.role !== 'OWNER' && !membership.isPrimaryOwner && restaurant.ownerId !== auth.userId)
      ) {
        return {
          isAuthenticated: false,
          userId: auth.userId,
          role: auth.role,
          error: '403 Forbidden: Only the verified owner can perform this operation.',
          statusCode: 403,
        };
      }
    }

    return auth;
  },

  /**
   * Requires a specific canonical restaurant role (OWNER, MANAGER, CHEF, STAFF)
   */
  requireRestaurantRole: (
    token: string | undefined,
    restaurantId: string,
    allowedRoles: RestaurantRole[]
  ): GuardAuthResult => {
    const auth = AuthGuards.requireRestaurantMembership(token, restaurantId);
    if (!auth.isAuthenticated || !auth.userId) return auth;

    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      const db = DemoAuthAdapter.getSnapshot();
      const user = db.users?.find((u: any) => u.id === auth.userId);
      const currentRoles = user ? getUserRoles(user) : [];
      const isAdmin = currentRoles.includes(UserRole.ADMIN) || currentRoles.includes(UserRole.SUPER_ADMIN);
      if (isAdmin) return auth;

      const mem = db.restaurantMemberships?.find(
        (rm: any) => rm.userId === auth.userId && rm.restaurantId === restaurantId
      );

      if (!mem || !allowedRoles.includes(mem.role as RestaurantRole)) {
        return {
          isAuthenticated: false,
          userId: auth.userId,
          error: `403 Forbidden: Operation requires one of the following roles: ${allowedRoles.join(', ')}.`,
          statusCode: 403,
        };
      }
    }

    return auth;
  },

  /**
   * Requires a specific granular restaurant permission
   */
  requireRestaurantPermission: (
    token: string | undefined,
    restaurantId: string,
    permission: RestaurantPermission
  ): GuardAuthResult => {
    const auth = AuthGuards.requireRestaurantMembership(token, restaurantId);
    if (!auth.isAuthenticated || !auth.userId) return auth;

    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      const db = DemoAuthAdapter.getSnapshot();
      const user = db.users?.find((u: any) => u.id === auth.userId);
      const currentRoles = user ? getUserRoles(user) : [];
      const isAdmin = currentRoles.includes(UserRole.ADMIN) || currentRoles.includes(UserRole.SUPER_ADMIN);
      if (isAdmin) return auth;

      const mem = db.restaurantMemberships?.find(
        (rm: any) => rm.userId === auth.userId && rm.restaurantId === restaurantId
      );

      if (!mem) {
        return {
          isAuthenticated: false,
          userId: auth.userId,
          error: '403 Forbidden: No active membership found for this restaurant.',
          statusCode: 403,
        };
      }

      if (mem.role === 'OWNER' || mem.isPrimaryOwner) return auth;

      if (mem.role === 'MANAGER') {
        const managerDefaults = [
          'VIEW_DASHBOARD',
          'VIEW_ORDERS',
          'MANAGE_ORDERS',
          'VIEW_MENU',
          'MANAGE_MENU',
          'VERIFY_MENU',
          'VIEW_RESERVATIONS',
          'MANAGE_RESERVATIONS',
          'VIEW_REVIEWS',
          'VIEW_ANALYTICS',
          'VIEW_EARNINGS',
        ];
        if (managerDefaults.includes(permission) || (mem.permissions && mem.permissions.includes(permission))) {
          return auth;
        }
      }

      if (mem.role === 'CHEF') {
        const chefDefaults = ['VIEW_DASHBOARD', 'VIEW_ORDERS', 'MANAGE_ORDERS', 'VIEW_MENU', 'VIEW_RESERVATIONS'];
        if (chefDefaults.includes(permission) || (mem.permissions && mem.permissions.includes(permission))) {
          return auth;
        }
      }

      if (mem.role === 'STAFF') {
        const staffDefaults = ['VIEW_DASHBOARD', 'VIEW_ORDERS', 'VIEW_MENU', 'VIEW_RESERVATIONS'];
        if (staffDefaults.includes(permission) || (mem.permissions && mem.permissions.includes(permission))) {
          return auth;
        }
      }

      return {
        isAuthenticated: false,
        userId: auth.userId,
        error: `403 Forbidden: Missing required restaurant permission: ${permission}.`,
        statusCode: 403,
      };
    }

    return auth;
  },
};

export interface PortalAccessResolution {
  status: 'LOADING' | 'UNAUTHENTICATED' | 'DENIED' | 'AWAITING_ASSIGNMENT' | 'CUSTOMER_WORKSPACE' | 'AUTHORIZED';
  restaurant?: RestaurantEntity;
  availableRestaurants?: RestaurantEntity[];
}

export function resolvePortalAccess(params: {
  isAuthLoading: boolean;
  isReady?: boolean;
  user: UserEntity | Partial<UserEntity> | null;
  activeWorkspace?: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN' | null;
  memberships: RestaurantMembershipEntity[];
  restaurants?: RestaurantEntity[];
  activeRestaurant?: RestaurantEntity | null;
}): PortalAccessResolution {
  const { isAuthLoading, isReady = true, user, activeWorkspace, memberships, restaurants = [], activeRestaurant } = params;

  if (isAuthLoading || !isReady) {
    return { status: 'LOADING' };
  }

  if (!user) {
    return { status: 'UNAUTHENTICATED' };
  }

  if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
    return { status: 'DENIED' };
  }

  const userRoles = getUserRoles(user);
  const isAdmin = userRoles.includes(UserRole.ADMIN) || userRoles.includes(UserRole.SUPER_ADMIN);

  const activeMemberships = (memberships || []).filter(
    (m) => m.userId === user.id && isMembershipActive(m)
  );

  const availableRestaurants =
    restaurants.length > 0
      ? restaurants.filter(
          (r) => activeMemberships.some((m) => m.restaurantId === r.id) || (isAdmin && r.id === user.activeRestaurantId)
        )
      : activeRestaurant && activeMemberships.some((m) => m.restaurantId === activeRestaurant.id)
      ? [activeRestaurant]
      : [];

  if (
    !isAdmin &&
    activeMemberships.length === 0 &&
    (user.role === UserRole.CUSTOMER || !user.roles || user.roles.every((r) => r === UserRole.CUSTOMER))
  ) {
    return { status: 'DENIED' };
  }

  if (activeWorkspace === 'CUSTOMER') {
    return {
      status: 'CUSTOMER_WORKSPACE',
      availableRestaurants,
    };
  }

  let resolved: RestaurantEntity | undefined = undefined;
  if (activeRestaurant && (activeMemberships.some((m) => m.restaurantId === activeRestaurant.id) || isAdmin)) {
    resolved = activeRestaurant;
  } else if (activeMemberships.length > 0 && restaurants.length > 0) {
    const memRestId = activeMemberships[0].restaurantId;
    resolved = restaurants.find((r) => r.id === memRestId);
  } else if (isAdmin && user.activeRestaurantId && restaurants.length > 0) {
    resolved = restaurants.find((r) => r.id === user.activeRestaurantId);
  }

  if (!resolved) {
    return { status: 'AWAITING_ASSIGNMENT' };
  }

  return { status: 'AUTHORIZED', restaurant: resolved };
}

/**
 * Strict Order Selector for Restaurant Portals.
 * Filters orders strictly to targetRestaurantId, rejecting unassigned orders or other restaurants' orders.
 */
export function selectRestaurantOrders(
  orders: CustomMealRequestEntity[] | undefined | null,
  restaurantId: string | undefined | null
): CustomMealRequestEntity[] {
  if (!restaurantId || typeof restaurantId !== 'string' || !Array.isArray(orders)) return [];
  return orders.filter((o) => o && o.targetRestaurantId === restaurantId);
}
