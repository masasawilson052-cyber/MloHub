import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../../context/LanguageContext';
import { ThemeColors } from '../../../theme/palettes';
import { createFeeRulesStyles } from './feeRulesStyles';

interface FeeRulesConfirmModalProps {
  visible: boolean;
  colors: ThemeColors;
  changeReason: string;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const FeeRulesConfirmModal: React.FC<FeeRulesConfirmModalProps> = ({
  visible,
  colors,
  changeReason,
  isSaving,
  onCancel,
  onConfirm,
}) => {
  const { t } = useLanguage();
  const styles = createFeeRulesStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modalHeaderRow}>
            <Ionicons name="warning-outline" size={24} color={colors.warning} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t('feeRulesConfirmTitle')}
            </Text>
          </View>
          <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
            {t('feeRulesConfirmDesc')}
          </Text>
          <View style={[styles.confirmAuditBox, { backgroundColor: colors.surfaceInteractive }]}>
            <Text style={[styles.auditReasonPrompt, { color: colors.textMuted }]}>Audit Reason:</Text>
            <Text style={[styles.auditReasonVal, { color: colors.textPrimary }]}>"{changeReason}"</Text>
          </View>

          <View style={styles.modalBtnRow}>
            <TouchableOpacity
              style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              onPress={onCancel}
              disabled={isSaving}
            >
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                {t('feeRulesConfirmCancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
              onPress={onConfirm}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={styles.modalConfirmText}>{t('feeRulesConfirmSubmit')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
