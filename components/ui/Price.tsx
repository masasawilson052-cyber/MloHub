import React from 'react';
import { Text, StyleSheet, TextStyle, StyleProp, View } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { formatTzs } from '../../utils/formatters';

export interface PriceProps {
  amountTzs: number;
  size?: 'sm' | 'md' | 'lg' | 'display';
  color?: string;
  originalPriceTzs?: number;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  suffix?: string;
}

export const Price: React.FC<PriceProps> = ({
  amountTzs,
  size = 'md',
  color,
  originalPriceTzs,
  style,
  prefix,
  suffix,
}) => {
  const getTypographyStyle = (): TextStyle => {
    switch (size) {
      case 'sm':
        return Typography.PriceSmall;
      case 'lg':
        return Typography.PriceLarge;
      case 'display':
        return {
          ...Typography.PriceLarge,
          fontSize: 28,
          lineHeight: 34,
        };
      case 'md':
      default:
        return Typography.PriceMedium;
    }
  };

  const formatted = formatTzs(amountTzs);
  const formattedOriginal = originalPriceTzs ? formatTzs(originalPriceTzs) : null;

  return (
    <View style={styles.container}>
      <Text style={[getTypographyStyle(), color ? { color } : { color: Colors.brandInk }, style]}>
        {prefix ? `${prefix} ` : ''}
        {formatted}
        {suffix ? ` ${suffix}` : ''}
      </Text>
      {formattedOriginal && originalPriceTzs && originalPriceTzs > amountTzs ? (
        <Text style={styles.strikethrough}>{formattedOriginal}</Text>
      ) : null}
    </View>
  );
};

// Also export PriceText for backward compatibility
export const PriceText = Price;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  strikethrough: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
});
