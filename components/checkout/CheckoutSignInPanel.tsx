import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeColors } from '../../theme/palettes';
import { normalizeTanzaniaPhone, isValidTanzaniaPhone } from '../../utils/phone';
import { createCheckoutSignInStyles } from './checkoutSignInStyles';

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
  const styles = createCheckoutSignInStyles(colors);

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
      setErrorMsg(t('authEmailPhoneRequired'));
      return;
    }
    if (!password) {
      setErrorMsg(t('authPasswordRequired'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await login({
        emailOrPhone: emailOrPhone.trim(),
        password,
      });

      if (!res.user) {
        setErrorMsg(t('authInvalidCredentials'));
        return;
      }

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || t('authInvalidCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    setErrorMsg(null);
    if (!fullName.trim()) {
      setErrorMsg(t('authFullNameRequired'));
      return;
    }

    const trimmedInput = emailOrPhone.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedInput);
    const isPhone = isValidTanzaniaPhone(trimmedInput);

    if (!isEmail && !isPhone) {
      setErrorMsg(t('authValidContactRequired'));
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg(t('authPasswordLength'));
      return;
    }

    if (!agreeTerms) {
      setErrorMsg(t('authTermsRequired'));
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
        setErrorMsg(t('authRegistrationFailed'));
        return;
      }

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || t('authRegistrationFailed'));
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
