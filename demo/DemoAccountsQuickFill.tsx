import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { ThemeColors } from '@/theme/palettes';
import { runtimeConfig } from '@/lib/runtimeConfig';

interface Props {
  colors: ThemeColors;
  onSelectAccount: (email: string, pass: string) => void;
}

export default function DemoAccountsQuickFill({ colors, onSelectAccount }: Props) {
  if (!runtimeConfig.isDemo) {
    return null;
  }

  const styles = createStyles(colors);

  return (
    <View style={styles.demoBox}>
      <Text style={styles.demoTitle}>⚡ Quick Demo Accounts</Text>
      <View style={styles.demoButtonsRow}>
        <TouchableOpacity
          style={[styles.demoPill, { borderColor: colors.danger }]}
          onPress={() => {
            if (!runtimeConfig.isDemo) {
              Alert.alert('Restricted', 'Demo accounts are disabled in this environment.');
              return;
            }
            onSelectAccount('admin@mlohub.tz', 'password123');
          }}
        >
          <Text style={[styles.demoPillText, { color: colors.danger }]}>🛡️ Super Admin</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.demoPill, { borderColor: '#f97316' }]}
          onPress={() => {
            if (!runtimeConfig.isDemo) {
              Alert.alert('Restricted', 'Demo accounts are disabled in this environment.');
              return;
            }
            onSelectAccount('mama.amina@mlohub.tz', 'password123');
          }}
        >
          <Text style={[styles.demoPillText, { color: colors.primary }]}>🍳 Restaurant</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.demoPill, { borderColor: '#0284c7' }]}
          onPress={() => {
            if (!runtimeConfig.isDemo) {
              Alert.alert('Restricted', 'Demo accounts are disabled in this environment.');
              return;
            }
            onSelectAccount('frank.mlaki@mlohub.tz', 'password123');
          }}
        >
          <Text style={[styles.demoPillText, { color: colors.info }]}>👤 Customer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    demoBox: {
      marginTop: 20,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.appBackground,
    },
    demoTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 12,
      color: colors.textPrimary,
    },
    demoButtonsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    demoPill: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      backgroundColor: colors.card,
      alignItems: 'center',
    },
    demoPillText: {
      fontSize: 12,
      fontWeight: '600',
    },
  });
