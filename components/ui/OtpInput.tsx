import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Typography } from '../../constants/theme';

interface OtpInputProps {
  phone: string;
  carrierName?: string;
  onComplete: (code: string) => void;
  onResend?: () => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  language?: 'en' | 'sw';
  cooldownSeconds?: number;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  phone,
  carrierName,
  onComplete,
  onResend,
  isLoading = false,
  error = null,
  language = 'sw',
  cooldownSeconds = 60,
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [secondsRemaining, setSecondsRemaining] = useState(cooldownSeconds);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Countdown timer
  useEffect(() => {
    let timer: any;
    if (secondsRemaining > 0) {
      timer = setInterval(() => {
        setSecondsRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  const handleChangeText = (text: string, index: number) => {
    // Handle paste of multiple digits
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 1) {
      const newDigits = [...digits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = cleaned[i] || '';
      }
      setDigits(newDigits);
      const fullCode = newDigits.join('');
      if (fullCode.length === 6) {
        onComplete(fullCode);
      }
      inputRefs.current[Math.min(5, cleaned.length - 1)]?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleaned;
    setDigits(newDigits);

    // Auto-advance to next input
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if full code entered
    const fullCode = newDigits.join('');
    if (fullCode.length === 6) {
      onComplete(fullCode);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendPress = async () => {
    if (secondsRemaining > 0 || isResending || !onResend) return;
    setIsResending(true);
    try {
      await onResend();
      setSecondsRemaining(60);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.phoneBadge}>
        <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
        <Text style={styles.phoneText}>
          {language === 'sw' ? 'Imetumwa kwa: ' : 'Sent to: '}
          <Text style={styles.phoneHighlight}>{phone}</Text>
        </Text>
      </View>

      {carrierName ? (
        <Text style={styles.carrierText}>
          {language === 'sw' ? `Mtandao: ${carrierName}` : `Carrier: ${carrierName}`}
        </Text>
      ) : null}

      {/* 6 Digit Cells */}
      <View style={styles.cellsRow}>
        {digits.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            style={[
              styles.cell,
              digit ? styles.cellFilled : null,
              error ? styles.cellError : null,
            ]}
            keyboardType="number-pad"
            maxLength={1}
            value={digit}
            onChangeText={(text) => handleChangeText(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            editable={!isLoading}
            selectTextOnFocus
            accessibilityLabel={`Digit ${index + 1}`}
          />
        ))}
      </View>

      {/* Error Message */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Loading Indicator */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {language === 'sw' ? 'Inathibitisha...' : 'Verifying code...'}
          </Text>
        </View>
      ) : null}

      {/* Resend Action */}
      <View style={styles.resendContainer}>
        {secondsRemaining > 0 ? (
          <Text style={styles.cooldownText}>
            {language === 'sw'
              ? `Hujapata ujumbe? Omba tena baada ya sekunde ${secondsRemaining}`
              : `Didn't receive SMS? Resend in ${secondsRemaining}s`}
          </Text>
        ) : (
          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResendPress}
            disabled={isResending}
          >
            {isResending ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <>
                <Ionicons name="refresh" size={16} color={Colors.primary} />
                <Text style={styles.resendButtonText}>
                  {language === 'sw' ? 'Tuma tena msimbo wa SMS' : 'Resend SMS Code'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    width: '100%',
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 6,
  },
  phoneText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  phoneHighlight: {
    color: Colors.text,
    fontWeight: '700',
  },
  carrierText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  cellsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 320,
    marginVertical: Spacing.md,
  },
  cell: {
    width: 44,
    height: 52,
    borderRadius: Radii.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  cellFilled: {
    borderColor: Colors.primary,
    backgroundColor: '#fff7ed',
  },
  cellError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.md,
    marginTop: Spacing.sm,
    maxWidth: '90%',
  },
  errorText: {
    fontSize: 13,
    color: '#b91c1c',
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  resendContainer: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  cooldownText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
  },
  resendButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
});
