import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';

interface HeaderProps {
  location: string;
  favoriteCount: number;
  onOpenLocation: () => void;
  onOpenProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  location,
  favoriteCount,
  onOpenLocation,
  onOpenProfile,
}) => {
  const router = useRouter();
  const { language, toggleLanguage, t } = useLanguage();
  const { unreadCount } = useNotifications();

  return (
    <View style={styles.container}>
      {/* Brand Logo */}
      <View style={styles.brandRow}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>M</Text>
        </View>
        <Text style={styles.brandText}>
          Mlo<Text style={styles.brandTextGreen}>Hub</Text>
        </Text>
      </View>

      {/* Right Controls */}
      <View style={styles.rightRow}>
        {/* Quick Language Toggle Pill */}
        <TouchableOpacity
          style={styles.langTogglePill}
          onPress={toggleLanguage}
          activeOpacity={0.8}
          accessibilityLabel={`Current language: ${language.toUpperCase()}. Tap to switch.`}
        >
          <Text style={styles.langFlag}>{language === 'en' ? '🇬🇧' : '🇹🇿'}</Text>
          <Text style={styles.langText}>{language === 'en' ? 'EN' : 'SW'}</Text>
        </TouchableOpacity>

        {/* Notification Bell with Dynamic Unread Badge */}
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => router.push('/notifications')}
          activeOpacity={0.8}
          accessibilityLabel={`Notifications. ${unreadCount} unread.`}
        >
          <Ionicons name="notifications-outline" size={18} color={Colors.text} />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Location Switcher */}
        <TouchableOpacity
          style={styles.locationButton}
          onPress={onOpenLocation}
          activeOpacity={0.8}
          accessibilityLabel={`Selected location ${location}. Tap to change.`}
        >
          <View style={styles.locationIconBadge}>
            <Text style={styles.locationIcon}>📍</Text>
          </View>
          <View style={styles.locationTextWrap}>
            <Text style={styles.locationSub}>{t('selectArea')}</Text>
            <Text style={styles.locationMain} numberOfLines={1}>
              {location.split(',')[0]}
            </Text>
          </View>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>

        {/* Profile Button */}
        <TouchableOpacity
          style={styles.profileButton}
          onPress={onOpenProfile}
          activeOpacity={0.8}
          accessibilityLabel="Open Profile"
        >
          <Text style={styles.profileIcon}>👤</Text>
          {favoriteCount > 0 && (
            <View style={styles.favBadge}>
              <Text style={styles.favBadgeText}>{favoriteCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    zIndex: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  logoBadgeText: {
    color: Colors.white,
    fontWeight: '900',
    fontSize: 18,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  brandTextGreen: {
    color: Colors.primaryLight,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' }),
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primaryMuted,
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  langFlag: {
    fontSize: 12,
  },
  langText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  notifBtn: {
    width: 34,
    height: 34,
    borderRadius: Radii.full,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
    ...Shadows.sm,
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: Colors.accent,
    minWidth: 16,
    height: 16,
    borderRadius: Radii.full,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  notifBadgeText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: '900',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  locationIconBadge: {
    width: 18,
    height: 18,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIcon: {
    fontSize: 10,
  },
  locationTextWrap: {
    maxWidth: 70,
  },
  locationSub: {
    fontSize: 7,
    textTransform: 'uppercase',
    color: Colors.subtle,
    fontWeight: '700',
  },
  locationMain: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text,
  },
  chevron: {
    fontSize: 9,
    color: Colors.subtle,
  },
  profileButton: {
    width: 34,
    height: 34,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Shadows.sm,
  },
  profileIcon: {
    fontSize: 14,
  },
  favBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.accent,
    width: 14,
    height: 14,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  chefQuickBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    backgroundColor: '#eaf4ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#badbcc',
  },
  favBadgeText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: '900',
  },
});
