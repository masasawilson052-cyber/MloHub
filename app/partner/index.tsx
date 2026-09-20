import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../db/types';
import { Colors } from '../../constants/theme';

export default function PartnerIndexRoute() {
  const router = useRouter();
  const { isAuthenticated, isAuthLoading, currentRole, activeWorkspace, user, switchWorkspace } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const resolveAndNavigate = async () => {
      if (isAuthLoading) return;

      if (!isAuthenticated) {
        // 1. Unauthenticated -> Partner Login
        router.replace('/auth/login?type=restaurant');
        return;
      }

      const restaurantId = (user as any)?.restaurantId;
      const isRestaurantMember =
        currentRole === UserRole.RESTAURANT_OWNER ||
        currentRole === UserRole.RESTAURANT_STAFF ||
        user?.role === UserRole.RESTAURANT_OWNER ||
        user?.activeRole === UserRole.RESTAURANT_OWNER ||
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
        // 3. Authenticated customer (non-member) -> Restaurant Onboarding Wizard
        if (!isCancelled) {
          router.replace('/auth/register-restaurant');
        }
      }
    };

    resolveAndNavigate();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, isAuthLoading, currentRole, activeWorkspace, user, switchWorkspace]);

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
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
