import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  UserEntity,
  UserRole,
  CustomerProfileEntity,
  RestaurantEntity,
  RestaurantMembershipEntity,
  RegisterCustomerDTO,
  RegisterRestaurantDTO,
  LoginDTO,
  AuthSessionResponse,
} from '../db/types';
import { AuthService } from '../db/auth/service';
import { CryptoEngine } from '../db/auth/crypto';
import { MloHubDB } from '../db';

interface AuthorizedWorkspaceOption {
  type: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN';
  name: string;
  subtitle: string;
  icon: string;
  role: UserRole;
  restaurantId?: string;
}

interface AuthContextType {
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  user: UserEntity | null;
  customerProfile: CustomerProfileEntity | null;
  memberships: RestaurantMembershipEntity[];
  activeRestaurant: RestaurantEntity | null;
  currentRole: UserRole | null;
  activeWorkspace: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN';
  authorizedWorkspaces: AuthorizedWorkspaceOption[];
  token: string | null;
  // Auth Operations
  login: (dto: LoginDTO) => Promise<AuthSessionResponse>;
  registerCustomer: (dto: RegisterCustomerDTO) => Promise<AuthSessionResponse>;
  registerRestaurant: (dto: RegisterRestaurantDTO) => Promise<AuthSessionResponse>;
  switchRole: (targetRole: UserRole, restaurantId?: string) => Promise<AuthSessionResponse>;
  switchWorkspace: (
    targetWorkspace: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN',
    restaurantId?: string
  ) => Promise<AuthSessionResponse>;
  switchUser: (userId: string) => Promise<AuthSessionResponse>;
  logout: () => Promise<void>;
  refreshAuthSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [session, setSession] = useState<AuthSessionResponse | null>(null);

  // Restore Session on Mount
  useEffect(() => {
    const bootstrap = async () => {
      try {
        await MloHubDB.init();
        const db = MloHubDB.getSnapshot();
        const activeUserId = db.activeUserId;

        if (activeUserId) {
          const user = db.users.find((u) => u.id === activeUserId);
          if (user) {
            const customerProfile = db.customerProfiles?.find((cp) => cp.userId === user.id) || null;
            const memberships = db.restaurantMemberships?.filter((rm) => rm.userId === user.id) || [];
            const activeRestId = user.activeRestaurantId || (memberships.length > 0 ? memberships[0].restaurantId : undefined);
            const activeRestaurant = activeRestId ? db.restaurants.find((r) => r.id === activeRestId) || null : null;

            const existingSession = db.sessions?.find((s) => s.userId === user.id);
            const token = existingSession ? existingSession.token : 'temp-seed-token';

            setSession({
              user,
              customerProfile: customerProfile || undefined,
              memberships,
              activeRestaurant: activeRestaurant || undefined,
              token,
            });
          }
        }
      } catch (e) {
        console.warn('Auth bootstrap error:', e);
      } finally {
        setIsAuthLoading(false);
      }
    };
    bootstrap();
  }, []);

  const refreshAuthSession = async () => {
    if (!session?.token) return;
    const restored = await AuthService.verifySession(session.token);
    if (restored) {
      setSession(restored);
    }
  };

  const login = async (dto: LoginDTO): Promise<AuthSessionResponse> => {
    setIsAuthLoading(true);
    try {
      const res = await AuthService.login(dto);
      const db = MloHubDB.getSnapshot();
      db.activeUserId = res.user.id;
      await MloHubDB.save();
      setSession(res);
      return res;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const registerCustomer = async (dto: RegisterCustomerDTO): Promise<AuthSessionResponse> => {
    setIsAuthLoading(true);
    try {
      const res = await AuthService.registerCustomer(dto);
      const db = MloHubDB.getSnapshot();
      db.activeUserId = res.user.id;
      await MloHubDB.save();
      setSession(res);
      return res;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const registerRestaurant = async (dto: RegisterRestaurantDTO): Promise<AuthSessionResponse> => {
    setIsAuthLoading(true);
    try {
      const res = await AuthService.registerRestaurant(dto);
      const db = MloHubDB.getSnapshot();
      db.activeUserId = res.user.id;
      await MloHubDB.save();
      setSession(res);
      return res;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const switchWorkspace = async (
    targetWorkspace: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN',
    restaurantId?: string
  ): Promise<AuthSessionResponse> => {
    if (!session?.user) {
      throw new Error('You must be logged in to switch workspaces.');
    }
    setIsAuthLoading(true);
    try {
      const res = await AuthService.switchWorkspace(session.user.id, targetWorkspace, restaurantId);
      const db = MloHubDB.getSnapshot();
      db.activeUserId = res.user.id;
      await MloHubDB.save();
      setSession(res);
      return res;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const switchRole = async (targetRole: UserRole, restaurantId?: string): Promise<AuthSessionResponse> => {
    if (!session?.user) {
      throw new Error('You must be logged in to switch account roles.');
    }
    setIsAuthLoading(true);
    try {
      const res = await AuthService.switchAccountContext(session.user.id, targetRole, restaurantId);
      const db = MloHubDB.getSnapshot();
      db.activeUserId = res.user.id;
      await MloHubDB.save();
      setSession(res);
      return res;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const switchUser = async (userId: string): Promise<AuthSessionResponse> => {
    setIsAuthLoading(true);
    try {
      await MloHubDB.init();
      const db = MloHubDB.getSnapshot();
      const targetUser = db.users.find((u) => u.id === userId) || db.users[0];

      db.activeUserId = targetUser.id;
      await MloHubDB.save();

      const customerProfile = db.customerProfiles?.find((cp) => cp.userId === targetUser.id);
      const memberships = db.restaurantMemberships?.filter((rm) => rm.userId === targetUser.id) || [];
      const activeRestId = targetUser.activeRestaurantId || (memberships.length > 0 ? memberships[0].restaurantId : undefined);
      const activeRestaurant = activeRestId ? db.restaurants.find((r) => r.id === activeRestId) : undefined;

      const userRole = targetUser.activeRole || targetUser.role;
      const token = CryptoEngine.signToken({
        userId: targetUser.id,
        role: userRole,
        email: targetUser.email,
        restaurantId: activeRestId,
      });

      const res: AuthSessionResponse = {
        user: targetUser,
        customerProfile,
        memberships,
        activeRestaurant,
        token,
      };

      setSession(res);
      return res;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsAuthLoading(true);
    try {
      if (session?.token) {
        await AuthService.logout(session.token);
      }
      const db = MloHubDB.getSnapshot();
      db.activeUserId = undefined;
      await MloHubDB.save();
    } catch (e) {
      console.warn('Logout error', e);
    } finally {
      setSession(null);
      setIsAuthLoading(false);
    }
  };

  const currentRole = session?.user?.activeRole || session?.user?.role || null;
  const activeWorkspace =
    session?.user?.activeWorkspace ||
    (currentRole === UserRole.ADMIN || currentRole === UserRole.SUPER_ADMIN
      ? 'MLOHUB_ADMIN'
      : currentRole === UserRole.RESTAURANT_OWNER || currentRole === UserRole.RESTAURANT_STAFF
      ? 'RESTAURANT_OWNER'
      : 'CUSTOMER');

  // Compute authorized workspaces from server session
  const authorizedWorkspaces: AuthorizedWorkspaceOption[] = [];
  if (session?.user) {
    const u = session.user;
    const userRoles = u.roles && u.roles.length > 0 ? u.roles : [u.role];

    // Personal Customer Account
    authorizedWorkspaces.push({
      type: 'CUSTOMER',
      name: 'Personal Account',
      subtitle: 'Customer',
      icon: 'person-circle',
      role: UserRole.CUSTOMER,
    });

    // Restaurant Owner Workspaces
    const memberships = session.memberships || [];
    for (const mem of memberships) {
      const rest = MloHubDB.restaurants.getById(mem.restaurantId);
      if (rest) {
        authorizedWorkspaces.push({
          type: 'RESTAURANT_OWNER',
          name: rest.name,
          subtitle: 'Restaurant Owner',
          icon: 'restaurant',
          role: UserRole.RESTAURANT_OWNER,
          restaurantId: rest.id,
        });
      }
    }

    // MloHub Admin Workspace (ONLY if user has ADMIN or SUPER_ADMIN)
    const isAdmin = userRoles.includes(UserRole.ADMIN) || userRoles.includes(UserRole.SUPER_ADMIN);
    if (isAdmin) {
      const isSuper = userRoles.includes(UserRole.SUPER_ADMIN);
      authorizedWorkspaces.push({
        type: 'MLOHUB_ADMIN',
        name: 'MloHub Administration',
        subtitle: isSuper ? 'Super Admin' : 'Admin',
        icon: 'shield-checkmark',
        role: isSuper ? UserRole.SUPER_ADMIN : UserRole.ADMIN,
      });
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthLoading,
        isAuthenticated: !!session?.user,
        user: session?.user || null,
        customerProfile: session?.customerProfile || null,
        memberships: session?.memberships || [],
        activeRestaurant: session?.activeRestaurant || null,
        currentRole,
        activeWorkspace,
        authorizedWorkspaces,
        token: session?.token || null,
        login,
        registerCustomer,
        registerRestaurant,
        switchRole,
        switchWorkspace,
        switchUser,
        logout,
        refreshAuthSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
