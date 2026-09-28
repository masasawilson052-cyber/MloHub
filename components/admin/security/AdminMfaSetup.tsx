/**
 * Admin MFA Enrollment Component (TOTP)
 *
 * Guides administrators through mandatory Time-Based One-Time Password (TOTP)
 * enrollment using Supabase Auth MFA.
 * Strictly never logs the plaintext TOTP secret.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../context/ThemeContext';
import { useLanguage } from '../../../context/LanguageContext';

interface AdminMfaSetupProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export const AdminMfaSetup: React.FC<AdminMfaSetupProps> = ({ onSuccess, onCancel }) => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const styles = createStyles(colors);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [factorId, setFactorId] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function initEnrollment() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'MloHub Admin Portal',
        });

        if (enrollError) {
          throw enrollError;
        }

        if (isMounted && data) {
          setFactorId(data.id);
          // Set secret for manual authenticator entry (never console.log secret)
          setSecret(data.totp.secret);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to initialize MFA enrollment. Please try again.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initEnrollment();

    return () => {
      isMounted = false;
    };
  }, []);

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
      // Create challenge and verify factor atomically
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: trimmed,
      });

      if (verifyError) throw verifyError;

      // Re-verify AAL2 is achieved
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel === 'aal2') {
        onSuccess();
      } else {
        throw new Error('AAL2 verification could not be confirmed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid verification code. Please check your authenticator app.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopySecret = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          {language === 'sw' ? 'Inaandaa uthibitishaji wa MFA...' : 'Initializing MFA setup...'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
        </View>

        <Text style={styles.title}>
          {language === 'sw' ? 'Washa Ulinzi wa Hatua Mbili (MFA)' : 'Enable Admin Two-Factor Authentication'}
        </Text>
        <Text style={styles.subtitle}>
          {language === 'sw'
            ? 'Akaunti zote za Wasimamizi (Admin & Super Admin) zinahitaji Google Authenticator au app inayofanana kulinda mfumo.'
            : 'All Administrator accounts require mandatory TOTP authentication (Google Authenticator, Authy, or 1Password).'}
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.stepBox}>
          <Text style={styles.stepTitle}>
            {language === 'sw' ? 'Hatua 1: Sajili Ufunguo Kwenye App Yako' : 'Step 1: Add Account to Authenticator'}
          </Text>
          <Text style={styles.instructionText}>
            {language === 'sw'
              ? 'Fungua app yako ya Authenticator, chagua "Add account manually", kisha weka ufunguo huu:'
              : 'Open your Authenticator app, select "Add account manually / Enter key", and input this key:'}
          </Text>

          <View style={styles.secretContainer}>
            <Text style={styles.secretText} selectable>
              {secret}
            </Text>
          </View>
        </View>

        <View style={styles.stepBox}>
          <Text style={styles.stepTitle}>
            {language === 'sw' ? 'Hatua 2: Weka Nambari ya Uthibitisho' : 'Step 2: Enter Verification Code'}
          </Text>
          <Text style={styles.instructionText}>
            {language === 'sw'
              ? 'Weka nambari 6 zinazotolewa na app yako sasa hivi:'
              : 'Enter the 6-digit code currently displayed in your Authenticator app:'}
          </Text>

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
              {language === 'sw' ? 'Thibitisha na Washa MFA' : 'Verify & Enable MFA'}
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
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      backgroundColor: colors.appBackground,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textSecondary,
    },
    card: {
      width: '100%',
      maxWidth: 480,
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
    stepBox: {
      width: '100%',
      backgroundColor: colors.surfaceInteractive,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stepTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    instructionText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 10,
      lineHeight: 17,
    },
    secretContainer: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      alignItems: 'center',
    },
    secretText: {
      fontSize: 16,
      fontFamily: 'monospace',
      fontWeight: '700',
      letterSpacing: 2,
      color: colors.primary,
    },
    input: {
      width: '100%',
      height: 52,
      borderRadius: 10,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      textAlign: 'center',
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: 8,
      color: colors.textPrimary,
    },
    primaryBtn: {
      width: '100%',
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    primaryBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    cancelBtn: {
      marginTop: 12,
      paddingVertical: 8,
    },
    cancelBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
