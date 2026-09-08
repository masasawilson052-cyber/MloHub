import { MloHubDB } from '../db';
import { AuthGuards, GuardAuthResult } from '../db/auth/guards';
import {
  UserRole,
  RestaurantEntity,
  AuditLogEntity,
  OnboardingChecklistState,
} from '../db/types';
import { AdminOnboardingService, OnboardRestaurantDTO } from './AdminOnboardingService';

export interface ApiResponse<T = any> {
  statusCode: number;
  success: boolean;
  data?: T;
  error?: string;
}

export class AdminApiService {
  /**
   * Middleware: Require Admin (ADMIN or SUPER_ADMIN)
   */
  private static verifyAdminAuth(token?: string): GuardAuthResult {
    return AuthGuards.requireRole(token, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
  }

  /**
   * 1. GET /api/admin/restaurants
   * Returns all food vendors (protected for ADMIN & SUPER_ADMIN only)
   */
  public static async listRestaurants(token?: string): Promise<ApiResponse<RestaurantEntity[]>> {
    const auth = this.verifyAdminAuth(token);
    if (!auth.isAuthenticated) {
      return {
        statusCode: auth.statusCode || 401,
        success: false,
        error: auth.error || '401 Unauthorized: Authentication required.',
      };
    }

    await MloHubDB.init();
    const restaurants = MloHubDB.restaurants.getAll();
    return {
      statusCode: 200,
      success: true,
      data: restaurants,
    };
  }

  /**
   * 2. GET /api/admin/restaurants/:id
   * Returns details of a specific restaurant
   */
  public static async getRestaurantById(
    token: string | undefined,
    restaurantId: string
  ): Promise<ApiResponse<RestaurantEntity>> {
    const auth = AuthGuards.requireAuth(token);
    if (!auth.isAuthenticated) {
      return {
        statusCode: 401,
        success: false,
        error: auth.error || '401 Unauthorized: Authentication required.',
      };
    }

    await MloHubDB.init();
    const restaurant = MloHubDB.restaurants.getById(restaurantId);
    if (!restaurant) {
      return {
        statusCode: 404,
        success: false,
        error: '404 Not Found: Restaurant not found.',
      };
    }

    // Admins can view any; Owners can only view their own
    const isAdmin = auth.role === UserRole.ADMIN || auth.role === UserRole.SUPER_ADMIN;
    if (!isAdmin) {
      const membershipCheck = AuthGuards.requireRestaurantMembership(token, restaurantId);
      if (!membershipCheck.isAuthenticated) {
        return {
          statusCode: membershipCheck.statusCode || 403,
          success: false,
          error: membershipCheck.error || '403 Forbidden: You can only view your own restaurant.',
        };
      }
    }

    return {
      statusCode: 200,
      success: true,
      data: restaurant,
    };
  }

  /**
   * 3. POST /api/admin/restaurants
   * Onboards a new restaurant (Admin only)
   */
  public static async createRestaurant(
    token: string | undefined,
    dto: OnboardRestaurantDTO
  ): Promise<ApiResponse<{ restaurant: RestaurantEntity; temporaryPin?: string }>> {
    const auth = this.verifyAdminAuth(token);
    if (!auth.isAuthenticated) {
      return {
        statusCode: auth.statusCode || 401,
        success: false,
        error: auth.error,
      };
    }

    const result = await AdminOnboardingService.onboardRestaurant(dto);
    if (!result.success || !result.restaurant) {
      return {
        statusCode: 400,
        success: false,
        error: result.message,
      };
    }

    // Audit Log
    await MloHubDB.auditLogs.create({
      adminUserId: auth.userId || 'usr-admin',
      adminName: auth.email || 'Admin',
      action: 'ONBOARD_RESTAURANT',
      targetType: 'RESTAURANT',
      targetId: result.restaurant.id,
      details: {
        businessName: dto.businessName,
        sellerTier: dto.sellerTier || 'BASIC_SELLER',
        ownerPhone: dto.ownerPhone,
      },
    });

    return {
      statusCode: 201,
      success: true,
      data: {
        restaurant: result.restaurant,
        temporaryPin: result.temporaryPin,
      },
    };
  }

  /**
   * 4. POST /api/admin/restaurants/:id/send-otp
   * Sends an SMS verification OTP to vendor phone
   */
  public static async sendRestaurantOtp(
    token: string | undefined,
    restaurantPhone: string
  ): Promise<ApiResponse<{ success: boolean; carrierName: string; message: string }>> {
    const auth = this.verifyAdminAuth(token);
    if (!auth.isAuthenticated) {
      return {
        statusCode: auth.statusCode || 401,
        success: false,
        error: auth.error,
      };
    }

    const res = await AdminOnboardingService.generateAndSendOtp(restaurantPhone);

    await MloHubDB.auditLogs.create({
      adminUserId: auth.userId || 'usr-admin',
      action: 'SEND_OTP',
      targetType: 'USER',
      targetId: restaurantPhone,
      details: { carrier: res.carrierName, phone: restaurantPhone },
    });

    return {
      statusCode: 200,
      success: true,
      data: {
        success: res.success,
        carrierName: res.carrierName,
        message: res.message,
      },
    };
  }

  /**
   * 5. POST /api/admin/restaurants/:id/approve
   * Approves & upgrades a restaurant to Verified Tier
   */
  public static async approveRestaurant(
    token: string | undefined,
    restaurantId: string,
    docs: { tinNumber: string; businessLicenseNumber: string }
  ): Promise<ApiResponse<RestaurantEntity>> {
    const auth = this.verifyAdminAuth(token);
    if (!auth.isAuthenticated) {
      return {
        statusCode: auth.statusCode || 401,
        success: false,
        error: auth.error,
      };
    }

    const result = await AdminOnboardingService.upgradeToVerified(restaurantId, docs);
    if (!result.success || !result.restaurant) {
      return {
        statusCode: 400,
        success: false,
        error: result.message,
      };
    }

    await MloHubDB.auditLogs.create({
      adminUserId: auth.userId || 'usr-admin',
      action: 'APPROVE_RESTAURANT',
      targetType: 'RESTAURANT',
      targetId: restaurantId,
      details: { tinNumber: docs.tinNumber, license: docs.businessLicenseNumber },
    });

    return {
      statusCode: 200,
      success: true,
      data: result.restaurant,
    };
  }

  /**
   * 6. POST /api/admin/restaurants/:id/reject
   * Rejects an application
   */
  public static async rejectRestaurant(
    token: string | undefined,
    restaurantId: string,
    reason: string = 'Incomplete or unverified documentation'
  ): Promise<ApiResponse<{ restaurantId: string; reason: string }>> {
    const auth = this.verifyAdminAuth(token);
    if (!auth.isAuthenticated) {
      return {
        statusCode: auth.statusCode || 401,
        success: false,
        error: auth.error,
      };
    }

    await MloHubDB.init();
    const rest = MloHubDB.restaurants.getById(restaurantId);
    if (!rest) {
      return { statusCode: 404, success: false, error: 'Restaurant not found' };
    }

    rest.verificationStatus = 'REJECTED';
    rest.isOpen = false;
    await MloHubDB.save();

    await MloHubDB.auditLogs.create({
      adminUserId: auth.userId || 'usr-admin',
      action: 'REJECT_RESTAURANT',
      targetType: 'RESTAURANT',
      targetId: restaurantId,
      details: { reason },
    });

    return {
      statusCode: 200,
      success: true,
      data: { restaurantId, reason },
    };
  }

  /**
   * 7. POST /api/admin/restaurants/:id/suspend
   * Suspends a restaurant
   */
  public static async suspendRestaurant(
    token: string | undefined,
    restaurantId: string,
    reason: string = 'Terms violation'
  ): Promise<ApiResponse<RestaurantEntity>> {
    const auth = this.verifyAdminAuth(token);
    if (!auth.isAuthenticated) {
      return {
        statusCode: auth.statusCode || 401,
        success: false,
        error: auth.error,
      };
    }

    const result = await AdminOnboardingService.suspendRestaurant(restaurantId, reason);
    if (!result.success || !result.restaurant) {
      return {
        statusCode: 400,
        success: false,
        error: result.message,
      };
    }

    await MloHubDB.auditLogs.create({
      adminUserId: auth.userId || 'usr-admin',
      action: 'SUSPEND_RESTAURANT',
      targetType: 'RESTAURANT',
      targetId: restaurantId,
      details: { reason },
    });

    return {
      statusCode: 200,
      success: true,
      data: result.restaurant,
    };
  }

  /**
   * 8. POST /api/admin/restaurants/:id/reactivate
   * Reactivates / unsuspends a restaurant
   */
  public static async reactivateRestaurant(
    token: string | undefined,
    restaurantId: string
  ): Promise<ApiResponse<RestaurantEntity>> {
    const auth = this.verifyAdminAuth(token);
    if (!auth.isAuthenticated) {
      return {
        statusCode: auth.statusCode || 401,
        success: false,
        error: auth.error,
      };
    }

    const result = await AdminOnboardingService.unsuspendRestaurant(restaurantId);
    if (!result.success || !result.restaurant) {
      return {
        statusCode: 400,
        success: false,
        error: result.message,
      };
    }

    await MloHubDB.auditLogs.create({
      adminUserId: auth.userId || 'usr-admin',
      action: 'REACTIVATE_RESTAURANT',
      targetType: 'RESTAURANT',
      targetId: restaurantId,
      details: {},
    });

    return {
      statusCode: 200,
      success: true,
      data: result.restaurant,
    };
  }

  /**
   * 9. GET /api/admin/audit-logs
   * Retrieves security audit trail
   */
  public static async getAuditLogs(token?: string): Promise<ApiResponse<AuditLogEntity[]>> {
    const auth = this.verifyAdminAuth(token);
    if (!auth.isAuthenticated) {
      return {
        statusCode: auth.statusCode || 401,
        success: false,
        error: auth.error,
      };
    }

    await MloHubDB.init();
    const logs = MloHubDB.auditLogs.getAll();
    return {
      statusCode: 200,
      success: true,
      data: logs,
    };
  }
}
