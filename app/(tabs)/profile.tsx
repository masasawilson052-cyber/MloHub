import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Spacing, Radii } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useMloHubDB } from '../../context/DbContext';
import { useAuth } from '../../context/AuthContext';
import { hasAdminAccess } from '../../db/types';

import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { AccountSettingsModal } from '../../components/profile/AccountSettingsModal';
import { PreferencesModal } from '../../components/profile/PreferencesModal';
import { LanguageModal } from '../../components/LanguageModal';
import { SavedAddressesModal } from '../../components/profile/SavedAddressesModal';
import { SavedFavoritesModal } from '../../components/profile/SavedFavoritesModal';
import { SupportModal } from '../../components/profile/SupportModal';
import { PrivacySecurityModal } from '../../components/profile/PrivacySecurityModal';
import { useCustomerLocation } from '../../context/CustomerLocationContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ showLanguage?: string }>();
  const { language, setLanguage } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const { logout, user: authUser } = useAuth();
  const { user: dbUser, updateUser } = useMloHubDB();
  const { location: customerLocation } = useCustomerLocation();
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const user = authUser || dbUser;

  // Modal States
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(params.showLanguage === 'true');
  const [isAddressesModalOpen, setIsAddressesModalOpen] = useState(false);
  const [isFavoritesModalOpen, setIsFavoritesModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Profile data
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [location, setLocation] = useState(user?.location || '');
  const [preferences, setPreferences] = useState<string[]>(
    user?.dietaryPreferences || []
  );

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setLocation(user.location || '');
      setPreferences(user.dietaryPreferences || []);
    }
  }, [user]);

  const handleSaveAccount = async (data: { name: string; email: string; phone: string; location: string }) => {
    try {
      setFullName(data.name);
      setPhone(data.phone);
      setLocation(data.location);

      if (updateUser) {
        await updateUser({
          fullName: data.name,
          phone: data.phone,
          location: data.location,
        });
      }

      if (data.email && data.email !== email && isSupabaseConfigured()) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: data.email });
        if (emailErr) {
          Alert.alert('Email Notice', emailErr.message);
        } else {
          Alert.alert('Verification Sent', 'A verification email has been sent to confirm your new email address.');
        }
      } else {
        setEmail(data.email);
      }

      Alert.alert('Profile Updated', 'Your account information has been saved.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update account information.');
    }
  };

  const handleSavePreferences = async (newPrefs: string[]) => {
    try {
      setPreferences(newPrefs);
      if (updateUser) {
        await updateUser({ dietaryPreferences: newPrefs });
      }
      if (user?.id && isSupabaseConfigured()) {
        const { DietaryRepository } = require('../../repositories/dietary.repository');
        await DietaryRepository.save({
          customerId: user.id,
          preferences: newPrefs,
          allergies: [],
        });
      }
      Alert.alert('Preferences Saved', 'Your dietary preferences have been updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update preferences.');
    }
  };

  const handleLogout = async () => {
    const title = language === 'sw' ? 'Ondoka kwenye Akaunti' : 'Sign Out';
    const message =
      language === 'sw'
        ? 'Je, una uhakika unataka kuondoka kwenye MloHub?'
        : 'Are you sure you want to sign out of MloHub?';

    const performLogout = async () => {
      try {
        await logout();
        router.replace('/auth');
      } catch (err: any) {
        console.error('[Profile] Sign out error:', err);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(`${title}\n\n${message}`)
          : true;
      if (confirmed) {
        await performLogout();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: language === 'sw' ? 'Hapana' : 'Cancel', style: 'cancel' },
      {
        text: language === 'sw' ? 'Ndio, Ondoka' : 'Sign Out',
        style: 'destructive',
        onPress: performLogout,
      },
    ]);
  };

  const isAdmin = hasAdminAccess((user as any)?.role);
  const isRestaurantOwner =
    (user as any)?.role === 'RESTAURANT_OWNER' ||
    (user as any)?.roles?.includes('RESTAURANT_OWNER');

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.appBackground }]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <ProfileHeader
          fullName={fullName}
          email={email}
          phone={phone}
          location={
            customerLocation.addressLine
              ? `${customerLocation.addressLine}${customerLocation.serviceAreaName ? `, ${customerLocation.serviceAreaName}` : ''}`
              : location || 'Dar es Salaam'
          }
          onEditProfile={() => setIsAccountModalOpen(true)}
        />

        {/* SECTION: GENERAL SETTINGS */}
        <View
          style={[
            styles.menuGroup,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.groupHeading, { color: colors.textMuted }]}>
            Preferences & Saved
          </Text>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: colors.divider }]}
            onPress={() => setIsPreferencesModalOpen(true)}
            accessible={true}
            accessibilityRole="button"
          >
            <View style={[styles.rowIconCircle, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="nutrition-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Dietary Preferences
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {preferences.join(', ') || 'None set'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: colors.divider }]}
            onPress={() => setIsFavoritesModalOpen(true)}
            accessible={true}
            accessibilityRole="button"
          >
            <View style={[styles.rowIconCircle, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="heart-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Saved Favorites
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                View and manage your favorite restaurants
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: colors.divider }]}
            onPress={() => setIsAddressesModalOpen(true)}
            accessible={true}
            accessibilityRole="button"
          >
            <View style={[styles.rowIconCircle, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Saved Delivery Addresses
              </Text>
              <Text
                style={[styles.rowSubtitle, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {customerLocation.addressLine
                  ? `${customerLocation.addressLine}${customerLocation.serviceAreaName ? `, ${customerLocation.serviceAreaName}` : ''}`
                  : 'Manage delivery addresses'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: colors.divider }]}
            onPress={() => router.push('/payments' as any)}
            accessible={true}
            accessibilityRole="button"
          >
            <View style={[styles.rowIconCircle, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="card-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {language === 'sw' ? 'Historia ya Malipo' : 'Payment History & Receipts'}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {language === 'sw'
                  ? 'Miamala ya simu na stakabadhi'
                  : 'Mobile money records and receipts'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: colors.divider }]}
            onPress={() => router.push('/notifications')}
            accessible={true}
            accessibilityRole="button"
          >
            <View style={[styles.rowIconCircle, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Notifications
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Order updates and alerts
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 0 }]}
            onPress={() => setIsLanguageModalOpen(true)}
            accessible={true}
            accessibilityRole="button"
          >
            <View style={[styles.rowIconCircle, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="globe-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Language / Lugha
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {language === 'sw' ? 'Kiswahili' : 'English'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* SECTION: PARTNER & ADMIN WORKSPACE SHORTCUTS */}
        <View
          style={[
            styles.menuGroup,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.groupHeading, { color: colors.textMuted }]}>
            Partner & Merchant
          </Text>

          {isRestaurantOwner ? (
            <TouchableOpacity
              style={[
                styles.menuRow,
                { borderBottomColor: colors.divider },
                !isAdmin && { borderBottomWidth: 0 },
              ]}
              onPress={() => router.push('/partner' as any)}
              accessible={true}
              accessibilityRole="button"
            >
              <View style={[styles.rowIconCircle, { backgroundColor: colors.infoSoft }]}>
                <Ionicons name="restaurant-outline" size={20} color={colors.info} />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  Restaurant Partner Portal
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Kitchen management and menu updates
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.menuRow,
                { borderBottomColor: colors.divider },
                !isAdmin && { borderBottomWidth: 0 },
              ]}
              onPress={() => router.push('/partner' as any)}
              accessible={true}
              accessibilityRole="button"
            >
              <View style={[styles.rowIconCircle, { backgroundColor: colors.warningSoft }]}>
                <Ionicons name="storefront-outline" size={20} color={colors.warning} />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  Partner with MloHub
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Grow your kitchen, list dishes, get paid
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          {isAdmin && (
            <TouchableOpacity
              style={[styles.menuRow, { borderBottomWidth: 0 }]}
              onPress={() => router.push('/admin' as any)}
              accessible={true}
              accessibilityRole="button"
            >
              <View style={[styles.rowIconCircle, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  Platform Admin Console
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Auditing, applications, and security
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* SECTION: HELP & SUPPORT */}
        <View
          style={[
            styles.menuGroup,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.groupHeading, { color: colors.textMuted }]}>
            Support & About
          </Text>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: colors.divider }]}
            onPress={() => setIsSupportModalOpen(true)}
            accessible={true}
            accessibilityRole="button"
          >
            <View style={[styles.rowIconCircle, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Help & Customer Support
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Phone, WhatsApp & email desk
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: colors.divider }]}
            onPress={() => setIsPrivacyModalOpen(true)}
            accessible={true}
            accessibilityRole="button"
          >
            <View style={[styles.rowIconCircle, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Privacy & Data Protection
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Manage your privacy and account security
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={[styles.menuRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.rowIconCircle, { backgroundColor: colors.surfaceInteractive }]}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                About MloHub
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Version 1.0.0 (Official Build)
              </Text>
            </View>
          </View>
        </View>

        {/* SIGN OUT BUTTON */}
        <TouchableOpacity
          style={[
            styles.logoutBtn,
            {
              backgroundColor: colors.dangerSoft,
              borderColor: colors.danger,
            },
          ]}
          onPress={handleLogout}
          activeOpacity={0.8}
          accessible={true}
          accessibilityRole="button"
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color={colors.danger}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.logoutBtnText, { color: colors.danger }]}>
            {language === 'sw' ? 'Ondoka Kwenye Akaunti' : 'Sign Out'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modals */}
      <SavedAddressesModal
        visible={isAddressesModalOpen}
        onClose={() => setIsAddressesModalOpen(false)}
      />

      <SavedFavoritesModal
        visible={isFavoritesModalOpen}
        onClose={() => setIsFavoritesModalOpen(false)}
      />

      <SupportModal
        visible={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />

      <PrivacySecurityModal
        visible={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />

      <AccountSettingsModal
        visible={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        initialName={fullName}
        initialEmail={email}
        initialPhone={phone}
        initialLocation={
          customerLocation.addressLine
            ? `${customerLocation.addressLine}${customerLocation.serviceAreaName ? `, ${customerLocation.serviceAreaName}` : ''}`
            : location
        }
        onOpenManageAddresses={() => setIsAddressesModalOpen(true)}
        onSave={handleSaveAccount}
      />

      <PreferencesModal
        visible={isPreferencesModalOpen}
        onClose={() => setIsPreferencesModalOpen(false)}
        initialPreferences={preferences}
        onSave={handleSavePreferences}
      />

      <LanguageModal
        visible={isLanguageModalOpen}
        currentLanguage={language}
        onSelectLanguage={setLanguage}
        onClose={() => setIsLanguageModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  largeScreenContainer: {
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  menuGroup: {
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  groupHeading: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  rowTextCol: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingVertical: 14,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
let styles = createStyles(lightColors);
