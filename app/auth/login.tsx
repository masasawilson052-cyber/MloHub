import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../db/types';

type LoginAccountType = 'customer' | 'restaurant';

export default function SeparatedLoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const { language } = useLanguage();
  const { login, isAuthLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  // Active Login Tab: Customer vs Restaurant Owner
  const [activeAccountType, setActiveAccountType] = useState<LoginAccountType>(
    params.type === 'restaurant' ? 'restaurant' : 'customer'
  );

  useEffect(() => {
    if (params.type === 'restaurant') {
      setActiveAccountType('restaurant');
    } else if (params.type === 'customer') {
      setActiveAccountType('customer');
    }
  }, [params.type]);

  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Switch Tab Handler
  const handleSwitchTab = (type: LoginAccountType) => {
    setActiveAccountType(type);
    setErrorMsg(null);
  };

  const handleLogin = async () => {
    setErrorMsg(null);
    if (!emailOrPhone.trim()) {
      setErrorMsg(
        language === 'sw'
          ? 'Tafadhali weka barua pepe au namba ya simu.'
          : 'Please enter your email or phone.'
      );
      return;
    }
    if (!password) {
      setErrorMsg(
        language === 'sw' ? 'Tafadhali weka nenosiri lako.' : 'Please enter your password.'
      );
      return;
    }

    try {
      const res = await login({
        emailOrPhone: emailOrPhone.trim(),
        password,
        rememberMe,
      });

      const role = res.user.activeRole || res.user.role;

      if (
        activeAccountType === 'restaurant' ||
        role === UserRole.RESTAURANT_OWNER ||
        role === UserRole.RESTAURANT_STAFF
      ) {
        router.replace('/restaurant-portal');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {activeAccountType === 'customer'
            ? language === 'sw'
              ? 'Ingia kama Mteja'
              : 'Customer Sign In'
            : language === 'sw'
            ? 'Ingia kama Mgahawa'
            : 'Restaurant Owner Sign In'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* SEGMENTED ACCOUNT TYPE SWITCHER TABS */}
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeAccountType === 'customer' && styles.segmentTabActive,
            ]}
            onPress={() => handleSwitchTab('customer')}
            activeOpacity={0.85}
          >
            <Text style={styles.tabEmoji}>👤</Text>
            <Text
              style={[
                styles.segmentTabText,
                activeAccountType === 'customer' && styles.segmentTabTextActive,
              ]}
            >
              {language === 'sw' ? 'Akaunti ya Mteja' : 'Customer Account'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeAccountType === 'restaurant' && styles.segmentTabActive,
            ]}
            onPress={() => handleSwitchTab('restaurant')}
            activeOpacity={0.85}
          >
            <Text style={styles.tabEmoji}>🏪</Text>
            <Text
              style={[
                styles.segmentTabText,
                activeAccountType === 'restaurant' && styles.segmentTabTextActive,
              ]}
            >
              {language === 'sw' ? 'Mmiliki wa Mgahawa' : 'Restaurant Owner'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ROLE CONTEXT BANNER */}
        <View
          style={[
            styles.contextBanner,
            activeAccountType === 'restaurant' && styles.contextBannerRestaurant,
          ]}
        >
          <Ionicons
            name={activeAccountType === 'restaurant' ? 'restaurant' : 'fast-food'}
            size={20}
            color={activeAccountType === 'restaurant' ? '#b45309' : '#047857'}
          />
          <Text
            style={[
              styles.contextBannerText,
              activeAccountType === 'restaurant' && styles.contextBannerTextRestaurant,
            ]}
          >
            {activeAccountType === 'customer'
              ? language === 'sw'
                ? 'Agiza chakula kitamu, weka oda maalum, na lipa kwa usalama kupitia M-Pesa au Airtel Money.'
                : 'Order delicious meals, track deliveries, and manage your custom meal requests.'
              : language === 'sw'
              ? 'Dhibiti orodha ya chakula, pokea oda zinazoingia jikoni, na fuatilia mapato yako.'
              : 'Access your kitchen kanban, update your menu items, and track verified customer orders.'}
          </Text>
        </View>

        {/* ERROR MESSAGE BOX */}
        {errorMsg && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* INPUT FIELDS CARD */}
        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {language === 'sw' ? 'Barua Pepe au Namba ya Simu' : 'Email or Phone Number'}
            </Text>
            <View style={styles.inputWrap}>
              <Ionicons
                name={emailOrPhone.includes('@') ? 'mail-outline' : 'call-outline'}
                size={18}
                color="#64748b"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={emailOrPhone}
                onChangeText={(t) => {
                  setEmailOrPhone(t);
                  setErrorMsg(null);
                }}
                placeholder={
                  activeAccountType === 'customer'
                    ? 'mf. frank.mlaki@mlohub.tz au +255 754...'
                    : 'mf. mama.amina@mlohub.tz au +255 754...'
                }
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.inputLabel}>
                {language === 'sw' ? 'Nenosiri' : 'Password'}
              </Text>
              <TouchableOpacity onPress={() => router.push('/auth/forgot-password')}>
                <Text style={styles.forgotPasswordText}>
                  {language === 'sw' ? 'Umesahau nenosiri?' : 'Forgot password?'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 40 }]}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setErrorMsg(null);
                }}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.showPassBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* REMEMBER ME CHECKBOX */}
          <TouchableOpacity
            style={styles.rememberMeRow}
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={rememberMe ? 'checkbox' : 'square-outline'}
              size={20}
              color={rememberMe ? '#1d6637' : '#94a3b8'}
            />
            <Text style={styles.rememberMeText}>
              {language === 'sw' ? 'Nikumbuke kwenye kifaa hiki' : 'Keep me signed in on this device'}
            </Text>
          </TouchableOpacity>

          {/* SIGN IN BUTTON */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              activeAccountType === 'restaurant' && styles.submitBtnRestaurant,
            ]}
            onPress={handleLogin}
            disabled={isAuthLoading}
            activeOpacity={0.88}
          >
            {isAuthLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#ffffff" />
                <Text style={styles.submitBtnText}>
                  {activeAccountType === 'customer'
                    ? language === 'sw'
                      ? 'Ingia kama Mteja'
                      : 'Sign In as Customer'
                    : language === 'sw'
                    ? 'Ingia Kwenye Portal ya Mgahawa'
                    : 'Sign In to Restaurant Portal'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* REGISTRATION CALLOUT */}
        <View style={styles.footerWrap}>
          {activeAccountType === 'customer' ? (
            <View style={styles.registerPromptRow}>
              <Text style={styles.registerPromptText}>
                {language === 'sw' ? 'Huna akaunti bado?' : "Don't have an account yet?"}
              </Text>
              <TouchableOpacity onPress={() => router.push('/auth/register-customer')}>
                <Text style={styles.registerPromptLink}>
                  {language === 'sw' ? ' Jisajili kama Mteja' : ' Sign Up'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.registerPromptRow}>
              <Text style={styles.registerPromptText}>
                {language === 'sw' ? 'Unamiliki kibanda au mgahawa?' : 'Want to sell on MloHub?'}
              </Text>
              <TouchableOpacity onPress={() => router.push('/auth/register-restaurant')}>
                <Text style={styles.registerPromptLinkRestaurant}>
                  {language === 'sw' ? ' Omba Kujiunga Hapa' : ' Apply to Join'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radii.full,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: 16,
    paddingBottom: 40,
  },
  largeScreenContent: {
    maxWidth: 580,
    alignSelf: 'center',
    width: '100%',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: Radii.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRadius: Radii.lg,
  },
  segmentTabActive: {
    backgroundColor: Colors.card,
    ...Shadows.sm,
  },
  tabEmoji: {
    fontSize: 16,
  },
  segmentTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.muted,
  },
  segmentTabTextActive: {
    color: Colors.text,
    fontWeight: '800',
  },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 12,
    borderRadius: Radii.lg,
  },
  contextBannerRestaurant: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  contextBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#065f46',
    lineHeight: 16,
  },
  contextBannerTextRestaurant: {
    color: '#92400e',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 12,
    borderRadius: Radii.md,
  },
  errorText: {
    flex: 1,
    fontSize: 12.5,
    color: '#991b1b',
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: Radii.xxl,
    padding: Spacing.xl,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  inputGroup: {
    gap: 6,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.text,
  },
  forgotPasswordText: {
    fontSize: 11.5,
    color: '#1d6637',
    fontWeight: '700',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 13.5,
    color: Colors.text,
  },
  showPassBtn: {
    padding: 6,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  rememberMeText: {
    fontSize: 12.5,
    color: Colors.muted,
    fontWeight: '500',
  },
  submitBtn: {
    backgroundColor: '#1d6637',
    borderRadius: Radii.xl,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    ...Shadows.md,
  },
  submitBtnRestaurant: {
    backgroundColor: '#0f172a',
  },
  submitBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  footerWrap: {
    alignItems: 'center',
    marginTop: 4,
  },
  registerPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  registerPromptText: {
    fontSize: 13,
    color: Colors.muted,
  },
  registerPromptLink: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1d6637',
  },
  registerPromptLinkRestaurant: {
    fontSize: 13,
    fontWeight: '800',
    color: '#b45309',
  },
});
