import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { OtpInput } from '../ui/OtpInput';
import { OtpApi } from '../../services/api/OtpApi';

interface OtpVerificationModalProps {
  visible: boolean;
  phone: string;
  carrierName?: string;
  onVerified: () => void;
  onCancel: () => void;
  language?: 'en' | 'sw';
}

export const OtpVerificationModal: React.FC<OtpVerificationModalProps> = ({
  visible,
  phone,
  carrierName,
  onVerified,
  onCancel,
  language = 'sw',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (code: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await OtpApi.verifyOtp(phone, code);

      if (res.success) {
        onVerified();
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(
        err?.message ||
          'Verification failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);

    try {
      const res = await OtpApi.sendOtp(
        phone,
        'CUSTOMER_VERIFICATION',
        language
      );

      if (!res.success) {
        setError(
          res.error ||
            res.message ||
            'Failed to resend SMS.'
        );
      }
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to resend SMS.'
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="chatbox-ellipses-outline" size={24} color={Colors.primary} />
            </View>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>
            {language === 'sw' ? 'Thibitisha Namba ya Simu' : 'Verify Phone Number'}
          </Text>
          <Text style={styles.subtitle}>
            {language === 'sw'
              ? 'Weka msimbo wa tarakimu 6 uliotumwa kupitia ujumbe mfupi (SMS).'
              : 'Enter the 6-digit code sent to your phone via SMS.'}
          </Text>

          {/* OTP Input Component */}
          <OtpInput
            phone={phone}
            carrierName={carrierName}
            onComplete={handleVerify}
            onResend={handleResend}
            isLoading={isLoading}
            error={error}
            language={language}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
});
