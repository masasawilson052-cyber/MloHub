import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Typography, Shadows } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { OtpApi } from '../../services/api/OtpApi';
import { OtpInput } from '../../components/ui/OtpInput';
import { normalizeTanzanianPhone } from '../../utils/phoneNormalization';
import { runtimeConfig } from '../../lib/runtimeConfig';
import { supabase } from '../../lib/supabase';
import { CryptoEngine } from '../../db/auth/crypto';

export default function ActivateRestaurantScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { login } = useAuth();

  const [step, setStep] = useState<'PHONE' | 'OTP' | 'PASSWORD'>('PHONE');
  const [phone, setPhone] = useState('+255 ');
  const [detectedCarrier, setDetectedCarrier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Step 1: Request Activation Code
  const handleRequestCode = async () => {
    setErrorMessage(null);
    const norm = normalizeTanzanianPhone(phone);
    if (!norm.valid) {
      setErrorMessage(
        norm.error ||
          (language === 'sw'
            ? 'Tafadhali weka namba sahihi ya Kitanzania.'
            : 'Please enter a valid Tanzanian phone number.')
      );
      return;
    }

    setDetectedCarrier(norm.carrier);
    setIsLoading(true);
    try {
      const res = await OtpApi.sendOtp(
        norm.e164,
        'RESTAURANT_ONBOARDING',
        language
      );

      if (res.success) {
        setStep('OTP');
      } else {
        setErrorMessage(res.error || res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send activation code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Handle OTP Completion
  const handleOtpComplete = async (code: string) => {
    setErrorMessage(null);
    setOtpCode(code);
    setIsLoading(true);
    try {
      const norm = normalizeTanzanianPhone(phone);
      const res = await OtpApi.verifyOtp(norm.e164, code);
      if (res.success) {
        setStep('PASSWORD');
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Set Secure Password and Activate
  const handleSetPassword = async () => {
    setErrorMessage(null);
    if (!password || password.length < 6) {
      setErrorMessage(
        language === 'sw'
          ? 'Nenosiri lazima liwe na angalau herufi 6.'
          : 'Password must be at least 6 characters.'
      );
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(
        language === 'sw' ? 'Nenosiri halilingani.' : 'Passwords do not match.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const norm = normalizeTanzanianPhone(phone);
      if (runtimeConfig.allowLocalDataFallbacks) {
        const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
        const db = DemoAuthAdapter.getSnapshot();
        const user = (db.users || []).find(
          (u: any) => normalizeTanzanianPhone(u.phone).e164 === norm.e164
        );

        if (!user) {
          throw new Error(
            language === 'sw'
              ? 'Akaunti ya mmiliki haikupatikana kwa namba hii.'
              : 'No vendor owner account found for this phone number.'
          );
        }

        const newHash = CryptoEngine.hashPassword(password);
        user.passwordHash = newHash;
        user.isPhoneVerified = true;
        user.phoneVerifiedAt = new Date().toISOString();
        user.securityPin = undefined;

        setSuccessMessage(
          language === 'sw'
            ? '✓ Akaunti yako imewashwa kikamilifu! Inaingia sasa...'
            : '✓ Account activated successfully! Logging you in...'
        );

        await login({ emailOrPhone: user.email || norm.e164, password });
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;

        setSuccessMessage(
          language === 'sw'
            ? '✓ Akaunti yako imewashwa kikamilifu! Inaingia sasa...'
            : '✓ Account activated successfully! Logging you in...'
        );

        await login({ emailOrPhone: norm.e164, password });
      }

      setTimeout(() => {
        router.replace('/restaurant-portal');
      }, 800);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Activation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
              {language === 'sw' ? 'Kuanzisha Mgahawa' : 'Activate Restaurant'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Hero Banner */}
          <View style={styles.heroCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="storefront-outline" size={32} color={Colors.primary} />
            </View>
            <Text style={styles.heroTitle}>
              {language === 'sw' ? 'Washa Akaunti ya Mgahawa' : 'Activate Restaurant Portal'}
            </Text>
            <Text style={styles.heroSubtitle}>
              {language === 'sw'
                ? 'Thibitisha namba yako ya simu iliyosajiliwa na uweke nenosiri lako salama la kuingia kwenye mfumo.'
                : 'Verify your registered phone number via SMS OTP and set your private password to access the portal.'}
            </Text>
          </View>

          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Success Banner */}
          {successMessage ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          ) : null}

          {/* STEP 1: Enter Phone */}
          {step === 'PHONE' && (
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>
                {language === 'sw' ? 'Namba ya Simu ya Mmiliki' : 'Owner Phone Number'}
              </Text>
              <View style={styles.inputRow}>
                <Ionicons name="call-outline" size={20} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="+255 7XX XXX XXX"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  editable={!isLoading}
                />
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleRequestCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>
                      {language === 'sw' ? 'Tuma Msimbo wa SMS' : 'Send SMS Activation Code'}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: Enter 6-Digit OTP */}
          {step === 'OTP' && (
            <View style={styles.card}>
              <OtpInput
                phone={phone}
                carrierName={detectedCarrier}
                onComplete={handleOtpComplete}
                onResend={handleRequestCode}
                isLoading={isLoading}
                error={errorMessage}
                language={language}
              />
            </View>
          )}

          {/* STEP 3: Set Secure Password */}
          {step === 'PASSWORD' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {language === 'sw' ? 'Weka Nenosiri Lako Salama' : 'Set Your Secure Password'}
              </Text>

              <Text style={styles.fieldLabel}>
                {language === 'sw' ? 'Nenosiri Jipya' : 'New Password'}
              </Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>
                {language === 'sw' ? 'Rudia Nenosiri' : 'Confirm Password'}
              </Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!isLoading}
                />
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleSetPassword}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>
                      {language === 'sw' ? 'Washa na Ingia Portal' : 'Activate & Enter Portal'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    width: '100%',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.background,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 52,
    marginBottom: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: Radii.lg,
    marginTop: Spacing.md,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    padding: Spacing.md,
    borderRadius: Radii.md,
    marginBottom: Spacing.md,
    width: '100%',
  },
  errorText: {
    fontSize: 13,
    color: '#b91c1c',
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    padding: Spacing.md,
    borderRadius: Radii.md,
    marginBottom: Spacing.md,
    width: '100%',
  },
  successText: {
    fontSize: 13,
    color: '#15803d',
    flex: 1,
  },
});
