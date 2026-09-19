import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/theme';

interface GuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * 1. AuthGuard: Ensures the user has an active, authenticated Supabase session.
 */
export const AuthGuard: React.FC<GuardProps> = ({ children, fallback }) => {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Inapakia...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    if (fallback) return <>{fallback}</>;
    return (
      <View style={styles.centerContainer}>
        <View style={styles.card}>
          <Ionicons name="lock-closed-outline" size={54} color={Colors.primary} />
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
        <ActivityIndicator size="large" color={Colors.primary} />
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
        <View style={[styles.card, { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
          <Ionicons name="shield-outline" size={54} color="#f43f5e" />
          <Text style={[styles.title, { color: '#f8fafc' }]}>Ufikiaji Umepigwa Marufuku</Text>
          <Text style={[styles.subtitle, { color: '#94a3b8' }]}>
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

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: 400,
    width: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 14,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
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
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
