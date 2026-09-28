/**
 * Admin MFA Challenge Component (TOTP)
 *
 * Prompts verified administrators for their 6-digit TOTP code to elevate
 * their active session from AAL1 to AAL2.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../context/ThemeContext';
import { useLanguage } from '../../../context/LanguageContext';

interface AdminMfaChallengeProps {
  factorId: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export const AdminMfaChallenge: React.FC<AdminMfaChallengeProps> = ({
  factorId,
  onSuccess,
  onCancel,
}) => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const styles = createStyles(colors);

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    const trimmed = code.trim();
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setError(
        language === 'sw'
          ? 'Tafadhali weka nambari 6 sahihi za uthibitishaji.'
          : 'Please enter a valid 6-digit authenticator code.'
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create Challenge
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      // 2. Verify Code
      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: trimmed,
      });

      if (verifyError) throw verifyError;

      // 3. Confirm AAL2 elevation
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel === 'aal2') {
        onSuccess();
      } else {
        throw new Error('AAL2 verification could not be confirmed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please check your authenticator app and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="key-outline" size={36} color={colors.primary} />
        </View>

        <Text style={styles.title}>
          {language === 'sw' ? 'Uthibitishaji wa Hatua Mbili' : 'Two-Factor Authentication'}
        </Text>
        <Text style={styles.subtitle}>
          {language === 'sw'
            ? 'Weka nambari 6 za sasa kutoka kwenye app yako ya Google Authenticator au sawa na hiyo.'
            : 'Enter the 6-digit verification code from your authenticator app to access the Admin Portal.'}
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(val) => setCode(val.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={colors.inputPlaceholder}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={handleVerify}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.primaryBtnText}>
              {language === 'sw' ? 'Thibitisha na Ingia' : 'Verify & Continue'}
            </Text>
          )}
        </TouchableOpacity>

        {onCancel && (
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={submitting}>
            <Text style={styles.cancelBtnText}>
              {language === 'sw' ? 'Ghairi na Toka' : 'Cancel & Sign Out'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.appBackground,
    },
    card: {
      width: '100%',
      maxWidth: 440,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      alignItems: 'center',
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.surfaceInteractive,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    errorBox: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 10,
      backgroundColor: colors.dangerSoft || colors.surfaceInteractive,
      marginBottom: 16,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: colors.danger,
      fontWeight: '600',
    },
    inputContainer: {
      width: '100%',
      marginBottom: 20,
    },
    input: {
      width: '100%',
      height: 56,
      borderRadius: 12,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      textAlign: 'center',
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: 10,
      color: colors.textPrimary,
    },
    primaryBtn: {
      width: '100%',
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    cancelBtn: {
      marginTop: 16,
      paddingVertical: 8,
    },
    cancelBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
