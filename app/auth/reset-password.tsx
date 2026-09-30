import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';
import { extractPkceCodeFromResetInput } from '../../utils/authUrls';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

function cleanRecoveryUrlOnWeb(): void {
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.history?.replaceState
  ) {
    const docTitle = typeof document !== 'undefined' ? document.title : 'MloHub';
    window.history.replaceState({}, docTitle, '/auth/reset-password');
  }
}

export default function ResetPasswordScreen() {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const incomingLinkingUrl = Linking.useURL();
  const { language } = useLanguage();
  const sw = language === 'sw';

  const [ready, setReady] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState(false);
  const hasExchangedRef = useRef(false);
  const recoveryVerifiedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const invalidLinkMsg = sw
      ? 'Kiungo hiki cha kurejesha nenosiri hakitumiki tena.'
      : 'This password reset link is no longer valid.';

    const markRecoveryValid = () => {
      recoveryVerifiedRef.current = true;
      cleanRecoveryUrlOnWeb();
      if (mounted) {
        setRecoveryReady(true);
        setRecoveryError('');
        setReady(true);
      }
    };

    const markRecoveryInvalid = () => {
      cleanRecoveryUrlOnWeb();
      if (mounted && !recoveryVerifiedRef.current) {
        setRecoveryReady(false);
        setRecoveryError(invalidLinkMsg);
        setReady(true);
      }
    };

    // 1. Subscribe strictly to PASSWORD_RECOVERY auth event (never unlock on generic SIGNED_IN)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        markRecoveryValid();
      }
    });

    const processCandidateInput = async (candidateUrl?: string | null): Promise<boolean> => {
      const extracted = extractPkceCodeFromResetInput(params, candidateUrl);

      if (extracted.hasError) {
        markRecoveryInvalid();
        return true;
      }

      if (extracted.code) {
        if (hasExchangedRef.current) {
          return true;
        }
        hasExchangedRef.current = true;
        try {
          const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(
            extracted.code
          );
          if (exchangeErr || !data?.session) {
            markRecoveryInvalid();
            return true;
          }
          markRecoveryValid();
          return true;
        } catch {
          markRecoveryInvalid();
          return true;
        }
      }

      return false;
    };

    const initializeRecovery = async () => {
      if (recoveryVerifiedRef.current || hasExchangedRef.current) {
        return;
      }

      // Check router params + current web/linking URL first
      const handledImmediately = await processCandidateInput(incomingLinkingUrl);
      if (handledImmediately || recoveryVerifiedRef.current) {
        return;
      }

      // On native, also check Linking.getInitialURL() for cold-start deep links
      if (Platform.OS !== 'web') {
        try {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl) {
            const handledInitial = await processCandidateInput(initialUrl);
            if (handledInitial || recoveryVerifiedRef.current) {
              return;
            }
          }
        } catch {
          // Ignore linking read error and fall through
        }
      }

      if (!recoveryVerifiedRef.current) {
        markRecoveryInvalid();
      }
    };

    initializeRecovery();

    const urlSub =
      Platform.OS !== 'web'
        ? Linking.addEventListener('url', (event) => {
            if (!recoveryVerifiedRef.current && !hasExchangedRef.current) {
              void processCandidateInput(event.url);
            }
          })
        : null;

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      urlSub?.remove();
    };
  }, [params.code, params.error, params.error_description, incomingLinkingUrl, sw]);

  // Redirect to Sign In approximately 2 seconds after successful password update
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => {
      router.replace('/auth/login');
    }, 2000);
    return () => clearTimeout(timer);
  }, [done, router]);

  const hasMinLength = password.length >= 10;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleUpdatePassword = async () => {
    if (password.length < 10) {
      setFormError(
        sw
          ? 'Nenosiri lazima liwe na angalau herufi 10.'
          : 'Password must be at least 10 characters long.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setFormError(sw ? 'Nenosiri halifanani.' : 'Passwords do not match.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password,
      });

      if (updateErr) {
        const lower = (updateErr.message || '').toLowerCase();
        if (lower.includes('different from the old password') || lower.includes('same_password')) {
          setFormError(
            sw
              ? 'Tafadhali chagua nenosiri jipya ambalo ni tofauti na la zamani.'
              : 'Please choose a new password that is different from your previous password.'
          );
        } else {
          setFormError(
            sw
              ? 'Imeshindikana kusasisha nenosiri. Tafadhali omba kiungo kipya.'
              : 'Unable to update password. Please request a new reset link and try again.'
          );
        }
        return;
      }

      // Destroy recovery session immediately after updating password
      await supabase.auth.signOut();

      setPassword('');
      setConfirmPassword('');
      setDone(true);
    } catch {
      setFormError(
        sw
          ? 'Imeshindikana kusasisha nenosiri. Tafadhali omba kiungo kipya.'
          : 'Unable to update password. Please request a new reset link and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logoSquircle}
          resizeMode="contain"
        />
        <Text style={styles.brand}>MloHub</Text>

        {!ready ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : done ? (
          <>
            <Text style={styles.title}>
              {sw ? 'Nenosiri Limesasishwa' : 'Password Updated'}
            </Text>
            <Text style={styles.body}>
              {sw
                ? 'Nenosiri lako la MloHub limebadilishwa kikamilifu.'
                : 'Your MloHub password has been changed successfully.'}
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.replace('/auth/login')}
              activeOpacity={0.88}
            >
              <Text style={styles.buttonText}>
                {sw ? 'Ingia MloHub' : 'Sign In to MloHub'}
              </Text>
            </TouchableOpacity>
          </>
        ) : !recoveryReady ? (
          <>
            <Text style={styles.title}>
              {sw ? 'Kiungo Kimeisha Muda' : 'Reset Link Expired'}
            </Text>
            <Text style={styles.body}>
              {recoveryError ||
                (sw
                  ? 'Kiungo hiki cha kurejesha nenosiri hakitumiki tena.'
                  : 'This password reset link is no longer valid.')}
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.replace('/auth/forgot-password')}
              activeOpacity={0.88}
            >
              <Text style={styles.buttonText}>
                {sw ? 'Omba Kiungo Kipya' : 'Request a New Reset Link'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.replace('/auth/login')}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryButtonText}>
                {sw ? 'Rudi Kuingia' : 'Back to Sign In'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>
              {sw ? 'Tengeneza Nenosiri Jipya' : 'Create New Password'}
            </Text>
            <Text style={styles.body}>
              {sw
                ? 'Chagua nenosiri jipya imara kwa akaunti yako ya MloHub.'
                : 'Choose a strong new password for your MloHub account.'}
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {sw ? 'Nenosiri Jipya' : 'New Password'}
              </Text>
              <TextInput
                accessibilityLabel="New Password"
                style={styles.input}
                placeholder={sw ? 'Weka nenosiri jipya' : 'Enter new password'}
                placeholderTextColor={colors.inputPlaceholder}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {sw ? 'Thibitisha Nenosiri Jipya' : 'Confirm New Password'}
              </Text>
              <TextInput
                accessibilityLabel="Confirm New Password"
                style={styles.input}
                placeholder={sw ? 'Rudia nenosiri jipya' : 'Re-enter new password'}
                placeholderTextColor={colors.inputPlaceholder}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <View style={styles.indicatorsBox}>
              <Text
                style={[
                  styles.indicatorItem,
                  hasMinLength ? styles.indicatorValid : styles.indicatorMuted,
                ]}
              >
                {hasMinLength ? '✓' : '○'}{' '}
                {sw ? 'Herufi 10 au zaidi' : '10+ characters'}
              </Text>
              <Text
                style={[
                  styles.indicatorItem,
                  passwordsMatch ? styles.indicatorValid : styles.indicatorMuted,
                ]}
              >
                {passwordsMatch ? '✓' : '○'}{' '}
                {sw ? 'Nenosiri linafanana' : 'Passwords match'}
              </Text>
            </View>

            {!!formError && (
              <Text accessibilityRole="alert" style={styles.error}>
                {formError}
              </Text>
            )}

            <TouchableOpacity
              disabled={saving}
              style={[styles.button, saving && { opacity: 0.65 }]}
              onPress={handleUpdatePassword}
              activeOpacity={0.88}
            >
              <Text style={styles.buttonText}>
                {saving
                  ? sw
                    ? 'Inasasisha…'
                    : 'Updating…'
                  : sw
                  ? 'Sasisha Nenosiri'
                  : 'Update Password'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.appBackground,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    padding: 28,
    backgroundColor: colors.card,
    borderRadius: Radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 14,
    ...Shadows.md,
  },
  logoSquircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  loadingWrap: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  fieldGroup: {
    width: '100%',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  input: {
    width: '100%',
    backgroundColor: colors.appBackground,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: Radii.lg,
    fontSize: 15,
    color: colors.textPrimary,
  },
  indicatorsBox: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  indicatorItem: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  indicatorValid: {
    color: colors.success,
  },
  indicatorMuted: {
    color: colors.textSecondary,
  },
  button: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: Radii.xl,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: colors.appBackground,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    borderRadius: Radii.xl,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  error: {
    color: '#b42318',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
let styles = createStyles(lightColors);
