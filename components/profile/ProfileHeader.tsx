import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { Badge } from '../ui/Badge';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface ProfileHeaderProps {
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  onEditProfile: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  fullName,
  email,
  phone,
  location,
  onEditProfile,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials || 'ML'}</Text>
        </View>
        <View style={styles.detailsCol}>
          <Text style={styles.nameText} numberOfLines={1}>{fullName}</Text>
          <Text style={styles.emailText} numberOfLines={1}>{email}</Text>
          {phone ? <Text style={styles.phoneText}>{phone}</Text> : null}
          {location ? <Text style={styles.locationText}>📍 {location}</Text> : null}
        </View>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={onEditProfile}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <Ionicons name="pencil" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.badgeRow}>
        <Badge label="MloHub Diner" variant="neutral" size="sm" />
        {phone ? <Badge label="Active Account" variant="neutral" size="sm" /> : null}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  detailsCol: {
    flex: 1,
  },
  nameText: {
    ...Typography.H2,
    color: colors.textPrimary,
  },
  emailText: {
    ...Typography.Caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  phoneText: {
    ...Typography.Caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  locationText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
    marginTop: 2,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceInteractive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
});
let styles = createStyles(lightColors);
