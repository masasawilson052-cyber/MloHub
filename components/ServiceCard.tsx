import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';

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

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardSelected: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryLight,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {
    backgroundColor: Colors.primary,
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
    color: Colors.text,
  },
  labelSelected: {
    color: Colors.primaryDark,
  },
  detail: {
    fontSize: 10,
    color: Colors.subtle,
    marginTop: 2,
  },
  arrow: {
    fontSize: 18,
    color: Colors.subtle,
    fontWeight: 'bold',
  },
  arrowSelected: {
    color: Colors.accent,
  },
});
