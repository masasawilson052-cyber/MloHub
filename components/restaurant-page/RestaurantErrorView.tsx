import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';
import { Spacing, Radii, Shadows } from '../../constants/theme';

let colors: ThemeColors = lightColors;

export interface RestaurantErrorViewProps {
  onRetry?: () => void;
  message?: string;
}

export const RestaurantErrorView: React.FC<RestaurantErrorViewProps> = ({
  onRetry,
  message,
}) => {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Bar with back navigation */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('restaurantLoadError')}</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="restaurant-outline" size={40} color={colors.textMuted} />
        </View>

        <Text style={styles.title}>
          {language === 'sw' ? 'Mkahawa Haujapatikana' : 'Restaurant Unavailable'}
        </Text>

        <Text style={styles.message}>
          {message ||
            (language === 'sw'
              ? 'Mkahawa unaoutafuta haupo au haupatikani kwa wateja kwa sasa.'
              : 'The restaurant you are looking for does not exist or is currently unavailable.')}
        </Text>

        <View style={styles.actionsRow}>
          {onRetry ? (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={onRetry}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('restaurantRetry')}
            >
              <Ionicons
                name="refresh-outline"
                size={16}
                color={colors.onPrimary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.retryBtnText}>{t('restaurantRetry')}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.backToHomeBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={language === 'sw' ? 'Rudi Nyuma' : 'Go Back'}
          >
            <Text style={styles.backToHomeText}>
              {language === 'sw' ? 'Rudi Nyuma' : 'Go Back'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.appBackground,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceInteractive,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backBtnPlaceholder: {
      width: 40,
      height: 40,
    },
    topTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: Radii.full,
      backgroundColor: colors.surfaceInteractive,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
      ...Shadows.sm,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: Spacing.xl,
      maxWidth: 320,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    retryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: Radii.md,
      ...Shadows.sm,
    },
    retryBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    backToHomeBtn: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: Radii.md,
      backgroundColor: colors.surfaceInteractive,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backToHomeText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  });
