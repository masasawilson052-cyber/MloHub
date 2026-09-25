import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdminPreview } from '../../context/AdminPreviewContext';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export const AdminPreviewBanner: React.FC = () => {
  const { isAdminPreview, exitPreview } = useAdminPreview();
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  if (!isAdminPreview) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.primarySoft,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.contentRow}>
        <View style={styles.labelGroup}>
          <Ionicons name="eye-outline" size={18} color={colors.primary} />
          <Text style={[styles.bannerText, { color: colors.textPrimary }]}>
            Admin Preview Mode{' '}
            <Text style={[styles.subText, { color: colors.textSecondary }]}>
              (Customer View)
            </Text>
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.returnButton, { backgroundColor: colors.primary }]}
          onPress={exitPreview}
          accessibilityRole="button"
          accessibilityLabel="Return to Admin Console"
        >
          <Ionicons
            name="arrow-back-outline"
            size={14}
            color={colors.onPrimary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.returnButtonText, { color: colors.onPrimary }]}>
            Return to Admin
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    zIndex: 9999,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    marginHorizontal: 'auto',
    width: '100%',
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subText: {
    fontSize: 12,
    fontWeight: '400',
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  returnButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
let styles = createStyles(lightColors);
