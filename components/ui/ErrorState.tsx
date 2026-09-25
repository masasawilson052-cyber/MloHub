import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { Button } from './Button';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onGoBack?: () => void;
  retryTitle?: string;
  isOffline?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  onGoBack,
  retryTitle = 'Try Again',
  isOffline = false,
  style,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconCircle, isOffline && styles.offlineCircle]}>
        <Ionicons
          name={isOffline ? 'cloud-offline-outline' : 'alert-circle-outline'}
          size={36}
          color={isOffline ? colors.warning : colors.error}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.buttonRow}>
        {onGoBack ? (
          <Button
            title="Go Back"
            onPress={onGoBack}
            variant="outline"
            size="md"
            style={styles.btn}
          />
        ) : null}
        {onRetry ? (
          <Button
            title={retryTitle}
            onPress={onRetry}
            variant="primary"
            size="md"
            style={styles.btn}
          />
        ) : null}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  offlineCircle: {
    backgroundColor: colors.warningSoft,
  },
  title: {
    ...Typography.H2,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  message: {
    ...Typography.Body,
    textAlign: 'center',
    color: colors.textSecondary,
    maxWidth: 320,
    marginBottom: Spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  btn: {
    minWidth: 120,
  },
});
let styles = createStyles(lightColors);
