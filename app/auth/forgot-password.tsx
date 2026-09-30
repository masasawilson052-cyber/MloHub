import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordScreen() {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const router = useRouter();
  const { language } = useLanguage();
  const { resetPassword } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const sendRecoveryRequest = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg(
        language === 'sw'
          ? 'Tafadhali weka barua pepe yako.'
          : 'Please enter your email address.'
      );
      return;
    }
    if (cooldownSeconds > 0 || isSubmitting) {
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await resetPassword(cleanEmail);
      setSubmitted(true);
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (error: any) {
      const msg = error?.message || '';
      if (
        msg.toLowerCase().includes('wait a moment') ||
        msg.toLowerCase().includes('rate limit') ||
        msg.toLowerCase().includes('too many')
      ) {
        setErrorMsg(
          language === 'sw'
            ? 'Tafadhali subiri kidogo kabla ya kuomba barua pepe nyingine.'
            : 'Please wait a moment before requesting another reset email.'
        );
      } else if (msg.toLowerCase().includes('valid email')) {
        setErrorMsg(
          language === 'sw'
            ? 'Weka barua pepe sahihi.'
            : 'Enter a valid email address.'
        );
      } else {
        setErrorMsg(
          language === 'sw'
            ? 'Huduma ya kurejesha nenosiri haipatikani kwa sasa. Tafadhali jaribu tena.'
            : 'Recovery is temporarily unavailable. Please try again later.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {language === 'sw' ? 'Umesahau Nenosiri' : 'Forgot Password'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={[styles.content, isLargeScreen && styles.largeContent]}>
        {!submitted ? (
          <View style={styles.card}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logoSquircle}
              resizeMode="contain"
            />
            <Text style={styles.brandLabel}>MloHub</Text>

            <Text style={styles.cardTitle}>
              {language === 'sw' ? 'Umesahau Nenosiri' : 'Forgot Password'}
            </Text>
            <Text style={styles.cardSub}>
              {language === 'sw'
                ? 'Weka barua pepe iliyounganishwa na akaunti yako ya MloHub.'
                : 'Enter the email address connected to your MloHub account.'}
            </Text>

            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>
                {language === 'sw' ? 'Barua Pepe' : 'Email Address'}
              </Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={colors.inputPlaceholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Email Address"
              />
            </View>

            {!!errorMsg && (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {errorMsg}
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (isSubmitting || cooldownSeconds > 0) && { opacity: 0.7 },
              ]}
              onPress={sendRecoveryRequest}
              disabled={isSubmitting || cooldownSeconds > 0}
              activeOpacity={0.88}
            >
              <Text style={styles.submitBtnText}>
                {isSubmitting
                  ? language === 'sw'
                    ? 'Inatuma...'
                    : 'Sending...'
                  : language === 'sw'
                  ? 'Tuma Kiungo cha Kurejesha'
                  : 'Send Reset Link'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryLinkBtn}
              onPress={() => router.replace('/auth/login')}
            >
              <Text style={styles.secondaryLinkText}>
                {language === 'sw' ? 'Rudi Kuingia' : 'Back to Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="mail-unread-outline" size={30} color={colors.primary} />
            </View>

            <Text style={styles.cardTitle}>
              {language === 'sw' ? 'Angalia Barua Pepe Yako' : 'Check Your Email'}
            </Text>
            <Text style={styles.cardSub}>
              {language === 'sw'
                ? 'Ikiwa akaunti ya MloHub ipo kwa barua pepe hii, maelekezo ya kurejesha nenosiri yametumwa.'
                : 'If an MloHub account exists for this email address, password reset instructions have been sent.'}
            </Text>

            {!!errorMsg && (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {errorMsg}
              </Text>
            )}

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => router.replace('/auth/login')}
              activeOpacity={0.88}
            >
              <Text style={styles.submitBtnText}>
                {language === 'sw' ? 'Rudi Kuingia' : 'Back to Sign In'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.resendBtn,
                (isSubmitting || cooldownSeconds > 0) && styles.resendBtnDisabled,
              ]}
              onPress={sendRecoveryRequest}
              disabled={isSubmitting || cooldownSeconds > 0}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.resendBtnText,
                  (isSubmitting || cooldownSeconds > 0) && styles.resendBtnTextDisabled,
                ]}
              >
                {cooldownSeconds > 0
                  ? language === 'sw'
                    ? `Tuma Tena (${cooldownSeconds}s)`
                    : `Send Again (${cooldownSeconds}s)`
                  : isSubmitting
                  ? language === 'sw'
                    ? 'Inatuma...'
                    : 'Sending...'
                  : language === 'sw'
                  ? 'Tuma Tena'
                  : 'Send Again'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: {
    padding: 6,
    borderRadius: Radii.full,
    backgroundColor: colors.card,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  content: {
    padding: Spacing.xl,
    flex: 1,
    justifyContent: 'center',
  },
  largeContent: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: Radii.xxl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...Shadows.md,
  },
  logoSquircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    marginBottom: 8,
  },
  brandLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.appBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    marginBottom: 6,
    textAlign: 'center',
  },
  cardSub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  fieldBox: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.appBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  errorText: {
    color: '#b42318',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  submitBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: Radii.xl,
    alignItems: 'center',
  },
  submitBtnText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryLinkBtn: {
    marginTop: Spacing.md,
    paddingVertical: 6,
  },
  secondaryLinkText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  resendBtn: {
    width: '100%',
    marginTop: Spacing.sm,
    paddingVertical: 12,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.appBackground,
    alignItems: 'center',
  },
  resendBtnDisabled: {
    opacity: 0.6,
  },
  resendBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  resendBtnTextDisabled: {
    color: colors.textSecondary,
  },
});
let styles = createStyles(lightColors);
