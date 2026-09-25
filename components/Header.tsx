import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radii } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { ThemeQuickSwitcher } from './theme/ThemeQuickSwitcher';

import { ThemeColors, lightColors } from '../theme/palettes';

let colors: ThemeColors = lightColors;

interface HeaderProps {
  location: string;
  onOpenLocation: () => void;
  onOpenProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  location,
  onOpenLocation,
  onOpenProfile,
}) => {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const { unreadCount } = useNotifications();
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.topbarBackground,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.brandRow}>
        <Image
          source={require('../assets/icon.png')}
          style={styles.logoImage}
          resizeMode="cover"
        />
        <TouchableOpacity
          style={[
            styles.locationButton,
            {
              backgroundColor: colors.surfaceInteractive,
              borderColor: colors.border,
            },
          ]}
          onPress={onOpenLocation}
          activeOpacity={0.8}
          accessibilityLabel={`Selected location ${location}. Tap to change.`}
        >
          <Ionicons
            name="location"
            size={14}
            color={colors.primary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[styles.locationMain, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {location
              ? location.split(',')[0]
              : language === 'sw'
              ? 'Chagua Eneo'
              : 'Select Area'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={13}
            color={colors.textSecondary}
            style={{ marginLeft: 3 }}
          />
        </TouchableOpacity>
      </View>

      {/* Right Controls: [Language] [Theme] [Notifications] [Profile] */}
      <View style={styles.rightRow}>
        <TouchableOpacity
          style={[
            styles.langTogglePill,
            {
              backgroundColor: colors.surfaceInteractive,
              borderColor: colors.border,
            },
          ]}
          onPress={toggleLanguage}
          activeOpacity={0.8}
          accessibilityLabel={`Current language: ${language.toUpperCase()}. Tap to switch.`}
        >
          <Text style={styles.langFlag}>{language === 'en' ? '🇬🇧' : '🇹🇿'}</Text>
          <Text style={[styles.langText, { color: colors.textPrimary }]}>
            {language === 'en' ? 'EN' : 'SW'}
          </Text>
        </TouchableOpacity>

        {/* Global Theme Quick Switcher */}
        <ThemeQuickSwitcher compact />

        {/* Notification Bell with Dynamic Unread Badge */}
        <TouchableOpacity
          style={[
            styles.notifBtn,
            {
              backgroundColor: colors.surfaceInteractive,
              borderColor: colors.border,
            },
          ]}
          onPress={() => router.push('/notifications')}
          activeOpacity={0.8}
          accessibilityLabel={`Notifications. ${unreadCount} unread.`}
        >
          <Ionicons
            name="notifications-outline"
            size={18}
            color={colors.textPrimary}
          />
          {unreadCount > 0 && (
            <View
              style={[
                styles.notifBadge,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.topbarBackground,
                },
              ]}
            >
              <Text style={styles.notifBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Profile Avatar Button */}
        <TouchableOpacity
          style={[
            styles.profileButton,
            {
              backgroundColor: colors.surfaceInteractive,
              borderColor: colors.border,
            },
          ]}
          onPress={onOpenProfile}
          activeOpacity={0.8}
          accessibilityLabel="Open Profile"
        >
          <Ionicons
            name="person-outline"
            size={17}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    marginRight: 8,
  },
  logoImage: {
    width: 34,
    height: 34,
    borderRadius: 9,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
    borderWidth: 1,
    maxWidth: 150,
  },
  locationMain: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 96,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
    borderWidth: 1,
    height: 34,
  },
  langFlag: {
    fontSize: 12,
  },
  langText: {
    fontSize: 10,
    fontWeight: '800',
  },
  notifBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: Radii.full,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  notifBadgeText: {
    color: colors.onPrimary,
    fontSize: 8,
    fontWeight: '900',
  },
  profileButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
let styles = createStyles(lightColors);
