import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { CryptoEngine } from '../../db/auth/crypto';

export default function RegisterCustomerScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { registerCustomer, isAuthLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+255 ');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [location, setLocation] = useState('Mikocheni');
  const [agreeTerms, setAgreeTerms] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Password strength calculation
  const strength = CryptoEngine.checkPasswordStrength(password);

  const getStrengthBarColor = (score: number) => {
    switch (score) {
      case 1:
        return '#ef4444'; // red
      case 2:
        return '#f97316'; // orange
      case 3:
        return '#eab308'; // yellow
      case 4:
        return '#10b981'; // green
      default:
        return Colors.border;
    }
  };

  const validateForm = (): boolean => {
    const errs: { [key: string]: string } = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errs.fullName = language === 'sw' ? 'Jina linahitajika (herufi 2+)' : 'Full name is required (min 2 characters)';
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = language === 'sw' ? 'Barua pepe si sahihi' : 'Please enter a valid email address';
    }

    const cleanPhoneDigits = phone.replace(/[^0-9]/g, '');
    if (!cleanPhoneDigits || cleanPhoneDigits.length < 9) {
      errs.phone = language === 'sw' ? 'Namba ya simu inahitajika (+255...)' : 'Phone number is required (+255...)';
    }

    if (!password || password.length < 6) {
      errs.password = language === 'sw' ? 'Nenosiri linatakiwa liwe na herufi 6+' : 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      errs.confirmPassword = language === 'sw' ? 'Nenosiri halilingani' : 'Passwords do not match';
    }

    if (!agreeTerms) {
      errs.terms = language === 'sw' ? 'Lazima ukubali vigezo na masharti' : 'You must accept the terms & privacy policy';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Direct Customer Registration (No SMS OTP required)
  const handleDirectRegister = async () => {
    setGeneralError(null);
    setSuccessMessage(null);
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await registerCustomer({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        location: location.trim(),
        agreeTerms,
        dietaryPreferences: ['Fresh Food', 'Healthy'],
      });

      setSuccessMessage(
        language === 'sw'
          ? '✓ Usajili umekamilika kikamilifu! Unaelekezwa kwenye programu...'
          : '✓ Registration successful! Redirecting to app...'
      );

      setTimeout(() => {
        router.replace('/(tabs)');
      }, 600);
    } catch (err: any) {
      setGeneralError(err.message || 'Usajili umeshindikana. Tafadhali jaribu tena.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Navigation Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={Colors.brandInk} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {language === 'sw' ? 'Usajili wa Mteja' : 'Create Account'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Header */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>
            {language === 'sw' ? 'Unda Akaunti Yako' : 'Create Account'}
          </Text>
          <Text style={styles.mainSubtitle}>
            {language === 'sw'
              ? 'Jisajili ili kugundua vyakula halisi na kuagiza milo safi.'
              : 'Sign up to discover verified dishes and order delicious meals.'}
          </Text>
        </View>

        {generalError && (
          <View style={styles.generalErrorBox}>
            <Ionicons name="alert-circle" size={16} color="#b91c1c" />
            <Text style={styles.generalErrorText}>{generalError}</Text>
          </View>
        )}

        {/* Success Alert */}
        {successMessage && (
          <View style={styles.generalSuccessBox}>
            <Ionicons name="checkmark-circle" size={16} color="#166534" />
            <Text style={styles.generalSuccessText}>{successMessage}</Text>
          </View>
        )}

        {/* CUSTOMER REGISTRATION FORM */}
        <View style={styles.formCard}>
          {/* 1. Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {language === 'sw' ? 'Jina Kamili *' : 'Full Name *'}
            </Text>
            <View style={[styles.inputBox, errors.fullName && styles.inputBoxError]}>
              <Ionicons name="person-outline" size={18} color={Colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (errors.fullName) setErrors({ ...errors, fullName: '' });
                }}
                placeholder={language === 'sw' ? 'Mfano: Frank Mlaki' : 'e.g. Frank Mlaki'}
                placeholderTextColor={Colors.subtle}
                autoCapitalize="words"
              />
            </View>
            {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
          </View>

          {/* 2. Email Address */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {language === 'sw' ? 'Barua Pepe (Email) *' : 'Email Address *'}
            </Text>
            <View style={[styles.inputBox, errors.email && styles.inputBoxError]}>
              <Ionicons name="mail-outline" size={18} color={Colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors({ ...errors, email: '' });
                }}
                placeholder="name@example.com"
                placeholderTextColor={Colors.subtle}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* 3. Phone Number */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {language === 'sw' ? 'Namba ya Simu *' : 'Phone Number *'}
            </Text>
            <View style={[styles.inputBox, errors.phone && styles.inputBoxError]}>
              <Ionicons name="call-outline" size={18} color={Colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (errors.phone) setErrors({ ...errors, phone: '' });
                }}
                placeholder="+255 754 123 456"
                placeholderTextColor={Colors.subtle}
                keyboardType="phone-pad"
              />
            </View>
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>

          {/* 4. Password with Strength Meter */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {language === 'sw' ? 'Nenosiri *' : 'Password *'}
            </Text>
            <View style={[styles.inputBox, errors.password && styles.inputBoxError]}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
                placeholder="••••••••"
                placeholderTextColor={Colors.subtle}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={Colors.muted}
                />
              </TouchableOpacity>
            </View>

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <View style={styles.strengthBox}>
                <View style={styles.strengthBarsRow}>
                  {[1, 2, 3, 4].map((step) => (
                    <View
                      key={step}
                      style={[
                        styles.strengthSegment,
                        {
                          backgroundColor:
                            step <= strength.score ? getStrengthBarColor(strength.score) : Colors.borderLight,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text
                  style={[
                    styles.strengthLabel,
                    { color: getStrengthBarColor(strength.score) },
                  ]}
                >
                  Strength: {strength.label}
                </Text>
              </View>
            )}
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          {/* 5. Confirm Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {language === 'sw' ? 'Thibitisha Nenosiri *' : 'Confirm Password *'}
            </Text>
            <View style={[styles.inputBox, errors.confirmPassword && styles.inputBoxError]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                }}
                placeholder="••••••••"
                placeholderTextColor={Colors.subtle}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={Colors.muted}
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
          </View>

          {/* 6. Optional Neighborhood */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {language === 'sw' ? 'Mtaa / Eneo la Dar es Salaam (Hiari)' : 'Delivery Neighborhood (Optional)'}
            </Text>
            <View style={styles.inputBox}>
              <Ionicons name="location-outline" size={18} color={Colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. Mikocheni, Masaki, Sinza"
                placeholderTextColor={Colors.subtle}
              />
            </View>
          </View>

          {/* 7. Terms & Privacy Checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAgreeTerms(!agreeTerms)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkboxBox, agreeTerms && styles.checkboxBoxActive]}>
              {agreeTerms && <Ionicons name="checkmark" size={13} color="#ffffff" />}
            </View>
            <Text style={styles.checkboxLabel}>
              {language === 'sw'
                ? 'Ninakubali Vigezo vya Huduma na Sera ya Faragha ya MloHub'
                : 'I agree to the MloHub Terms of Service and Privacy Policy'}
            </Text>
          </TouchableOpacity>
          {errors.terms && <Text style={styles.errorText}>{errors.terms}</Text>}

          {/* DIRECT SUBMIT BUTTON - Vibrant Warm Orange CTA */}
          <TouchableOpacity
            style={[styles.submitBtn, (isSubmitting || isAuthLoading) && styles.submitBtnDisabled]}
            onPress={handleDirectRegister}
            disabled={isSubmitting || isAuthLoading}
            activeOpacity={0.88}
          >
            {isSubmitting || isAuthLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {language === 'sw' ? 'Tengeneza Akaunti →' : 'Create Account →'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Existing Account Footer Link */}
        <TouchableOpacity
          style={styles.loginFooterRow}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.loginFooterText}>
            {language === 'sw' ? 'Tayari una akaunti? ' : 'Already have an account? '}
            <Text style={styles.loginLink}>
              {language === 'sw' ? 'Ingia Hapa' : 'Sign In'}
            </Text>
          </Text>
        </TouchableOpacity>
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
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.brandInk,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 40,
  },
  largeScreenContent: {
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  titleSection: {
    marginBottom: Spacing.xl,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.brandInk,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    marginBottom: 6,
  },
  mainSubtitle: {
    fontSize: 13,
    color: Colors.muted,
    lineHeight: 19,
  },
  generalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: Radii.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  generalErrorText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  generalSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: Radii.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  generalSuccessText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xxl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
    gap: Spacing.lg,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brandInk,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radii.xl,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  inputBoxError: {
    borderColor: '#ef4444',
  },
  fieldIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.brandInk,
  },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
    marginTop: 2,
  },
  strengthBox: {
    marginTop: 4,
  },
  strengthBarsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 2,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxBoxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxLabel: {
    fontSize: 12,
    color: Colors.muted,
    flex: 1,
    lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radii.xl,
    alignItems: 'center',
    marginTop: 6,
    ...Shadows.md,
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  loginFooterRow: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  loginFooterText: {
    fontSize: 13,
    color: Colors.muted,
  },
  loginLink: {
    color: Colors.primary,
    fontWeight: '800',
  },
});
