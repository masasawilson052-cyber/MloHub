import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeColors } from '../../theme/palettes';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { normalizeTanzaniaPhone, isValidTanzaniaPhone } from '../../utils/phone';

export interface CheckoutSignInPanelProps {
  colors: ThemeColors;
  onSuccess: () => void;
  onCancel?: () => void;
}

type AuthTab = 'SIGN_IN' | 'SIGN_UP';

export const CheckoutSignInPanel: React.FC<CheckoutSignInPanelProps> = ({
  colors,
  onSuccess,
  onCancel,
}) => {
  const router = useRouter();
  const { language, t } = useLanguage();
  const { login, registerCustomer } = useAuth();
  const styles = createStyles(colors);

  const [activeTab, setActiveTab] = useState<AuthTab>('SIGN_IN');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async () => {
    setErrorMsg(null);
    if (!emailOrPhone.trim()) {
      setErrorMsg(
        language === 'sw'
          ? 'Tafadhali weka barua pepe au namba ya simu.'
          : 'Please enter your email or phone number.'
      );
      return;
    }
    if (!password) {
      setErrorMsg(
        language === 'sw' ? 'Tafadhali weka nenosiri lako.' : 'Please enter your password.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await login({
        emailOrPhone: emailOrPhone.trim(),
        password,
      });

      if (!res.user) {
        setErrorMsg(
          language === 'sw'
            ? 'Taarifa za kuingia si sahihi. Tafadhali jaribu tena.'
            : 'Invalid credentials. Please try again.'
        );
        return;
      }

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || (language === 'sw' ? 'Imeshindwa kuingia.' : 'Login failed.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    setErrorMsg(null);
    if (!fullName.trim()) {
      setErrorMsg(language === 'sw' ? 'Tafadhali weka jina kamili.' : 'Please enter your full name.');
      return;
    }

    const trimmedInput = emailOrPhone.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedInput);
    const isPhone = isValidTanzaniaPhone(trimmedInput);

    if (!isEmail && !isPhone) {
      setErrorMsg(
        language === 'sw'
          ? 'Tafadhali weka barua pepe sahihi au namba ya simu ya Tanzania (+255).'
          : 'Please enter a valid email or Tanzania phone number (+255).'
      );
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg(
        language === 'sw'
          ? 'Nenosiri linatakiwa kuwa na herufi 6 au zaidi.'
          : 'Password must be at least 6 characters.'
      );
      return;
    }

    if (!agreeTerms) {
      setErrorMsg(
        language === 'sw'
          ? 'Lazima ukubali vigezo na masharti ili kuendelea.'
          : 'You must accept the terms & privacy policy to continue.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const cleanPhone = (isPhone ? normalizeTanzaniaPhone(trimmedInput) : '') || '';
      const cleanEmail = isEmail ? trimmedInput.toLowerCase() : `user_${Date.now()}@mlohub.co.tz`;

      const regResult = await registerCustomer({
        fullName: fullName.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        password,
        location: '',
        agreeTerms: true,
        dietaryPreferences: [],
      });

      if (!regResult.user) {
        setErrorMsg(
          language === 'sw'
            ? 'Usajili umeshindwa. Tafadhali jaribu tena.'
            : 'Registration failed. Please try again.'
        );
        return;
      }

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || (language === 'sw' ? 'Usajili umeshindwa.' : 'Registration failed.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="person-circle-outline" size={24} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('signInToCheckout')}</Text>
          <Text style={styles.subtitle}>{t('signInSubtitle')}</Text>
        </View>
        {onCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'SIGN_IN' && styles.tabBtnActive]}
          onPress={() => {
            setActiveTab('SIGN_IN');
            setErrorMsg(null);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'SIGN_IN' && styles.tabTextActive]}>
            {t('tabSignIn')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'SIGN_UP' && styles.tabBtnActive]}
          onPress={() => {
            setActiveTab('SIGN_UP');
            setErrorMsg(null);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'SIGN_UP' && styles.tabTextActive]}>
            {t('tabQuickSignUp')}
          </Text>
        </TouchableOpacity>
      </View>

      {errorMsg ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {/* Form Fields */}
      {activeTab === 'SIGN_UP' && (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('fullNameLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={language === 'sw' ? 'mfano: Frank Mlaki' : 'e.g. Frank Mlaki'}
            placeholderTextColor={colors.inputPlaceholder}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
        </View>
      )}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{t('emailOrPhoneLabel')}</Text>
        <TextInput
          style={styles.input}
          placeholder="07XX XXX XXX / name@example.com"
          placeholderTextColor={colors.inputPlaceholder}
          value={emailOrPhone}
          onChangeText={setEmailOrPhone}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.fieldGroup}>
        <View style={styles.passwordLabelRow}>
          <Text style={styles.label}>{t('passwordLabel')}</Text>
          {activeTab === 'SIGN_IN' && (
            <TouchableOpacity onPress={() => router.push('/auth/forgot-password')}>
              <Text style={styles.forgotLink}>{t('forgotPasswordLink')}</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.passwordInputWrap}>
          <TextInput
            style={[styles.input, { flex: 1, borderWidth: 0 }]}
            placeholder="••••••••"
            placeholderTextColor={colors.inputPlaceholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeBtn}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'SIGN_UP' && (
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setAgreeTerms(!agreeTerms)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={agreeTerms ? 'checkbox' : 'square-outline'}
            size={20}
            color={agreeTerms ? colors.primary : colors.textMuted}
          />
          <Text style={styles.termsText}>{t('termsAgree')}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: colors.primary }]}
        onPress={activeTab === 'SIGN_IN' ? handleSignIn : handleSignUp}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : (
          <Text style={styles.submitBtnText}>
            {activeTab === 'SIGN_IN' ? t('signInBtn') : t('signUpBtn')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: Spacing.sm,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    cancelBtn: {
      padding: 4,
    },
    tabRow: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceInteractive,
      borderRadius: Radii.sm,
      padding: 3,
      marginBottom: Spacing.md,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 7,
      alignItems: 'center',
      borderRadius: Radii.sm - 2,
    },
    tabBtnActive: {
      backgroundColor: colors.card,
    },
    tabText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.dangerSoft || '#FEE2E2',
      borderWidth: 1,
      borderColor: colors.danger,
      padding: 8,
      borderRadius: Radii.sm,
      marginBottom: Spacing.sm,
    },
    errorText: {
      fontSize: 12,
      color: colors.danger,
      flex: 1,
      fontWeight: '600',
    },
    fieldGroup: {
      marginBottom: Spacing.sm,
    },
    label: {
      fontSize: 11.5,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 3,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder || colors.border,
      backgroundColor: colors.inputBackground || colors.card,
      color: colors.textPrimary,
      borderRadius: Radii.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 8,
      fontSize: 13.5,
    },
    passwordLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 3,
    },
    forgotLink: {
      fontSize: 11.5,
      color: colors.primary,
      fontWeight: '600',
    },
    passwordInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.inputBorder || colors.border,
      backgroundColor: colors.inputBackground || colors.card,
      borderRadius: Radii.sm,
    },
    eyeBtn: {
      paddingHorizontal: 10,
    },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginVertical: Spacing.xs,
    },
    termsText: {
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
    },
    submitBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: Radii.sm,
      marginTop: 6,
    },
    submitBtnText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.onPrimary,
    },
  });
