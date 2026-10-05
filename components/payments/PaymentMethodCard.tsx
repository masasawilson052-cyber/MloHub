import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { MobileMoneyMethodConfig } from '../../constants/paymentMethods';
import { PaymentProviderLogo } from './PaymentProviderLogo';

export interface PaymentMethodCardProps {
  method: MobileMoneyMethodConfig;
  selected: boolean;
  onSelect: (method: MobileMoneyMethodConfig) => void;
  disabled?: boolean;
}

/**
 * PaymentMethodCard
 *
 * Selectable mobile money payment option card adhering to MloHub Design System V2:
 * - accessibilityRole="radio"
 * - accessibilityState={{ checked: selected }}
 * - Selected state highlighted with MloHub primary orange border
 * - Neutral provider logo and USSD shortcode badge
 */
export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
  method,
  selected,
  onSelect,
  disabled = false,
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${method.displayName} (${method.carrierName}), USSD ${method.ussdCode}`}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={() => onSelect(method)}
      style={[
        styles.card,
        {
          backgroundColor: selected ? colors.surfaceInteractive : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 2 : 1,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <PaymentProviderLogo methodCode={method.id} size={50} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: colors.text }]}>
            {method.displayName}
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.surfaceHover }]}>
            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
              {method.ussdCode}
            </Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {method.carrierName}
        </Text>
      </View>

      <View
        style={[
          styles.radioCircle,
          {
            borderColor: selected ? colors.primary : colors.border,
            backgroundColor: selected ? colors.primary : 'transparent',
          },
        ]}
      >
        {selected && (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  content: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  subtitle: {
    fontSize: 12,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
