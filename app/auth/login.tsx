import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { UserRole, hasAdminAccess } from '../../db/types';
import { Button } from '../../components/ui/Button';
import { runtimeConfig } from '../../lib/runtimeConfig';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; returnTo?: string }>();
  const { language } = useLanguage();
  const { login, logout, isAuthLoading } = useAuth();
  const isAdminLogin = params.type === 'admin';
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [isRestaurantLogin, setIsRestaurantLogin] = useState(params.type === 'restaurant');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsRestaurantLogin(params.type === 'restaurant');
  }, [params.type]);

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

    setLoading(true);
    try {
      const res = await login({
        emailOrPhone: emailOrPhone.trim(),
        password,
        rememberMe: true,
      });

      if (isAdminLogin && !hasAdminAccess(res.user)) {
        await logout();
        throw new Error('This account does not have administrator access. Use an authorized administrator account.');
      }
      if (params.returnTo === 'restaurant-registration' && !isAdminLogin) {
        router.replace('/auth/register-restaurant');
        return;
      }
      if (
        params.returnTo &&
        typeof params.returnTo === 'string' &&
        params.returnTo.startsWith('/') &&
        !params.returnTo.startsWith('//') &&
        !params.returnTo.includes('://')
      ) {
        router.replace(params.returnTo as any);
        return;
      }
      const role = res.user.activeRole || res.user.role;
      if (hasAdminAccess(res.user)) {
        router.replace('/admin');
      } else if (
        isRestaurantLogin ||
        role === UserRole.RESTAURANT_OWNER ||
        role === UserRole.RESTAURANT_STAFF
      ) {
        router.replace('/restaurant-portal');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isAdminLogin ? 'Administrator Sign In' : isRestaurantLogin ? 'Restaurant Partner Login' : 'Customer Sign In'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Logo & Greeting */}
        <View style={styles.brandContainer}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoSquircle}
            resizeMode="contain"
          />
          <Text style={styles.welcomeHeading}>
            {language === 'sw' ? 'Karibu Tena' : 'Welcome Back'}
          </Text>
          <Text style={styles.welcomeSub}>
            {isAdminLogin ? 'Review restaurant applications and manage MloHub. Authorized administrators only.' : isRestaurantLogin
              ? language === 'sw'
                ? 'Dhibiti mgahawa wako na pokea maagizo ya wateja.'
                : 'Access your kitchen display and manage live orders.'
              : language === 'sw'
              ? 'Ingia ili uendelee kufurahia vyakula halisi na meza zilizothibitishwa.'
              : 'Sign in to discover dishes, order meals and book tables.'}
          </Text>
        </View>

        {/* Error Feedback */}
        {errorMsg && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Inputs Form */}
        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {language === 'sw' ? 'Barua Pepe au Namba ya Simu' : 'Email or Phone Number'}
            </Text>
            <View style={styles.inputWrap}>
              <Ionicons
                name={emailOrPhone.includes('@') ? 'mail-outline' : 'call-outline'}
                size={18}
                color={Colors.muted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={emailOrPhone}
                onChangeText={setEmailOrPhone}
                placeholder={language === 'sw' ? 'frank.mlaki@mlohub.tz au 0754...' : 'name@example.com or +255...'}
                placeholderTextColor={Colors.subtle}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {language === 'sw' ? 'Nenosiri' : 'Password'}
            </Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.subtle}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={Colors.muted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => router.push('/auth/forgot-password')}
          >
            <Text style={styles.forgotText}>
              {language === 'sw' ? 'Umesahau nenosiri?' : 'Forgot password?'}
            </Text>
          </TouchableOpacity>

          {/* Sign In CTA */}
          <Button
            title={
              loading
                ? language === 'sw' ? 'Inaingia...' : 'Signing In...'
                : language === 'sw' ? 'Ingia' : 'Sign In'
            }
            onPress={handleLogin}
            loading={loading}
            variant="primary"
            size="lg"
            fullWidth={true}
            style={styles.signInBtn}
          />

          {/* Or Divider & Guest Exploration */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{language === 'sw' ? 'au' : 'or'}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.guestBtn}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.85}
          >
            <Ionicons name="compass-outline" size={18} color={Colors.brandInk} style={{ marginRight: 8 }} />
            <Text style={styles.guestBtnText}>
              {language === 'sw' ? 'Gundua Chakula Bila Kuingia' : 'Explore as Guest'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Create Account Link */}
        {!isAdminLogin && <View style={styles.registerRow}>
          <Text style={styles.registerPrompt}>
            {language === 'sw' ? 'Huna akaunti bado?' : "Don't have an account?"}{' '}
          </Text>
          <TouchableOpacity
            onPress={() =>
              router.push(
                isRestaurantLogin ? '/auth/register-restaurant' : '/auth/register-customer'
              )
            }
          >
            <Text style={styles.registerLink}>
              {language === 'sw' ? 'Jiunge Hapa' : 'Sign Up'}
            </Text>
          </TouchableOpacity>
        </View>}

        {/* Discrete Portal Switcher */}
        <TouchableOpacity
          style={styles.switchPortalBtn}
          onPress={() => { setIsRestaurantLogin(!isRestaurantLogin); router.setParams({ type: isRestaurantLogin ? 'customer' : 'restaurant' }); }}
        >
          <Ionicons
            name={isRestaurantLogin ? 'person-outline' : 'restaurant-outline'}
            size={16}
            color={Colors.primary}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.switchPortalText}>
            {isRestaurantLogin
              ? language === 'sw' ? 'Unataka kuagiza chakula? Ingia kama Mteja' : 'Looking for meals? Customer Sign In'
              : language === 'sw' ? 'Mmiliki wa Mgahawa? Ingia hapa' : 'Restaurant Partner? Sign in to Kitchen Portal'}
          </Text>
        </TouchableOpacity>

        {/* Quick Demo Credentials Prefill - Renders ONLY when runtimeConfig.isDemo is true */}
        {runtimeConfig.isDemo && (
          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>⚡ Quick Demo Accounts</Text>
            <View style={styles.demoButtonsRow}>
              <TouchableOpacity
                style={[styles.demoPill, { borderColor: '#ef4444' }]}
                onPress={() => {
                  if (!runtimeConfig.isDemo) {
                    Alert.alert('Restricted', 'Demo accounts are disabled in this environment.');
                    return;
                  }
                  setEmailOrPhone('admin@mlohub.tz');
                  setPassword('password123');
                }}
              >
                <Text style={[styles.demoPillText, { color: '#dc2626' }]}>🛡️ Super Admin</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoPill, { borderColor: '#f97316' }]}
                onPress={() => {
                  if (!runtimeConfig.isDemo) {
                    Alert.alert('Restricted', 'Demo accounts are disabled in this environment.');
                    return;
                  }
                  setEmailOrPhone('mama.amina@mlohub.tz');
                  setPassword('password123');
                }}
              >
                <Text style={[styles.demoPillText, { color: '#ea580c' }]}>🍳 Restaurant</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoPill, { borderColor: '#0284c7' }]}
                onPress={() => {
                  if (!runtimeConfig.isDemo) {
                    Alert.alert('Restricted', 'Demo accounts are disabled in this environment.');
                    return;
                  }
                  setEmailOrPhone('frank.mlaki@mlohub.tz');
                  setPassword('password123');
                }}
              >
                <Text style={[styles.demoPillText, { color: '#0284c7' }]}>👤 Customer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  largeScreenContent: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  logoSquircle: {
    width: 68,
    height: 68,
    borderRadius: 18,
    marginBottom: Spacing.sm,
  },
  welcomeHeading: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.brandInk,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    marginTop: 4,
  },
  welcomeSub: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    lineHeight: 19,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: Radii.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#b91c1c',
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xxl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brandInk,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radii.xl,
    paddingHorizontal: Spacing.sm,
    height: 48,
  },
  inputIcon: {
    marginRight: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.brandInk,
  },
  eyeBtn: {
    padding: 6,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.md,
  },
  forgotText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
  },
  signInBtn: {
    marginTop: Spacing.xs,
    borderRadius: Radii.xl,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  dividerText: {
    fontSize: 12,
    color: Colors.muted,
    paddingHorizontal: Spacing.md,
    fontWeight: '600',
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radii.xl,
    paddingVertical: 13,
  },
  guestBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.brandInk,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  registerPrompt: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  switchPortalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  switchPortalText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  demoBox: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  demoPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  demoPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
