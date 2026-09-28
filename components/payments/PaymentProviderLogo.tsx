import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { MobileMoneyMethodCode, getMobileMoneyMethodConfig } from '../../constants/paymentMethods';

export interface PaymentProviderLogoProps {
  methodCode: MobileMoneyMethodCode | string;
  size?: number;
  showLabel?: boolean;
}

/**
 * PaymentProviderLogo
 *
 * Renders an official provider logo if supplied, or a clean neutral fallback
 * using Ionicons `wallet-outline` and the provider's canonical badge.
 * Never uses emojis or fabricated corporate logos.
 */
export const PaymentProviderLogo: React.FC<PaymentProviderLogoProps> = ({
  methodCode,
  size = 40,
  showLabel = false,
}) => {
  const { colors } = useTheme();
  const config = getMobileMoneyMethodConfig(methodCode);

  const getMethodLetter = (code: string) => {
    switch (code.toUpperCase()) {
      case 'MPESA':
        return 'M';
      case 'AIRTEL_MONEY':
        return 'A';
      case 'MIXX_BY_YAS':
        return 'Y';
      case 'HALOPESA':
        return 'H';
      default:
        return 'P';
    }
  };

  const letter = getMethodLetter(String(methodCode));
  const accent = config?.accentColor || colors.primary;

  return (
    <View style={styles.outerContainer} accessibilityRole="image" accessibilityLabel={config?.displayName || 'Payment Provider'}>
      <View
        style={[
          styles.logoContainer,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.28),
            backgroundColor: colors.surfaceInteractive,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name="wallet-outline" size={Math.round(size * 0.44)} color={accent} />
        <View
          style={[
            styles.letterBadge,
            {
              backgroundColor: accent,
              right: 2,
              bottom: 2,
              width: Math.max(14, Math.round(size * 0.36)),
              height: Math.max(14, Math.round(size * 0.36)),
              borderRadius: Math.round(size * 0.18),
            },
          ]}
        >
          <Text
            style={[
              styles.letterText,
              {
                fontSize: Math.max(8, Math.round(size * 0.22)),
              },
            ]}
          >
            {letter}
          </Text>
        </View>
      </View>
      {showLabel && config && (
        <Text style={[styles.labelText, { color: colors.text }]}>
          {config.displayName}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoContainer: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  letterBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
  labelText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
