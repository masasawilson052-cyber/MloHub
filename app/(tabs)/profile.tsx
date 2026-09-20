import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useMloHubDB } from '../../context/DbContext';
import { useAuth } from '../../context/AuthContext';
import { hasAdminAccess } from '../../db/types';

import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { AccountSettingsModal } from '../../components/profile/AccountSettingsModal';
import { PreferencesModal } from '../../components/profile/PreferencesModal';
import { LanguageModal } from '../../components/LanguageModal';

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ showLanguage?: string }>();
  const { t, language, setLanguage } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const { logout, user: authUser } = useAuth();
  const { user: dbUser, favorites, toggleFavorite, updateUser, restaurants } = useMloHubDB();
  const user = authUser || dbUser;

  // Modal States
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(params.showLanguage === 'true');

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
      setEmail(data.email);
      setPhone(data.phone);
      setLocation(data.location);
      if (updateUser) {
        await updateUser({
          fullName: data.name,
          email: data.email,
          phone: data.phone,
          location: data.location,
        });
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
      Alert.alert('Preferences Saved', 'Your dietary preferences have been updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update preferences.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      language === 'sw' ? 'Ondoka kwenye Akaunti' : 'Sign Out',
      language === 'sw' ? 'Je, una uhakika unataka kuondoka?' : 'Are you sure you want to sign out of MloHub?',
      [
        { text: language === 'sw' ? 'Hapana' : 'Cancel', style: 'cancel' },
        {
          text: language === 'sw' ? 'Ndio, Ondoka' : 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth');
          },
        },
      ]
    );
  };

  const isAdmin = hasAdminAccess((user as any)?.role);
  const isRestaurantOwner = (user as any)?.role === 'RESTAURANT_OWNER' || (user as any)?.roles?.includes('RESTAURANT_OWNER');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
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
          location={location}
          onEditProfile={() => setIsAccountModalOpen(true)}
        />

        {/* SECTION: GENERAL SETTINGS */}
        <View style={styles.menuGroup}>
          <Text style={styles.groupHeading}>Preferences & Saved</Text>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setIsPreferencesModalOpen(true)}
            accessible={true}
            accessibilityRole="button"
          >
            <View style={styles.rowIconCircle}>
              <Ionicons name="nutrition-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Dietary Preferences</Text>
              <Text style={styles.rowSubtitle}>{preferences.join(', ') || 'None set'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <View
            style={[styles.menuRow, { opacity: 0.65 }]}
            accessible={true}
          >
            <View style={styles.rowIconCircle}>
              <Ionicons name="heart-outline" size={20} color={Colors.muted} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Saved Favorites</Text>
              <Text style={styles.rowSubtitle}>Deferred • Coming in future update</Text>
            </View>
            <View style={styles.deferredBadge}>
              <Text style={styles.deferredBadgeText}>Deferred</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => router.push('/notifications')}
            accessible={true}
            accessibilityRole="button"
          >
            <View style={styles.rowIconCircle}>
              <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Notifications</Text>
              <Text style={styles.rowSubtitle}>Order updates and alerts</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 0 }]}
            onPress={() => setIsLanguageModalOpen(true)}
            accessible={true}
            accessibilityRole="button"
          >
            <View style={styles.rowIconCircle}>
              <Ionicons name="globe-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Language / Lugha</Text>
              <Text style={styles.rowSubtitle}>{language === 'sw' ? 'Kiswahili' : 'English'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* SECTION: PARTNER & ADMIN WORKSPACE SHORTCUTS (Discrete) */}
        <View style={styles.menuGroup}>
          <Text style={styles.groupHeading}>Partner & Merchant</Text>

          {isRestaurantOwner ? (
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => router.push('/partner' as any)}
              accessible={true}
              accessibilityRole="button"
            >
              <View style={[styles.rowIconCircle, { backgroundColor: '#EBF8FF' }]}>
                <Ionicons name="restaurant-outline" size={20} color="#2B6CB0" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>Restaurant Partner Portal</Text>
                <Text style={styles.rowSubtitle}>Kitchen management and menu updates</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => router.push('/partner' as any)}
              accessible={true}
              accessibilityRole="button"
            >
              <View style={[styles.rowIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="storefront-outline" size={20} color="#D97706" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>Partner with MloHub</Text>
                <Text style={styles.rowSubtitle}>Grow your kitchen, list dishes, get paid</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}

          {isAdmin && (
            <TouchableOpacity
              style={[styles.menuRow, { borderBottomWidth: 0 }]}
              onPress={() => router.push('/admin' as any)}
              accessible={true}
              accessibilityRole="button"
            >
              <View style={[styles.rowIconCircle, { backgroundColor: '#FAF5FF' }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#6B46C1" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>Platform Admin Console</Text>
                <Text style={styles.rowSubtitle}>Auditing, applications, and security</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* SECTION: HELP & SUPPORT */}
        <View style={styles.menuGroup}>
          <Text style={styles.groupHeading}>Support & About</Text>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => Alert.alert('Customer Care', 'Contact MloHub Dar es Salaam team at support@mlohub.tz or +255 754 000 111.')}
            accessible={true}
            accessibilityRole="button"
          >
            <View style={styles.rowIconCircle}>
              <Ionicons name="help-circle-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Help & Customer Support</Text>
              <Text style={styles.rowSubtitle}>Chat with our Dar es Salaam team</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => Alert.alert('Privacy Policy', 'MloHub respects customer privacy and does not track or sell raw GPS locations.')}
            accessible={true}
            accessibilityRole="button"
          >
            <View style={styles.rowIconCircle}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Privacy & Data Protection</Text>
              <Text style={styles.rowSubtitle}>Zero-leak security policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={[styles.menuRow, { borderBottomWidth: 0 }]}>
            <View style={styles.rowIconCircle}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.textMuted} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>About MloHub</Text>
              <Text style={styles.rowSubtitle}>Version 1.0.0 (Official Build)</Text>
            </View>
          </View>
        </View>

        {/* SIGN OUT BUTTON */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
          accessible={true}
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error} style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>
            {language === 'sw' ? 'Ondoka Kwenye Akaunti' : 'Sign Out'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Account Settings Modal */}
      <AccountSettingsModal
        visible={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        initialName={fullName}
        initialEmail={email}
        initialPhone={phone}
        initialLocation={location}
        onSave={handleSaveAccount}
      />

      {/* Preferences Modal */}
      <PreferencesModal
        visible={isPreferencesModalOpen}
        onClose={() => setIsPreferencesModalOpen(false)}
        initialPreferences={preferences}
        onSave={handleSavePreferences}
      />

      {/* Language Modal */}
      <LanguageModal
        visible={isLanguageModalOpen}
        currentLanguage={language}
        onSelectLanguage={setLanguage}
        onClose={() => setIsLanguageModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  groupHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
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
    borderBottomColor: Colors.borderLight,
  },
  rowIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryMuted,
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
    color: Colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: '#FED7D7',
    borderRadius: Radii.md,
    paddingVertical: 14,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.error,
  },
  deferredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  deferredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.muted,
  },
});
