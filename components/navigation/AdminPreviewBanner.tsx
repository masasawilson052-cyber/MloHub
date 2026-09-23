import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdminPreview } from '../../context/AdminPreviewContext';
import { useTheme } from '../../context/ThemeContext';

export const AdminPreviewBanner: React.FC = () => {
  const { isAdminPreview, exitPreview } = useAdminPreview();
  const { colors } = useTheme();

  if (!isAdminPreview) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: '#1E293B', borderBottomColor: '#334155' }]}>
      <View style={styles.contentRow}>
        <View style={styles.labelGroup}>
          <Ionicons name="eye-outline" size={18} color="#FA541C" />
          <Text style={styles.bannerText}>
            Admin Preview Mode <Text style={styles.subText}>(Customer View)</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.returnButton, { backgroundColor: colors.primary }]}
          onPress={exitPreview}
          accessibilityRole="button"
          accessibilityLabel="Return to Admin Console"
        >
          <Ionicons name="arrow-back-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.returnButtonText}>Return to Admin</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '400',
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  returnButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
