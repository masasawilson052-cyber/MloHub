import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radii } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useNotifications } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { ThemeQuickSwitcher } from '../theme/ThemeQuickSwitcher';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface CustomerDesktopNavProps {
  onOpenCart?: () => void;
}

export const CustomerDesktopNav: React.FC<CustomerDesktopNavProps> = ({ onOpenCart }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();
  const { totalItems, setIsCartOpen } = useCart();
  const { unreadCount } = useNotifications();
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  const [searchQuery, setSearchQuery] = useState('');

  const handleDesktopLogout = async () => {
    const title = language === 'sw' ? 'Ondoka kwenye Akaunti' : 'Sign Out';
    const message =
      language === 'sw'
        ? 'Je, una uhakika unataka kuondoka kwenye MloHub?'
        : 'Are you sure you want to sign out of MloHub?';

    const confirmed =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(`${title}\n\n${message}`)
        : true;

    if (confirmed) {
      try {
        await logout();
        router.replace('/auth');
      } catch (err) {
        console.error('[CustomerDesktopNav] Logout error:', err);
      }
    }
  };

  const navItems = [
    { label: t('tabExplore'), path: '/(tabs)', icon: 'compass-outline', activeIcon: 'compass' },
    { label: t('tabOrders'), path: '/(tabs)/orders', icon: 'receipt-outline', activeIcon: 'receipt' },
    { label: t('tabCustom'), path: '/(tabs)/custom', icon: 'restaurant-outline', activeIcon: 'restaurant' },
    { label: t('tabBookings'), path: '/(tabs)/bookings', icon: 'calendar-outline', activeIcon: 'calendar' },
    { label: t('tabProfile'), path: '/(tabs)/profile', icon: 'person-outline', activeIcon: 'person' },
  ];

  const isActive = (itemPath: string) => {
    if (itemPath === '/(tabs)' && (pathname === '/' || pathname === '/(tabs)' || pathname === '')) {
      return true;
    }
    return pathname.startsWith(itemPath) && itemPath !== '/(tabs)';
  };

  const handleSearchSubmit = () => {
    const trimmed = searchQuery.trim();
    if (trimmed) {
      router.push(`/(tabs)/explore?q=${encodeURIComponent(trimmed)}` as any);
    } else {
      router.push('/(tabs)/explore' as any);
    }
  };

  return (
    <View
      style={[
        styles.outerContainer,
        {
          backgroundColor: colors.topbarBackground,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.innerContainer}>
        {/* Brand Logo */}
        <TouchableOpacity
          style={styles.logoBtn}
          onPress={() => router.push('/(tabs)')}
          accessibilityRole="button"
          accessibilityLabel="MloHub Home"
        >
          <View style={[styles.logoIconCircle, { backgroundColor: colors.primarySoft }]}>
            <Text style={styles.logoEmoji}>🍲</Text>
          </View>
          <View>
            <Text style={[styles.logoBrand, { color: colors.textPrimary }]}>MloHub</Text>
            <Text style={[styles.logoTagline, { color: colors.textMuted }]}>
              Tanzania Food Marketplace
            </Text>
          </View>
        </TouchableOpacity>

        {/* Desktop Search Bar */}
        <View
          style={[
            styles.searchBarContainer,
            {
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={17}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              language === 'sw'
                ? 'Tafuta chakula, mgahawa au eneo...'
                : 'Search dishes, restaurants, areas...'
            }
            placeholderTextColor={colors.inputPlaceholder}
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
            >
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Central Nav Links */}
        <View style={styles.navLinksRow}>
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <TouchableOpacity
                key={item.path}
                style={[
                  styles.navLink,
                  active && { backgroundColor: colors.navActiveBackground },
                ]}
                onPress={() => router.push(item.path as any)}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={(active ? item.activeIcon : item.icon) as any}
                  size={17}
                  color={active ? colors.primary : colors.navText}
                />
                <Text
                  style={[
                    styles.navLinkLabel,
                    { color: active ? colors.navActiveText : colors.navText },
                    active && styles.navLinkLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Right Actions: Language, Theme, Notifications, Cart, Profile */}
        <View style={styles.rightActionsRow}>
          {/* Language Switch */}
          <TouchableOpacity
            style={[
              styles.langBtn,
              {
                backgroundColor: colors.surfaceInteractive,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setLanguage(language === 'en' ? 'sw' : 'en')}
            accessibilityRole="button"
            accessibilityLabel="Switch Language"
          >
            <Ionicons name="globe-outline" size={15} color={colors.textPrimary} />
            <Text style={[styles.langBtnText, { color: colors.textPrimary }]}>
              {language === 'en' ? 'SW' : 'EN'}
            </Text>
          </TouchableOpacity>

          {/* Theme Quick Switcher directly after Language */}
          <ThemeQuickSwitcher />

          {/* Notifications Bell */}
          <TouchableOpacity
            style={[
              styles.iconActionBtn,
              {
                backgroundColor: colors.surfaceInteractive,
                borderColor: colors.border,
              },
            ]}
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={`Notifications with ${unreadCount} unread`}
          >
            <Ionicons
              name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
              size={19}
              color={unreadCount > 0 ? colors.primary : colors.textPrimary}
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

          {/* Cart Button */}
          <TouchableOpacity
            style={[
              styles.cartBtn,
              {
                backgroundColor: colors.primarySoft,
                borderColor: colors.border,
              },
            ]}
            onPress={() => (onOpenCart ? onOpenCart() : setIsCartOpen(true))}
            accessibilityRole="button"
            accessibilityLabel={`Cart with ${totalItems} items`}
          >
            <Ionicons name="cart-outline" size={19} color={colors.primary} />
            {totalItems > 0 && (
              <View
                style={[
                  styles.cartBadge,
                  {
                    backgroundColor: colors.danger,
                    borderColor: colors.topbarBackground,
                  },
                ]}
              >
                <Text style={styles.cartBadgeText}>{totalItems}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* User Status / Profile Button */}
          {isAuthenticated ? (
            <View style={styles.userSection}>
              <TouchableOpacity
                style={styles.userProfileBtn}
                onPress={() => router.push('/(tabs)/profile')}
                accessibilityRole="button"
                accessibilityLabel="Go to Profile"
              >
                <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.userAvatarText}>
                    {(user?.fullName || user?.email || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={[styles.userName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {user?.fullName?.split(' ')[0] || 'Account'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.desktopLogoutBtn,
                  {
                    backgroundColor: colors.dangerSoft,
                    borderColor: colors.danger,
                  },
                ]}
                onPress={handleDesktopLogout}
                accessibilityRole="button"
                accessibilityLabel={language === 'sw' ? 'Ondoka' : 'Sign Out'}
              >
                <Ionicons name="log-out-outline" size={15} color={colors.danger} />
                <Text style={[styles.desktopLogoutText, { color: colors.danger }]}>
                  {language === 'sw' ? 'Ondoka' : 'Sign Out'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.loginBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/auth/login?type=customer')}
            >
              <Text style={styles.loginBtnText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  outerContainer: {
    borderBottomWidth: 1,
    width: '100%',
    zIndex: 100,
  },
  innerContainer: {
    maxWidth: 1280,
    width: '100%',
    height: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    gap: 12,
  },
  logoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: {
    fontSize: 20,
  },
  logoBrand: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  logoTagline: {
    fontSize: 10,
    fontWeight: '500',
  },
  searchBarContainer: {
    flex: 1,
    maxWidth: 320,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 38,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 2,
  },
  navLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  navLinkLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  navLinkLabelActive: {
    fontWeight: '700',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
  },
  notifBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  cartBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
  },
  cartBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  desktopLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  desktopLogoutText: {
    fontSize: 12,
    fontWeight: '700',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 80,
  },
  loginBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  loginBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
let styles = createStyles(lightColors);
