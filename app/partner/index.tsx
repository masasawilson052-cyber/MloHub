import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../db/types';
import { Colors } from '../../constants/theme';

export default function PartnerIndexRoute() {
  const router = useRouter();
  const { isAuthenticated, isAuthLoading, currentRole, activeWorkspace, user, switchWorkspace } = useAuth();

  useEffect(() => {
    if (isAuthLoading) return;

    if (!isAuthenticated) {
      // 1. Unauthenticated -> Partner Login
      router.replace('/auth/login?type=restaurant');
      return;
    }

    const isRestaurantMember =
      currentRole === UserRole.RESTAURANT_OWNER ||
      currentRole === UserRole.RESTAURANT_STAFF ||
      user?.role === UserRole.RESTAURANT_OWNER ||
      user?.activeRole === UserRole.RESTAURANT_OWNER ||
      Boolean((user as any)?.restaurantId);

    if (isRestaurantMember) {
      // 2. Authenticated restaurant member -> Ensure workspace & go to portal
      if (activeWorkspace !== 'RESTAURANT_OWNER' && switchWorkspace) {
        switchWorkspace('RESTAURANT_OWNER');
      }
      router.replace('/restaurant-portal');
    } else {
      // 3. Authenticated customer (non-member) -> Restaurant Onboarding Wizard
      router.replace('/auth/register-restaurant');
    }
  }, [isAuthenticated, isAuthLoading, currentRole, activeWorkspace, user]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
