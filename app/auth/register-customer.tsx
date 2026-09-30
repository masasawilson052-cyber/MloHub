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
import { PlatformSettingsRepository } from '../../repositories/platformSettings.repository';
import { isValidTanzaniaPhone, normalizeTanzaniaPhone } from '../../utils/phone';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export default function RegisterCustomerScreen() {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
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
  const [location, setLocation] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

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
        return colors.border;
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

    if (!phone.trim() || !isValidTanzaniaPhone(phone)) {
      errs.phone = language === 'sw'
        ? 'Weka namba sahihi ya simu ya Tanzania (mfano: 0754 123 456 au +255 754 123 456)'
        : 'Enter a valid Tanzania phone number (e.g. 0754 123 456 or +255 754 123 456)';
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

  const handleDirectRegister = async () => {
    setGeneralError(null);
    setSuccessMessage(null);
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const opSettings = await PlatformSettingsRepository.getOperationalSettings();
      if (opSettings.maintenanceMode) {
        setGeneralError(
          language === 'sw'
            ? 'Mfumo upo kwenye matengenezo. Tafadhali jaribu tena baadaye.'
            : 'The platform is currently under maintenance. Please try again later.'
        );
        setIsSubmitting(false);
        return;
      }
      if (!opSettings.customerRegistrationEnabled) {
        setGeneralError(
          language === 'sw'
            ? 'Usajili wa wateja wapya umesitishwa kwa sasa na uongozi wa mfumo.'
            : 'New customer registration is currently paused by platform administration.'
        );
        setIsSubmitting(false);
        return;
      }

      await registerCustomer({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: normalizeTanzaniaPhone(phone) || phone.trim(),
        password,
        location: location.trim(),
        agreeTerms,
        dietaryPreferences: [],
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
          <Ionicons name="arrow-back" size={20} color={colors.brandInk} />
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
              <Ionicons name="person-outline" size={18} color={colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (errors.fullName) setErrors({ ...errors, fullName: '' });
                }}
                placeholder={language === 'sw' ? 'Mfano: Frank Mlaki' : 'e.g. Frank Mlaki'}
                placeholderTextColor={colors.inputPlaceholder}
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
              <Ionicons name="mail-outline" size={18} color={colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors({ ...errors, email: '' });
                }}
                placeholder="name@example.com"
                placeholderTextColor={colors.inputPlaceholder}
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
              <Ionicons name="call-outline" size={18} color={colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (errors.phone) setErrors({ ...errors, phone: '' });
                }}
                placeholder="+255 754 123 456"
                placeholderTextColor={colors.inputPlaceholder}
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
              <Ionicons name="lock-closed-outline" size={18} color={colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
                placeholder="••••••••"
                placeholderTextColor={colors.inputPlaceholder}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.muted}
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
                            step <= strength.score ? getStrengthBarColor(strength.score) : colors.borderLight,
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
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                }}
                placeholder="••••••••"
                placeholderTextColor={colors.inputPlaceholder}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.muted}
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
              <Ionicons name="location-outline" size={18} color={colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. Mikocheni, Masaki, Sinza"
                placeholderTextColor={colors.inputPlaceholder}
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
              {agreeTerms && <Ionicons name="checkmark" size={13} color={colors.onPrimary} />}
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
              <ActivityIndicator color={colors.onPrimary} />
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceInteractive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
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
    color: colors.textPrimary,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    marginBottom: 6,
  },
  mainSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  generalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    padding: 12,
    borderRadius: Radii.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  generalErrorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  generalSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successSoft,
    padding: 12,
    borderRadius: Radii.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.success,
  },
  generalSuccessText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.xxl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: colors.divider,
    ...Shadows.sm,
    gap: Spacing.lg,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceInteractive,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: Radii.xl,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  inputBoxError: {
    borderColor: colors.danger,
  },
  fieldIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  errorText: {
    fontSize: 11,
    color: colors.danger,
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
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxBoxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: colors.primary,
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
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  loginFooterRow: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  loginFooterText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  loginLink: {
    color: colors.primary,
    fontWeight: '800',
  },
});
let styles = createStyles(lightColors);
