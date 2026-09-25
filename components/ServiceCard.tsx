import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';

import { useTheme } from '../context/ThemeContext';
import { ThemeColors, lightColors } from '../theme/palettes';

let colors: ThemeColors = lightColors;

interface ServiceCardProps {
  id: string;
  label: string;
  detail: string;
  icon: string;
  isSelected: boolean;
  onPress: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  label,
  detail,
  icon,
  isSelected,
  onPress,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.iconWrap, isSelected && styles.iconWrapSelected]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.label, isSelected && styles.labelSelected]}>{label}</Text>
        <Text style={styles.detail} numberOfLines={1}>{detail}</Text>
      </View>
      <Text style={[styles.arrow, isSelected && styles.arrowSelected]}>›</Text>
    </TouchableOpacity>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.card,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryLight,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {
    backgroundColor: colors.primary,
  },
  icon: {
    fontSize: 20,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  labelSelected: {
    color: colors.primary,
  },
  detail: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  arrow: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: 'bold',
  },
  arrowSelected: {
    color: colors.primary,
  },
});
let styles = createStyles(lightColors);
