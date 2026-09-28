/**
 * Admin MFA Gate Component
 *
 * Enforces mandatory AAL2 multi-factor authentication on all administrative portals.
 * Ensures that password-only (AAL1) sessions cannot access admin functions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { useLanguage } from '../../../context/LanguageContext';
import { AdminMfaSetup } from './AdminMfaSetup';
import { AdminMfaChallenge } from './AdminMfaChallenge';

interface AdminMfaGateProps {
  children: React.ReactNode;
}

type GateState = 'CHECKING' | 'NEED_SETUP' | 'NEED_CHALLENGE' | 'AUTHORIZED';

export const AdminMfaGate: React.FC<AdminMfaGateProps> = ({ children }) => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const { user, logout } = useAuth();
  const styles = createStyles(colors);

  const [state, setState] = useState<GateState>('CHECKING');
  const [activeFactorId, setActiveFactorId] = useState<string>('');

  const checkAalStatus = useCallback(async () => {
    setState('CHECKING');

    // In demo or test mode where Supabase Auth MFA is disabled
    try {
      if (!supabase.auth?.mfa) {
        console.error('Admin MFA API unavailable');
        await logout();
        return;
      }

      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;

      if (aalData?.currentLevel === 'aal2') {
        setState('AUTHORIZED');
        return;
      }

      // Check verified factors
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const verifiedTotp = factorsData?.totp?.find((f) => f.status === 'verified');

      if (verifiedTotp) {
        setActiveFactorId(verifiedTotp.id);
        setState('NEED_CHALLENGE');
      } else {
        setState('NEED_SETUP');
      }
    } catch (err) {
      console.warn('Admin MFA AAL check failed, requiring challenge or fallback:', err);
      // Fail closed: if error checking, force need setup or logout
      setState('NEED_SETUP');
    }
  }, []);

  useEffect(() => {
    checkAalStatus();
  }, [checkAalStatus]);

  if (state === 'CHECKING') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          {language === 'sw' ? 'Inakagua hadhi ya ulinzi wa Admin...' : 'Verifying administrator security clearance...'}
        </Text>
      </View>
    );
  }

  if (state === 'NEED_SETUP') {
    return (
      <AdminMfaSetup
        onSuccess={() => {
          setState('AUTHORIZED');
        }}
        onCancel={logout}
      />
    );
  }

  if (state === 'NEED_CHALLENGE') {
    return (
      <AdminMfaChallenge
        factorId={activeFactorId}
        onSuccess={() => {
          setState('AUTHORIZED');
        }}
        onCancel={logout}
      />
    );
  }

  return <>{children}</>;
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.appBackground,
      padding: 24,
    },
    loadingText: {
      marginTop: 14,
      fontSize: 14,
      color: colors.textSecondary,
    },
  });
