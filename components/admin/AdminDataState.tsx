import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface AdminDataStateProps {
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyIcon?: keyof typeof Ionicons.glyphMap;
  loadingMessage?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

export const AdminDataState: React.FC<AdminDataStateProps> = ({
  loading = false,
  error = null,
  isEmpty = false,
  emptyTitle = 'No Records Available',
  emptySubtitle = 'There are no active records to display at this time.',
  emptyIcon = 'folder-open-outline',
  loadingMessage = 'Loading authoritative platform records...',
  onRetry,
  children,
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  styles = createStyles(colors);

  // 1. Loading State
  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{loadingMessage}</Text>
      </View>
    );
  }

  // 2. Authoritative Error State (Never mask database errors as empty)
  if (error) {
    return (
      <View
        style={[
          styles.stateContainer,
          styles.errorBox,
          { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
        ]}
      >
        <Ionicons name="alert-circle" size={40} color={colors.danger} />
        <Text style={[styles.errorTitle, { color: colors.danger }]}>
          Authoritative Data Unavailable
        </Text>
        <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
          {error}
        </Text>
        {onRetry && (
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.danger }]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry loading platform data"
          >
            <Ionicons name="refresh" size={14} color={colors.onPrimary} />
            <Text style={[styles.retryBtnText, { color: colors.onPrimary }]}>Retry Query</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // 3. Genuine Empty State
  if (isEmpty) {
    return (
      <View style={styles.stateContainer}>
        <Ionicons name={emptyIcon} size={48} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{emptyTitle}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{emptySubtitle}</Text>
        {onRetry && (
          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Refresh records"
          >
            <Ionicons name="refresh" size={14} color={colors.textPrimary} />
            <Text style={[styles.refreshBtnText, { color: colors.textPrimary }]}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // 4. Success with Data
  return <>{children}</>;
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    stateContainer: {
      paddingVertical: 50,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    loadingText: {
      fontSize: 13,
      fontWeight: '600',
      marginTop: 4,
    },
    errorBox: {
      borderRadius: 12,
      borderWidth: 1,
      marginVertical: 20,
      paddingVertical: 32,
    },
    errorTitle: {
      fontSize: 16,
      fontWeight: '800',
    },
    errorSubtitle: {
      fontSize: 13,
      textAlign: 'center',
      maxWidth: 450,
      lineHeight: 18,
    },
    retryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    retryBtnText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginTop: 6,
    },
    emptySubtitle: {
      fontSize: 13,
      textAlign: 'center',
      maxWidth: 400,
      lineHeight: 18,
    },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    refreshBtnText: {
      fontSize: 12,
      fontWeight: '600',
    },
  });

let styles = createStyles(lightColors);
