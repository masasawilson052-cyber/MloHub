import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage, Language } from '../context/LanguageContext';
import { useCustomerLocation } from '../context/CustomerLocationContext';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors, lightColors } from '../theme/palettes';
import { Spacing, Radii, Shadows } from '../constants/theme';

interface WelcomeSheetProps {
  visible: boolean;
  onStart: () => void;
  onClose: () => void;
  onChooseArea: () => void;
}

let colors: ThemeColors = lightColors;

export const WelcomeSheet: React.FC<WelcomeSheetProps> = ({
  visible,
  onStart,
  onClose,
  onChooseArea,
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);

  const { t, language, setLanguage } = useLanguage();
  const { location, useDeviceLocation } = useCustomerLocation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width > 768;

  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  if (!visible) return null;

  const currentAreaText = location.serviceAreaName
    ? `${location.serviceAreaName}, ${location.cityName || 'Dar es Salaam'}`
    : location.cityName || 'Dar es Salaam';

  const handleUseMyLocation = async () => {
    setIsDetectingLocation(true);
    setLocationNotice(null);
    try {
      const success = await useDeviceLocation();
      if (!success) {
        setLocationNotice(t('welcomeLocationUnavailable'));
        // Never block the user: seamlessly open the area picker
        setTimeout(() => {
          onChooseArea();
        }, 1200);
      }
    } catch {
      setLocationNotice(t('welcomeLocationUnavailable'));
      setTimeout(() => {
        onChooseArea();
      }, 1200);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleSelectLanguage = (lang: Language) => {
    setLanguage(lang);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={[styles.backdrop, isDesktop && styles.desktopBackdrop]}>
        <View
          style={[
            styles.container,
            isDesktop ? styles.desktopCard : styles.mobileSheet,
            !isDesktop && { paddingBottom: Math.max(insets.bottom, 16) + Spacing.md },
          ]}
          accessibilityLabel={t('welcomeTagline')}
        >
          {/* Header Row: Close (X) button */}
          <View style={styles.topBar}>
            <View style={styles.brandBadge}>
              <Image
                source={require('../assets/icon.png')}
                style={styles.logo}
                resizeMode="cover"
                accessibilityRole="image"
                accessibilityLabel="MloHub Logo"
              />
              <View>
                <Text style={styles.brandTitle}>MloHub</Text>
                <Text style={styles.tagline} accessibilityRole="header">
                  {t('welcomeTagline')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('welcomeCloseBtn')}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Language Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel} accessibilityRole="text">
              {t('welcomeLanguageLabel')}
            </Text>
            <View style={styles.languageRow}>
              <TouchableOpacity
                style={[
                  styles.languageChip,
                  language === 'sw' && styles.languageChipActive,
                ]}
                onPress={() => handleSelectLanguage('sw')}
                accessibilityRole="button"
                accessibilityState={{ selected: language === 'sw' }}
                accessibilityLabel={language === 'sw' ? 'Kiswahili kimechaguliwa' : 'Chagua Kiswahili'}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.languageChipText,
                    language === 'sw' && styles.languageChipTextActive,
                  ]}
                >
                  🇹🇿 Kiswahili
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.languageChip,
                  language === 'en' && styles.languageChipActive,
                ]}
                onPress={() => handleSelectLanguage('en')}
                accessibilityRole="button"
                accessibilityState={{ selected: language === 'en' }}
                accessibilityLabel={language === 'en' ? 'English selected' : 'Select English'}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.languageChipText,
                    language === 'en' && styles.languageChipTextActive,
                  ]}
                >
                  🇬🇧 English
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Location Selection */}
          <View style={styles.section}>
            <View style={styles.areaStatusRow}>
              <Ionicons name="location" size={16} color={colors.primary} />
              <Text style={styles.currentAreaLabel}>{t('welcomeCurrentArea')}</Text>
              <Text style={styles.currentAreaValue} numberOfLines={1}>
                {currentAreaText}
              </Text>
            </View>

            {locationNotice ? (
              <View style={styles.noticeBox}>
                <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                <Text style={styles.noticeText}>{locationNotice}</Text>
              </View>
            ) : null}

            <View style={styles.locationActionsRow}>
              <TouchableOpacity
                style={styles.deviceLocationBtn}
                onPress={handleUseMyLocation}
                disabled={isDetectingLocation}
                accessibilityRole="button"
                accessibilityLabel={
                  language === 'sw'
                    ? 'Tumia eneo langu la GPS'
                    : 'Use my current device location'
                }
                activeOpacity={0.8}
              >
                {isDetectingLocation ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="navigate-outline" size={16} color={colors.primary} />
                )}
                <Text style={styles.deviceLocationBtnText}>
                  {t('welcomeUseLocationBtn')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.chooseAreaBtn}
                onPress={onChooseArea}
                accessibilityRole="button"
                accessibilityLabel={t('welcomeChooseAreaBtn')}
                activeOpacity={0.8}
              >
                <Ionicons name="list-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.chooseAreaBtnText}>
                  {t('welcomeChooseAreaBtn')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Start CTA */}
          <TouchableOpacity
            style={styles.startBtn}
            onPress={onStart}
            accessibilityRole="button"
            accessibilityLabel={
              language === 'sw'
                ? 'Anza kutumia MloHub'
                : 'Start using MloHub'
            }
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>{t('welcomeStartBtn')}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'flex-end',
    },
    desktopBackdrop: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xl,
    },
    container: {
      backgroundColor: colors.card,
      padding: Spacing.lg,
      ...Shadows.lg,
    },
    mobileSheet: {
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      width: '100%',
    },
    desktopCard: {
      borderRadius: Radii.xl,
      maxWidth: 440,
      width: '100%',
      borderWidth: 1,
      borderColor: colors.divider,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: Spacing.md,
    },
    brandBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flex: 1,
    },
    logo: {
      width: 48,
      height: 48,
      borderRadius: 12,
    },
    brandTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    tagline: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 1,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceInteractive,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: Spacing.sm,
    },
    section: {
      marginTop: Spacing.sm,
      marginBottom: Spacing.md,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.xs,
    },
    languageRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    languageChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1.5,
      borderColor: colors.divider,
      backgroundColor: colors.surfaceInteractive,
    },
    languageChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    languageChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    languageChipTextActive: {
      fontWeight: '800',
      color: colors.primary,
    },
    areaStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceInteractive,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: Radii.md,
      marginBottom: Spacing.xs,
    },
    currentAreaLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    currentAreaValue: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
    },
    noticeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceInteractive,
      padding: 8,
      borderRadius: Radii.sm,
      marginBottom: Spacing.xs,
    },
    noticeText: {
      fontSize: 11,
      color: colors.warning,
      flex: 1,
      fontWeight: '600',
    },
    locationActionsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: 4,
    },
    deviceLocationBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    deviceLocationBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    chooseAreaBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surfaceInteractive,
    },
    chooseAreaBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: Radii.lg,
      marginTop: Spacing.xs,
      ...Shadows.md,
    },
    startBtnText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.onPrimary,
      letterSpacing: 0.3,
    },
  });
