import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { MobileMoneyMethodCode, getMobileMoneyMethodConfig } from '../../constants/paymentMethods';

export interface PaymentProviderLogoProps {
  methodCode: MobileMoneyMethodCode | string;
  size?: number;
  showLabel?: boolean;
}

const PAYMENT_LOGOS: Record<string, ImageSourcePropType> = {
  MPESA: require('../../assets/payments/mpesa.png'),
  AIRTEL_MONEY: require('../../assets/payments/airtel-money.png'),
  MIXX_BY_YAS: require('../../assets/payments/mixx-by-yas.png'),
  HALOPESA: require('../../assets/payments/halopesa.png'),
};

/**
 * PaymentProviderLogo
 *
 * Renders an official provider PNG logo from assets/payments/ if supplied,
 * or a clean neutral fallback using Ionicons `wallet-outline` and the provider's canonical badge.
 * Never uses emojis or fabricated corporate logos.
 */
export const PaymentProviderLogo: React.FC<PaymentProviderLogoProps> = ({
  methodCode,
  size = 40,
  showLabel = false,
}) => {
  const { colors } = useTheme();
  const [imageError, setImageError] = useState(false);
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

  const normalizedCode = String(methodCode).toUpperCase();
  const logoSource = PAYMENT_LOGOS[normalizedCode];
  const letter = getMethodLetter(normalizedCode);
  const accent = config?.accentColor || colors.primary;

  const containerWidth = Math.round(size * 1.18);

  return (
    <View style={styles.outerContainer} accessibilityRole="image" accessibilityLabel={config?.displayName || 'Payment Provider'}>
      <View
        style={[
          styles.logoContainer,
          {
            width: containerWidth,
            height: size,
            borderRadius: Math.round(size * 0.22),
            backgroundColor: '#FFFFFF',
            borderColor: colors.border,
            overflow: 'hidden',
            padding: 2,
          },
        ]}
      >
        {logoSource && !imageError ? (
          <Image
            source={logoSource}
            style={{
              width: '100%',
              height: '100%',
            }}
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <>
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
          </>
        )}
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
