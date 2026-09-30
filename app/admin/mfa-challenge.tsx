import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminMfaChallenge } from '../../components/admin/security/AdminMfaChallenge';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function AdminMfaChallengeScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    async function loadFactor() {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        const verified = data?.totp?.find((f) => f.status === 'verified');
        if (verified) {
          setFactorId(verified.id);
        } else {
          router.replace('/admin/mfa-setup' as any);
        }
      } catch {
        router.replace('/admin/mfa-setup' as any);
      } finally {
        setLoading(false);
      }
    }

    loadFactor();
  }, [router]);

  if (loading || !factorId) {
    return (
      <View style={[styles.center, { backgroundColor: colors.appBackground }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AdminMfaChallenge
      factorId={factorId}
      onSuccess={() => {
        router.replace('/admin');
      }}
      onCancel={logout}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
