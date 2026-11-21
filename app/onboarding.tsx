import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

/**
 * Legacy Onboarding Route
 * Preserved for backward compatibility with existing links/bookmarks.
 * Instantly redirects visitors to discovery /(tabs).
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    router.replace('/(tabs)');
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.appBackground }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
