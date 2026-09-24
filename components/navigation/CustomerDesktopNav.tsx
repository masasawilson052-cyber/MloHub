import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

interface CustomerDesktopNavProps {
  onOpenCart?: () => void;
}

export const CustomerDesktopNav: React.FC<CustomerDesktopNavProps> = ({ onOpenCart }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const { totalItems, setIsCartOpen } = useCart();

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
                  size={18}
                  color={active ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.navLinkLabel, active && styles.navLinkLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Right Actions: Language, Cart, Auth */}
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
            <TouchableOpacity
              style={styles.userProfileBtn}
              onPress={() => router.push('/(tabs)/profile')}
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
    maxWidth: 1200,
    width: '100%',
    height: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
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
  navLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  navLinkActive: {
    backgroundColor: '#F0FDF4',
  },
  navLinkLabel: {
    fontSize: 14,
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
    gap: 12,
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
  },
  cartBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    maxWidth: 90,
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
