import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export type OtpPurpose =
  | 'CUSTOMER_VERIFICATION'
  | 'RESTAURANT_ONBOARDING'
  | 'ACCOUNT_RECOVERY'
  | 'SENSITIVE_ACTION';

export interface SendOtpResult {
  success: boolean;
  carrierName?: string;
  maskedPhone?: string;
  message: string;
  cooldownRemainingSeconds?: number;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  phoneVerifiedAt?: string;
  attemptsRemaining?: number;
  isLockedOut?: boolean;
}

export class OtpApi {
  static async sendOtp(
    phone: string,
    purpose: OtpPurpose = 'CUSTOMER_VERIFICATION',
    language: 'en' | 'sw' = 'sw'
  ): Promise<SendOtpResult> {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Supabase is not configured. OTP cannot use a local production fallback.'
      );
    }

    const { data, error } = await supabase.functions.invoke('send-otp', {
      body: {
        phone,
        purpose,
        language,
      },
    });

    if (error) {
      return {
        success: false,
        message: 'Unable to send verification code.',
        error: error.message,
      };
    }

    return {
      success: Boolean(data?.success),
      carrierName: data?.carrierName,
      maskedPhone: data?.maskedPhone,
      message:
        data?.message ||
        (data?.success
          ? 'Verification code sent.'
          : 'Unable to send verification code.'),
      cooldownRemainingSeconds: data?.cooldownRemainingSeconds,
      error: data?.error,
    };
  }

  static async verifyOtp(
    phone: string,
    otp: string
  ): Promise<VerifyOtpResult> {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Supabase is not configured. OTP verification cannot use a local production fallback.'
      );
    }

    const { data, error } = await supabase.functions.invoke('verify-otp', {
      body: {
        phone,
        otp,
      },
    });

    if (error) {
      return {
        success: false,
        message: 'Unable to verify the code.',
      };
    }

    return {
      success: Boolean(data?.success),
      message:
        data?.message ||
        (data?.success
          ? 'Phone verified successfully.'
          : 'The verification code is incorrect or expired.'),
      phoneVerifiedAt: data?.phoneVerifiedAt,
      attemptsRemaining: data?.attemptsRemaining,
      isLockedOut: data?.isLockedOut,
    };
  }
}
