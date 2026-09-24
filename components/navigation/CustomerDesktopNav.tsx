import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useNotifications } from '../../context/NotificationContext';

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

  const [searchQuery, setSearchQuery] = useState('');

  const handleDesktopLogout = async () => {
    const title = language === 'sw' ? 'Ondoka kwenye Akaunti' : 'Sign Out';
    const message = language === 'sw'
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
    if (itemPath === '/(tabs)' && (pathname === '/' || pathname === '/(tabs)' || pathname === '')) return true;
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
    <View style={styles.outerContainer}>
      <View style={styles.innerContainer}>
        {/* Brand Logo */}
        <TouchableOpacity
          style={styles.logoBtn}
          onPress={() => router.push('/(tabs)')}
          accessibilityRole="button"
          accessibilityLabel="MloHub Home"
        >
          <View style={styles.logoIconCircle}>
            <Text style={styles.logoEmoji}>🍲</Text>
          </View>
          <View>
            <Text style={styles.logoBrand}>MloHub</Text>
            <Text style={styles.logoTagline}>Tanzania Food Marketplace</Text>
          </View>
        </TouchableOpacity>

        {/* Desktop Search Bar */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search-outline" size={17} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              language === 'sw'
                ? 'Tafuta chakula, mgahawa au eneo...'
                : 'Search dishes, restaurants, areas...'
            }
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
            >
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
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
                style={[styles.navLink, active && styles.navLinkActive]}
                onPress={() => router.push(item.path as any)}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={(active ? item.activeIcon : item.icon) as any}
                  size={17}
                  color={active ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.navLinkLabel, active && styles.navLinkLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Right Actions: Language, Notifications, Cart, Auth */}
        <View style={styles.rightActionsRow}>
          {/* Language Switch */}
          <TouchableOpacity
            style={styles.langBtn}
            onPress={() => setLanguage(language === 'en' ? 'sw' : 'en')}
            accessibilityRole="button"
            accessibilityLabel="Switch Language"
          >
            <Ionicons name="globe-outline" size={16} color={Colors.text} />
            <Text style={styles.langBtnText}>{language === 'en' ? 'SW' : 'EN'}</Text>
          </TouchableOpacity>

          {/* Notifications Bell */}
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={`Notifications with ${unreadCount} unread`}
          >
            <Ionicons
              name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
              size={20}
              color={unreadCount > 0 ? Colors.primary : '#475569'}
            />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Cart Button */}
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => (onOpenCart ? onOpenCart() : setIsCartOpen(true))}
            accessibilityRole="button"
            accessibilityLabel={`Cart with ${totalItems} items`}
          >
            <Ionicons name="cart-outline" size={20} color={Colors.primary} />
            {totalItems > 0 && (
              <View style={styles.cartBadge}>
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
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {(user?.fullName || user?.email || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.fullName?.split(' ')[0] || 'Account'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.desktopLogoutBtn}
                onPress={handleDesktopLogout}
                accessibilityRole="button"
                accessibilityLabel={language === 'sw' ? 'Ondoka' : 'Sign Out'}
              >
                <Ionicons name="log-out-outline" size={16} color="#DC2626" />
                <Text style={styles.desktopLogoutText}>
                  {language === 'sw' ? 'Ondoka' : 'Sign Out'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.loginBtn}
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

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
    borderRadius: Radii.md,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: {
    fontSize: 20,
  },
  logoBrand: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  logoTagline: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  searchBarContainer: {
    flex: 1,
    maxWidth: 320,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 38,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
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
    borderRadius: Radii.md,
  },
  navLinkActive: {
    backgroundColor: '#F0FDF4',
  },
  navLinkLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  navLinkLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: Colors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cartBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
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
    paddingVertical: 5,
    borderRadius: Radii.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  desktopLogoutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    maxWidth: 80,
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  loginBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
