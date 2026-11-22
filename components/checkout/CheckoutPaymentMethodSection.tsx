import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeColors } from '../../theme/palettes';
import { PaymentMethodCode } from '../../db/types';
import { MOBILE_MONEY_METHODS } from '../../constants/paymentMethods';
import { PaymentProviderLogo } from '../payments/PaymentProviderLogo';
import { createOrderReviewStyles } from './orderReviewStyles';

export interface CheckoutPaymentMethodSectionProps {
  colors: ThemeColors;
  selectedMethod: PaymentMethodCode;
  onSelectMethod: (method: PaymentMethodCode) => void;
  payerPhone: string;
  onChangePayerPhone: (phone: string) => void;
}

export const CheckoutPaymentMethodSection: React.FC<CheckoutPaymentMethodSectionProps> = ({
  colors,
  selectedMethod,
  onSelectMethod,
  payerPhone,
  onChangePayerPhone,
}) => {
  const { t } = useLanguage();
  const styles = createOrderReviewStyles(colors);

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionLabel}>{t('paymentStepMethod')}</Text>
      <View style={styles.paymentMethodsGrid}>
        {MOBILE_MONEY_METHODS.map((pm) => (
          <TouchableOpacity
            key={pm.id}
            style={[styles.pmCard, selectedMethod === pm.id && styles.pmCardSelected]}
            onPress={() => onSelectMethod(pm.id as PaymentMethodCode)}
          >
            <PaymentProviderLogo methodCode={pm.id} size={45} />
            <Text style={[styles.pmLabel, selectedMethod === pm.id && styles.pmLabelSelected]}>
              {pm.displayName}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{t('paymentPhoneLabel')}</Text>
        <TextInput
          style={styles.textInput}
          value={payerPhone}
          onChangeText={onChangePayerPhone}
          keyboardType="phone-pad"
          placeholder="07XX XXX XXX"
          placeholderTextColor={colors.inputPlaceholder}
        />
      </View>
    </View>
  );
};
