import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeColors } from '../../theme/palettes';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { BranchDeliveryZone } from '../../types/domain';
import {
  saveLastFulfillmentPreference,
  loadLastFulfillmentPreference,
} from '../../utils/cartStorage';

export type FulfillmentType = 'Delivery' | 'Takeaway' | 'Dine-In';

export interface FulfillmentSelectorProps {
  colors: ThemeColors;
  language: 'en' | 'sw';
  pricingMode: 'ROUTE_DISTANCE' | 'FIXED_ZONE';
  deliveryZones: BranchDeliveryZone[];
  branchDineInEnabled?: boolean;
  selectedFulfillment: FulfillmentType;
  onSelectFulfillment: (val: FulfillmentType) => void;
  disabled?: boolean;
}

export const FulfillmentSelector: React.FC<FulfillmentSelectorProps> = ({
  colors,
  language,
  pricingMode,
  deliveryZones,
  branchDineInEnabled = false,
  selectedFulfillment,
  onSelectFulfillment,
  disabled = false,
}) => {
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Determine supported fulfillment options in priority order
  const supportedOptions = useMemo<FulfillmentType[]>(() => {
    const list: FulfillmentType[] = [];

    // Delivery: supported if ROUTE_DISTANCE, or FIXED_ZONE with at least 1 active zone
    const hasActiveZone = deliveryZones.some((z) => z.isActive !== false);
    const supportsDelivery = pricingMode === 'ROUTE_DISTANCE' || hasActiveZone;

    if (supportsDelivery) {
      list.push('Delivery');
    }

    // Takeaway is always available per platform specification
    list.push('Takeaway');

    // Dine-In is available if enabled for branch
    if (branchDineInEnabled) {
      list.push('Dine-In');
    }

    return list;
  }, [pricingMode, deliveryZones, branchDineInEnabled]);

  // Initial load: restore remembered preference or default to first supported option
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const storedPref = await loadLastFulfillmentPreference();
      if (!isMounted) return;

      if (storedPref && supportedOptions.includes(storedPref)) {
        if (selectedFulfillment !== storedPref) {
          onSelectFulfillment(storedPref);
        }
      } else if (!supportedOptions.includes(selectedFulfillment) && supportedOptions.length > 0) {
        onSelectFulfillment(supportedOptions[0]);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [supportedOptions]);

  const handleSelect = (opt: FulfillmentType) => {
    if (disabled) return;
    onSelectFulfillment(opt);
    saveLastFulfillmentPreference(opt);
  };

  const { t } = useLanguage();

  const getOptionLabel = (opt: FulfillmentType) => {
    switch (opt) {
      case 'Delivery':
        return t('fulfillmentDelivery');
      case 'Takeaway':
        return t('fulfillmentTakeaway');
      case 'Dine-In':
        return t('fulfillmentDineIn');
    }
  };

  const getOptionIcon = (opt: FulfillmentType): keyof typeof Ionicons.glyphMap => {
    switch (opt) {
      case 'Delivery':
        return 'bicycle-outline';
      case 'Takeaway':
        return 'bag-handle-outline';
      case 'Dine-In':
        return 'restaurant-outline';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>
        {t('fulfillmentMethod')}
      </Text>
      <View style={styles.pillRow}>
        {supportedOptions.map((opt) => {
          const isSelected = selectedFulfillment === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[
                styles.pillBtn,
                isSelected && styles.pillBtnActive,
              ]}
              onPress={() => handleSelect(opt)}
              disabled={disabled}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={getOptionLabel(opt)}
            >
              <Ionicons
                name={getOptionIcon(opt)}
                size={16}
                color={isSelected ? colors.onPrimary : colors.textPrimary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.pillText,
                  isSelected && styles.pillTextActive,
                ]}
              >
                {getOptionLabel(opt)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginBottom: Spacing.sm,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: Spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    pillRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    pillBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      backgroundColor: colors.card,
      borderRadius: Radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    pillTextActive: {
      color: colors.onPrimary,
    },
  });
