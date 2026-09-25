import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../db/types';
import { Colors, Shadows } from '../../constants/theme';
import { ApplicationRepository } from '../../repositories/applications.repository';
import { RestaurantApplication } from '../../types/domain';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export default function PartnerIndexRoute() {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const router = useRouter();
  const {
    isAuthenticated,
    isAuthLoading,
    currentRole,
    activeWorkspace,
    user,
    memberships,
    activeRestaurant,
    switchWorkspace,
    refreshProfile,
  } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pendingApp, setPendingApp] = useState<RestaurantApplication | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const resolveAndNavigate = async () => {
      if (isAuthLoading) return;

      if (!isAuthenticated) {
        // 1. Unauthenticated -> Partner Login
        router.replace('/auth/login?type=restaurant');
        return;
      }

      // Check if user has updated roles in profile
      if (refreshProfile) {
        try {
          await refreshProfile();
        } catch {}
      }

      const restaurantId =
        user?.activeRestaurantId ||
        (user as any)?.restaurantId ||
        activeRestaurant?.id ||
        memberships?.[0]?.restaurantId;

      const isRestaurantMember =
        currentRole === UserRole.RESTAURANT_OWNER ||
        currentRole === UserRole.RESTAURANT_STAFF ||
        user?.role === UserRole.RESTAURANT_OWNER ||
        user?.activeRole === UserRole.RESTAURANT_OWNER ||
        (Array.isArray(user?.roles) &&
          (user.roles.includes(UserRole.RESTAURANT_OWNER) ||
            user.roles.includes(UserRole.RESTAURANT_STAFF))) ||
        (memberships && memberships.length > 0) ||
        Boolean(restaurantId);

      if (isRestaurantMember) {
        // 2. Authenticated restaurant member -> Ensure workspace & go to portal
        if (activeWorkspace !== 'RESTAURANT_OWNER' && switchWorkspace) {
          try {
            await switchWorkspace('RESTAURANT_OWNER', restaurantId);
          } catch (err: any) {
            console.warn('[PartnerIndexRoute] Workspace switch error:', err);
            if (!isCancelled) {
              setError(err?.message || 'Failed to initialize restaurant workspace. Access denied.');
            }
            return; // Fail closed: do NOT navigate
          }
        }
        if (!isCancelled) {
          router.replace('/restaurant-portal');
        }
      } else {
        // 3. Check for recently approved, pending, or rejected applications before routing to register
        try {
          const myApps = await ApplicationRepository.listMine(user?.email);
          const approved = myApps.find((a) => a.status === 'APPROVED');
          if (approved) {
            const targetId = approved.restaurantId || restaurantId;
            if (activeWorkspace !== 'RESTAURANT_OWNER' && switchWorkspace) {
              try {
                await switchWorkspace('RESTAURANT_OWNER', targetId);
              } catch (err: any) {
                console.warn('[PartnerIndexRoute] Workspace switch error:', err);
              }
            }
            if (!isCancelled) {
              router.replace('/restaurant-portal');
              return;
            }
          }
          const pending = myApps.find((a) => a.status === 'PENDING' || a.status === 'UNDER_REVIEW');
          if (pending && !isCancelled) {
            setPendingApp(pending);
            return;
          }
          const rejected = myApps.find((a) => a.status === 'REJECTED');
          if (rejected && !isCancelled) {
            router.replace('/restaurant-portal');
            return;
          }
        } catch (appErr) {
          console.warn('[PartnerIndexRoute] Error querying my applications:', appErr);
        }

        // 4. Authenticated customer with no pending/approved application -> Onboarding
        if (!isCancelled) {
          router.replace('/auth/register-restaurant');
        }
      }
    };

    resolveAndNavigate();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, isAuthLoading, currentRole, activeWorkspace, user, switchWorkspace, refreshProfile]);

  if (pendingApp) {
    return (
      <View style={styles.container}>
        <View style={styles.statusCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="time-outline" size={40} color="#d97706" />
          </View>
          <Text style={styles.statusBadge}>OMBI LAKO LINAKAGULIWA • UNDER REVIEW</Text>
          <Text style={styles.statusTitle}>"{pendingApp.businessName}"</Text>
          <Text style={styles.statusSub}>
            Maombi ya mgahawa wako yamepokelewa na yanakaguliwa na Usimamizi wa MloHub. Utaarifiwa pindi yatakapoidhinishwa na utaweza kuingia moja kwa moja kwenye Kitchen Portal kwa kutumia nenosiri lako.
          </Text>
          <View style={styles.appRefBox}>
            <Text style={styles.appRefLabel}>Kumbukumbu ya Ombi / Reference ID:</Text>
            <Text style={styles.appRefCode}>{pendingApp.id}</Text>
          </View>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
            <Text style={styles.backBtnText}>Rudi Nyumbani / Return to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle" size={48} color="#dc2626" />
        <Text style={styles.errorTitle}>Workspace Access Error</Text>
        <Text style={styles.errorSub}>{error}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
          <Text style={styles.backBtnText}>Return to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.appBackground,
    padding: 24,
  },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 440,
    width: '100%',
    ...Shadows.card,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.warningSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  statusBadge: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.warning,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  statusSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  appRefBox: {
    backgroundColor: colors.appBackground,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  appRefLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  appRefCode: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1d6637',
    marginTop: 2,
    letterSpacing: 1,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  backBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  backBtnText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
});
let styles = createStyles(lightColors);
