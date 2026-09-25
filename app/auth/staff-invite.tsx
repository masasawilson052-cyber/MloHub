import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { RestaurantMemberRepository } from '../../repositories/restaurantMembers.repository';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export default function StaffInviteScreen() {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const accept = async () => {
    if (!token || Array.isArray(token)) {
      setState('error');
      setMessage('This invitation link is invalid.');
      return;
    }
    setState('loading');
    try {
      const result = await RestaurantMemberRepository.acceptInvitation(token);
      setState('success');
      setMessage(`You joined the restaurant team as ${result.role}.`);
      setTimeout(() => router.replace('/restaurant-portal'), 700);
    } catch (error: any) {
      setState('error');
      setMessage(error?.message || 'This invitation could not be accepted.');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setMessage('Sign in with the invited email address to accept this invitation.');
    }
  }, [isAuthenticated]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Restaurant team invitation</Text>
        <Text style={styles.message}>{message || 'Review and accept this secure invitation.'}</Text>
        {!isAuthenticated ? (
          <Button
            title="Sign in"
            onPress={() => {
              const returnTo = token
                ? `/auth/staff-invite?token=${encodeURIComponent(String(token))}`
                : '/auth/staff-invite';
              router.push({
                pathname: '/auth/login',
                params: { returnTo },
              });
            }}
            fullWidth
          />
        ) : state === 'loading' ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : state === 'success' ? (
          <Button title="Open restaurant workspace" onPress={() => router.replace('/restaurant-portal')} fullWidth />
        ) : (
          <Button title="Accept invitation" onPress={accept} fullWidth />
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.appBackground },
  container: { flex: 1, justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  message: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
});
let styles = createStyles(lightColors);
