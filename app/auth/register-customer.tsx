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

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

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

    if (!phone.trim() || phone.replace(/[\s-]/g, '').length < 9) {
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

  const handleSubmit = async () => {
    setGeneralError(null);
    if (!validateForm()) return;

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

      // Redirect to customer tabs
      router.replace('/(tabs)');
    } catch (err: any) {
      setGeneralError(err.message || 'Registration failed. Please try again.');
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
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {language === 'sw' ? 'Usajili wa Mteja' : 'Customer Sign Up'}
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
        {/* Title Header */}
        <View style={styles.titleSection}>
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>👤 CUSTOMER ACCOUNT</Text>
          </View>
          <Text style={styles.mainTitle}>
            {language === 'sw' ? 'Unda Akaunti Yako ya MloHub' : 'Join MloHub as a Diner'}
          </Text>
          <Text style={styles.mainSubtitle}>
            {language === 'sw'
              ? 'Gundua chakula safi, meza za VIP, na maagizo maalum ya mapema.'
              : 'Discover authentic dishes, reserve VIP tables, and order customized advance batches.'}
          </Text>
        </View>

        {generalError && (
          <View style={styles.generalErrorBox}>
            <Ionicons name="alert-circle" size={16} color="#b91c1c" />
            <Text style={styles.generalErrorText}>{generalError}</Text>
          </View>
        )}

        {/* FORM FIELDS */}
        <View style={styles.formCard}>
          {/* 1. Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {language === 'sw' ? 'Jina Kamili *' : 'Full Name *'}
            </Text>
            <View style={[styles.inputBox, errors.fullName && styles.inputBoxError]}>
              <Ionicons name="person-outline" size={17} color={Colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (errors.fullName) setErrors({ ...errors, fullName: '' });
                }}
                placeholder="e.g. Frank Mlaki"
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
              <Ionicons name="mail-outline" size={17} color={Colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors({ ...errors, email: '' });
                }}
                placeholder="user@mlohub.tz"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* 3. Phone Number */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {language === 'sw' ? 'Namba ya Simu (M-Pesa / SMS) *' : 'Phone Number (M-Pesa / SMS) *'}
            </Text>
            <View style={[styles.inputBox, errors.phone && styles.inputBoxError]}>
              <Ionicons name="call-outline" size={17} color={Colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (errors.phone) setErrors({ ...errors, phone: '' });
                }}
                placeholder="+255 754 123 456"
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
              <Ionicons name="lock-closed-outline" size={17} color={Colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
                placeholder="Min 6 characters"
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
              <Ionicons name="shield-checkmark-outline" size={17} color={Colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                }}
                placeholder="Re-enter password"
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
              {language === 'sw' ? 'Mtaa / Eneo la Dar es Salaam (Hiari)' : 'Neighborhood / Delivery Area (Optional)'}
            </Text>
            <View style={styles.inputBox}>
              <Ionicons name="location-outline" size={17} color={Colors.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. Mikocheni, Masaki, Sinza"
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

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            style={[styles.submitBtn, isAuthLoading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isAuthLoading}
            activeOpacity={0.88}
          >
            {isAuthLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {language === 'sw' ? 'Unda Akaunti ya Mteja →' : 'Create Customer Account →'}
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
            {language === 'sw' ? 'Tayari una akaunti ya MloHub? ' : 'Already have an account? '}
            <Text style={styles.loginLink}>
              {language === 'sw' ? 'Ingia Hapa' : 'Log In'}
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    padding: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.white,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.text,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 40,
  },
  largeScreenContent: {
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  titleSection: {
    marginBottom: Spacing.lg,
  },
  badgePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#113a26',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
    marginBottom: 6,
  },
  badgeText: {
    color: '#e8c468',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#113a26',
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    marginBottom: 4,
  },
  mainSubtitle: {
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 18,
  },
  generalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: Radii.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  generalErrorText: {
    color: '#b91c1c',
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },
  formCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xxl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
    gap: Spacing.md,
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  inputBoxError: {
    borderColor: '#ef4444',
  },
  fieldIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  errorText: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '700',
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
    fontSize: 9.5,
    fontWeight: '800',
    marginTop: 3,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxBoxActive: {
    backgroundColor: '#113a26',
    borderColor: '#113a26',
  },
  checkboxLabel: {
    fontSize: 11,
    color: Colors.muted,
    flex: 1,
    lineHeight: 16,
  },
  submitBtn: {
    backgroundColor: '#113a26',
    paddingVertical: 14,
    borderRadius: Radii.xl,
    alignItems: 'center',
    marginTop: 6,
    ...Shadows.md,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 13.5,
    fontWeight: '900',
  },
  loginFooterRow: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  loginFooterText: {
    fontSize: 12,
    color: Colors.muted,
  },
  loginLink: {
    color: '#113a26',
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
});
