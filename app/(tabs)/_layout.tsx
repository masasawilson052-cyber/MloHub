import { Tabs, useSegments } from 'expo-router';
import React from 'react';
import { Platform, View, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { AdminPreviewBanner } from '../../components/navigation/AdminPreviewBanner';
import { PlatformAnnouncementBanner } from '../../components/announcements/PlatformAnnouncementBanner';
import { CustomerDesktopNav } from '../../components/navigation/CustomerDesktopNav';
import { ThemeQuickSwitcher } from '../../components/theme/ThemeQuickSwitcher';
import { CustomerCartHost } from '../../components/cart/CustomerCartHost';
import { Spacing } from '../../constants/theme';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export default function TabLayout() {
  const { t, language } = useLanguage();
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const isDesktop = width >= 900;
  const activeTab = (segments as readonly string[])[1] ?? 'index';
  const isCommerceTab =
    activeTab === 'index' || activeTab === 'explore' || activeTab === 'custom';

  return (
    <View style={[styles.container, { backgroundColor: colors.appBackground }]}>
      <AdminPreviewBanner />
      <PlatformAnnouncementBanner audience="CUSTOMERS" language={language === 'sw' ? 'sw' : 'en'} />
      {isDesktop && <CustomerDesktopNav />}
      <View style={styles.tabsWrapper}>
        {!isDesktop && (
          <View
            pointerEvents="box-none"
            style={[
              styles.mobileTopRightThemeSlot,
              { top: insets.top + 10 },
            ]}
          >
            <ThemeQuickSwitcher compact />
          </View>
        )}
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: {
              display: isDesktop ? 'none' : 'flex',
              backgroundColor: colors.topbarBackground,
              borderTopColor: colors.border,
              height: Platform.select({ ios: 88, default: 68 }),
              paddingBottom: Platform.select({ ios: 28, default: 10 }),
              paddingTop: 8,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.2,
            },
          }}
        >

        <Tabs.Screen
          name="index"
          options={{
            title: t('tabExplore'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'compass' : 'compass-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: t('tabOrders'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="custom"
          options={{
            title: t('tabCustom'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="bookings"
          options={{
            title: t('tabBookings'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabProfile'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            href: null,
          }}
        />
        </Tabs>
        <CustomerCartHost showWhenEmpty={isCommerceTab} />
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsWrapper: {
    flex: 1,
    position: 'relative',
  },
  mobileTopRightThemeSlot: {
    position: 'absolute',
    right: Spacing.lg,
    zIndex: 1200,
    alignItems: 'flex-end',
  },
});
let styles = createStyles(lightColors);

