import React from 'react';
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { formatTzs } from '../../utils/formatters';

export interface PriceTextProps {
  amountTzs: number;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  suffix?: string;
}

export const PriceText: React.FC<PriceTextProps> = ({
  amountTzs,
  size = 'md',
  color,
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
      case 'md':
      default:
        return Typography.PriceMedium;
    }
  };

  const formatted = formatTzs(amountTzs);

  return (
    <Text style={[getTypographyStyle(), color ? { color } : null, style]}>
      {prefix ? `${prefix} ` : ''}
      {formatted}
      {suffix ? ` ${suffix}` : ''}
    </Text>
  );
};
