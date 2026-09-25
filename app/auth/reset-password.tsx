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
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';

function getCodeFromCurrentUrl(paramCode?: string): string | undefined {
  if (paramCode && typeof paramCode === 'string' && paramCode.trim()) {
    return paramCode.trim();
  }
  if (typeof window !== 'undefined' && window.location?.search) {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    if (code && code.trim()) {
      return code.trim();
    }
  }
  return undefined;
}

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
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
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

  useEffect(() => {
    let mounted = true;

    // 1. Check URL parameters for error flags without exposing raw provider messages
    if (params.error || params.error_description) {
      cleanRecoveryUrlOnWeb();
      if (mounted) {
        setRecoveryReady(false);
        setRecoveryError(
          sw
            ? 'Kiungo hiki cha kurejesha nenosiri hakitumiki tena.'
            : 'This password reset link is no longer valid.'
        );
        setReady(true);
      }
      return;
    }

    // 2. Subscribe to PASSWORD_RECOVERY auth event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && newSession)) {
        cleanRecoveryUrlOnWeb();
        setRecoveryReady(true);
        setRecoveryError('');
        setReady(true);
      }
    });

    const initializeRecovery = async () => {
      if (hasExchangedRef.current) {
        return;
      }

      const code = getCodeFromCurrentUrl(params.code);

      if (code) {
        hasExchangedRef.current = true;
        try {
          const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          cleanRecoveryUrlOnWeb();

          if (exchangeErr || !data?.session) {
            if (mounted) {
              setRecoveryReady(false);
              setRecoveryError(
                sw
                  ? 'Kiungo hiki cha kurejesha nenosiri hakitumiki tena.'
                  : 'This password reset link is no longer valid.'
              );
              setReady(true);
            }
            return;
          }

          if (mounted) {
            setRecoveryReady(true);
            setRecoveryError('');
            setReady(true);
          }
          return;
        } catch {
          cleanRecoveryUrlOnWeb();
          if (mounted) {
            setRecoveryReady(false);
            setRecoveryError(
              sw
                ? 'Kiungo hiki cha kurejesha nenosiri hakitumiki tena.'
                : 'This password reset link is no longer valid.'
            );
            setReady(true);
          }
          return;
        }
      }

      /*
       * Existing PASSWORD_RECOVERY session may already exist.
       */
      try {
        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (!sessionErr && session) {
          if (mounted) {
            setRecoveryReady(true);
            setRecoveryError('');
            setReady(true);
          }
          return;
        }
      } catch {
        // Handled by expired state below
      }

      if (mounted) {
        setRecoveryReady(false);
        setRecoveryError(
          sw
            ? 'Kiungo hiki cha kurejesha nenosiri hakitumiki tena.'
            : 'This password reset link is no longer valid.'
        );
        setReady(true);
      }
    };

    initializeRecovery();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [params.code, params.error, params.error_description, sw]);

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
            <ActivityIndicator size="large" color={Colors.primary} />
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
                placeholderTextColor={Colors.subtle}
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
                placeholderTextColor={Colors.subtle}
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

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    padding: 28,
    backgroundColor: Colors.white,
    borderRadius: Radii.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.primary,
  },
  loadingWrap: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.muted,
    textAlign: 'center',
  },
  fieldGroup: {
    width: '100%',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
  },
  input: {
    width: '100%',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: Radii.lg,
    fontSize: 15,
    color: Colors.text,
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
    color: '#166534',
  },
  indicatorMuted: {
    color: Colors.muted,
  },
  button: {
    width: '100%',
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: Radii.xl,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 13,
    borderRadius: Radii.xl,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.text,
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
