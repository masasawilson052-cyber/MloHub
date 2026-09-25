import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/theme';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface GuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * 1. AuthGuard: Ensures the user has an active, authenticated Supabase session.
 */
export const AuthGuard: React.FC<GuardProps> = ({ children, fallback }) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Inapakia...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    if (fallback) return <>{fallback}</>;
    return (
      <View style={styles.centerContainer}>
        <View style={styles.card}>
          <Ionicons name="lock-closed-outline" size={54} color={colors.primary} />
          <Text style={styles.title}>Kuingia Kunahitajika</Text>
          <Text style={styles.subtitle}>Tafadhali ingia kwenye akaunti yako ili kuendelea.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/auth')}>
            <Text style={styles.primaryBtnText}>Ingia / Jisajili</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <>{children}</>;
};

/**
 * 2. RestaurantGuard: Requires authenticated restaurant membership (OWNER, MANAGER, STAFF).
 */
export const RestaurantGuard: React.FC<GuardProps> = ({ children, fallback }) => {
  const router = useRouter();
  const { isAuthenticated, isRestaurantUser, loading, memberships } = useAuth();

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthGuard>{children}</AuthGuard>;
  }

  const hasActiveMembership = memberships && memberships.some((m) => m.status === 'ACTIVE');
  if (!isRestaurantUser && !hasActiveMembership) {
    if (fallback) return <>{fallback}</>;
    return (
      <View style={styles.centerContainer}>
        <View style={styles.card}>
          <Ionicons name="storefront-outline" size={54} color="#ef4444" />
          <Text style={styles.title}>Hakuna Idhini ya Mgahawa</Text>
          <Text style={styles.subtitle}>
            Akaunti yako haina uanachama uliothibitishwa wa mgahawa wowote. Ukurasa huu ni wa wamiliki na wapishi wa migahawa pekee.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.primaryBtnText}>Rudi Nyumbani</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <>{children}</>;
};

/**
 * 3. AdminGuard: Requires verified ADMIN or SUPER_ADMIN role in trusted database records.
 */
export const AdminGuard: React.FC<GuardProps> = ({ children, fallback }) => {
  const router = useRouter();
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    if (fallback) return <>{fallback}</>;
    return (
      <View style={[styles.centerContainer, { backgroundColor: '#0b1329' }]}>
        <View style={[styles.card, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          <Ionicons name="shield-outline" size={54} color="#f43f5e" />
          <Text style={[styles.title, { color: colors.appBackground }]}>Ufikiaji Umepigwa Marufuku</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Ukurasa huu unahitaji ruhusa ya msimamizi mkuu (MloHub Back-Office Admin).
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: '#0284c7' }]}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.primaryBtnText}>Rudi Nyumbani</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <>{children}</>;
};

/**
 * 4. CustomerGuard: Allows customers or dual-role accounts.
 */
export const CustomerGuard: React.FC<GuardProps> = ({ children }) => {
  return <AuthGuard>{children}</AuthGuard>;
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.card,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 400,
    width: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 14,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: '#113a26',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
let styles = createStyles(lightColors);
