import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

import { useTheme } from '../context/ThemeContext';
import { ThemeColors, lightColors } from '../theme/palettes';

let colors: ThemeColors = lightColors;

interface CustomMealBannerProps {
  onStartRequest: () => void;
}

export const CustomMealBanner: React.FC<CustomMealBannerProps> = ({ onStartRequest }) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const { t } = useLanguage();

  return (
    <View style={styles.banner}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{t('customBadge')}</Text>
      </View>

      <Text style={styles.heading}>{t('customBannerHeading')}</Text>
      <Text style={styles.subheading}>{t('customBannerSub')}</Text>

      {/* 3 Step Flow */}
      <View style={styles.stepContainer}>
        <View style={styles.stepItem}>
          <View style={styles.stepNum}>
            <Text style={styles.stepNumText}>1</Text>
          </View>
          <Text style={styles.stepLabel}>{t('step1')}</Text>
        </View>

        <Text style={styles.stepArrow}>→</Text>

        <View style={styles.stepItem}>
          <View style={styles.stepNum}>
            <Text style={styles.stepNumText}>2</Text>
          </View>
          <Text style={styles.stepLabel}>{t('step2')}</Text>
        </View>

        <Text style={styles.stepArrow}>→</Text>

        <View style={styles.stepItem}>
          <View style={styles.stepNum}>
            <Text style={styles.stepNumText}>3</Text>
          </View>
          <Text style={styles.stepLabel}>{t('step3')}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.ctaButton}
        onPress={onStartRequest}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaText}>{t('startCustomRequest')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  banner: {
    backgroundColor: colors.primaryDark,
    borderRadius: Radii.xxl,
    padding: Spacing.xl,
    marginVertical: Spacing.lg,
    ...Shadows.lg,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(223, 242, 185, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: 'rgba(223, 242, 185, 0.3)',
    marginBottom: Spacing.sm,
  },
  badgeText: {
    color: colors.lime,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.onPrimary,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    marginBottom: Spacing.xs,
  },
  subheading: {
    fontSize: 13,
    color: '#d8e5dc',
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: Radii.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: Radii.full,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  stepLabel: {
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  stepArrow: {
    color: colors.lime,
    fontSize: 14,
    fontWeight: 'bold',
  },
  ctaButton: {
    backgroundColor: colors.warningSoft,
    paddingVertical: 14,
    borderRadius: Radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  ctaText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
});
let styles = createStyles(lightColors);
