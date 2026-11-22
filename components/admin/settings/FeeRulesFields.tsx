import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { ThemeColors } from '../../../theme/palettes';
import { Translations } from '../../../context/LanguageContext';

export interface FeeRulesFieldsProps {
  colors: ThemeColors;
  t: (key: keyof Translations) => string;
  serviceFeeBpsInput: string;
  setServiceFeeBpsInput: (val: string) => void;
  serviceFeeMinInput: string;
  setServiceFeeMinInput: (val: string) => void;
  serviceFeeMaxInput: string;
  setServiceFeeMaxInput: (val: string) => void;
  deliveryMinOrderInput: string;
  setDeliveryMinOrderInput: (val: string) => void;
  takeawayMinOrderInput: string;
  setTakeawayMinOrderInput: (val: string) => void;
  commDeliveryInput: string;
  setCommDeliveryInput: (val: string) => void;
  commTakeawayInput: string;
  setCommTakeawayInput: (val: string) => void;
  commDineInInput: string;
  setCommDineInInput: (val: string) => void;
  freeDaysInput: string;
  setFreeDaysInput: (val: string) => void;
}

export const FeeRulesFields: React.FC<FeeRulesFieldsProps> = ({
  colors,
  t,
  serviceFeeBpsInput,
  setServiceFeeBpsInput,
  serviceFeeMinInput,
  setServiceFeeMinInput,
  serviceFeeMaxInput,
  setServiceFeeMaxInput,
  deliveryMinOrderInput,
  setDeliveryMinOrderInput,
  takeawayMinOrderInput,
  setTakeawayMinOrderInput,
  commDeliveryInput,
  setCommDeliveryInput,
  commTakeawayInput,
  setCommTakeawayInput,
  commDineInInput,
  setCommDineInInput,
  freeDaysInput,
  setFreeDaysInput,
}) => {
  const styles = createStyles(colors);

  return (
    <View>
      {/* SECTION 1: CUSTOMER SERVICE FEE (DELIVERY ORDERS) */}
      <Text style={[styles.groupHeading, { color: colors.primary }]}>
        1. Customer Service Fee (Delivery Orders)
      </Text>
      <View style={styles.formGrid}>
        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesServiceFeeBps')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={serviceFeeBpsInput}
            onChangeText={setServiceFeeBpsInput}
            keyboardType="numeric"
            placeholder="3.00"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesServiceFeeBpsHint')}
          </Text>
        </View>

        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesServiceFeeMin')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={serviceFeeMinInput}
            onChangeText={setServiceFeeMinInput}
            keyboardType="numeric"
            placeholder="200"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesServiceFeeMinHint')}
          </Text>
        </View>

        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesServiceFeeMax')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={serviceFeeMaxInput}
            onChangeText={setServiceFeeMaxInput}
            keyboardType="numeric"
            placeholder="500"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesServiceFeeMaxHint')}
          </Text>
        </View>
      </View>

      {/* SECTION 2: MINIMUM ORDER THRESHOLDS */}
      <Text style={[styles.groupHeading, { color: colors.primary }]}>
        2. Minimum Order Floors
      </Text>
      <View style={styles.formGrid}>
        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesDeliveryMinOrder')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={deliveryMinOrderInput}
            onChangeText={setDeliveryMinOrderInput}
            keyboardType="numeric"
            placeholder="5000"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesDeliveryMinOrderHint')}
          </Text>
        </View>

        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesMinOrderTakeaway')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={takeawayMinOrderInput}
            onChangeText={setTakeawayMinOrderInput}
            keyboardType="numeric"
            placeholder="2000"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesMinOrderTakeawayHint')}
          </Text>
        </View>
      </View>

      {/* SECTION 3: RESTAURANT COMMISSION RATES & INCENTIVES */}
      <Text style={[styles.groupHeading, { color: colors.primary }]}>
        3. Restaurant Commission Rates & Grace Period
      </Text>
      <View style={styles.formGrid}>
        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesCommDelivery')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={commDeliveryInput}
            onChangeText={setCommDeliveryInput}
            keyboardType="numeric"
            placeholder="8.00"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesCommDeliveryHint')}
          </Text>
        </View>

        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesCommTakeaway')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={commTakeawayInput}
            onChangeText={setCommTakeawayInput}
            keyboardType="numeric"
            placeholder="5.00"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesCommTakeawayHint')}
          </Text>
        </View>

        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesCommDineIn')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={commDineInInput}
            onChangeText={setCommDineInInput}
            keyboardType="numeric"
            placeholder="0.00"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesCommDineInHint')}
          </Text>
        </View>

        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesFreeDays')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={freeDaysInput}
            onChangeText={setFreeDaysInput}
            keyboardType="numeric"
            placeholder="30"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesFreeDaysHint')}
          </Text>
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    groupHeading: {
      fontSize: 14,
      fontWeight: '700',
      marginTop: 18,
      marginBottom: 10,
    },
    formGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 6,
    },
    formCol: {
      minWidth: 150,
      flex: 1,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 4,
    },
    inputField: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
    },
    fieldHint: {
      fontSize: 11,
      marginTop: 3,
    },
  });
