/**
 * MloHub SMS & OTP Service (Stage 8 Production Architecture)
 * High-level service facade for sending OTPs, verifying OTPs, dispatching notifications,
 * and immutable delivery logging.
 */

import { MloHubDB } from '../../db';
import { SmsFactory } from './SmsFactory';
import { SmsGateway, SmsSendResult } from './SmsGateway';
import { OtpSecurityEngine, OtpChallengeRecord } from './OtpSecurityEngine';
import { SmsTemplates, OtpPurpose, SmsLanguage } from './smsTemplates';
import { normalizeTanzanianPhone } from '../../utils/phoneNormalization';

export interface SendOtpOptions {
  phone: string;
  purpose?: OtpPurpose;
  language?: SmsLanguage;
}

export interface SendOtpServiceResult {
  success: boolean;
  carrierName: string;
  maskedPhone: string;
  message: string;
  cooldownRemainingSeconds?: number;
  error?: string;
}

export interface VerifyOtpServiceResult {
  success: boolean;
  message: string;
  isLockedOut?: boolean;
  attemptsRemaining?: number;
}

export class SmsService {
  /**
   * 1. Send OTP Verification Code to Tanzanian Mobile Number
   * Strictly enforces phone normalization, rate limits, prior invalidation, and secure hashing.
   * Plaintext OTP is transmitted via SMS provider and NEVER persisted to database or returned in response.
   */
  public static async sendOtp(options: SendOtpOptions): Promise<SendOtpServiceResult> {
    const { phone, purpose = 'CUSTOMER_VERIFICATION', language = 'sw' } = options;

    await MloHubDB.init();

    // Fetch existing challenges for rate limiting & prior invalidation
    const existingChallenges = (await MloHubDB.otpChallenges.getAll()) as OtpChallengeRecord[];

    const prep = OtpSecurityEngine.prepareNewChallenge(phone, purpose, existingChallenges);
    if (!prep.success || !prep.newChallenge || !prep.rawOtp) {
      return {
        success: false,
        carrierName: prep.carrierName,
        maskedPhone: phone,
        message: prep.error || 'Failed to prepare OTP challenge',
        cooldownRemainingSeconds: prep.cooldownRemainingSeconds,
        error: prep.error,
      };
    }

    // Invalidate prior active challenges for this phone
    for (const challengeId of prep.challengesToInvalidate) {
      await MloHubDB.otpChallenges.invalidate(challengeId);
    }

    // Save new hashed challenge to database
    await MloHubDB.otpChallenges.create(prep.newChallenge);

    // Resolve SMS gateway
    const gateway = SmsFactory.getGateway();
    const smsResult: SmsSendResult = await gateway.sendOtp(
      prep.normPhone,
      prep.rawOtp,
      purpose,
      language
    );

    // Log delivery in immutable sms_logs
    await MloHubDB.smsLogs.create({
      id: `sms_log_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      recipient: prep.normPhone,
      carrier: prep.carrierName,
      templateId: `OTP_${purpose}`,
      provider: smsResult.provider,
      providerMessageId: smsResult.messageId,
      status: smsResult.deliveryStatus || (smsResult.success ? 'SENT' : 'FAILED'),
      errorMessage: smsResult.error,
      createdAt: new Date().toISOString(),
    });

    const norm = normalizeTanzanianPhone(phone);

    return {
      success: smsResult.success,
      carrierName: prep.carrierName,
      maskedPhone: norm.masked,
      message: smsResult.success
        ? (language === 'sw'
            ? `Msimbo wa uthibitisho umetumwa kupitia ${prep.carrierName}. Inatumika kwa dakika 5.`
            : `Verification code dispatched via ${prep.carrierName}. Valid for 5 minutes.`)
        : (smsResult.error || 'Failed to deliver SMS'),
      error: smsResult.error,
    };
  }

  /**
   * 2. Verify an entered 6-digit OTP code against the active challenge
   */
  public static async verifyOtp(phone: string, enteredOtp: string): Promise<VerifyOtpServiceResult> {
    if (!enteredOtp || enteredOtp.trim().length === 0) {
      return {
        success: false,
        message: 'Tafadhali weka msimbo wa tarakimu 6 (Please enter the 6-digit code).',
      };
    }

    const norm = normalizeTanzanianPhone(phone);
    if (!norm.valid) {
      return {
        success: false,
        message: norm.error || 'Namba ya simu si sahihi.',
      };
    }

    await MloHubDB.init();
    const challenge = (await MloHubDB.otpChallenges.getActiveByPhone(norm.e164)) as OtpChallengeRecord | null;

    const verifyResult = OtpSecurityEngine.verifyChallenge(challenge, enteredOtp);

    if (challenge) {
      // Increment attempt count
      await MloHubDB.otpChallenges.incrementAttempts(challenge.id);
    }

    if (!verifyResult.success) {
      return {
        success: false,
        message: verifyResult.message,
        isLockedOut: verifyResult.isLockedOut,
        attemptsRemaining: verifyResult.attemptsRemaining,
      };
    }

    // Mark challenge verified in database
    if (verifyResult.challengeId) {
      await MloHubDB.otpChallenges.markVerified(verifyResult.challengeId);
    }

    // If user profile exists, update phone_verified_at
    const existingUser = (await MloHubDB.users.getAll()).find(
      (u) => normalizeTanzanianPhone(u.phone).e164 === norm.e164
    );
    if (existingUser) {
      await MloHubDB.users.update(existingUser.id, {
        isPhoneVerified: true,
        phoneVerifiedAt: new Date().toISOString(),
      });
    }

    return {
      success: true,
      message: 'Uthibitisho umekamilika kikamilifu (Phone verified successfully).',
    };
  }

  /**
   * 3. Send Transactional Notification (Order, Reservation, Vendor Alert)
   */
  public static async sendNotification(
    phone: string,
    message: string,
    templateId?: string
  ): Promise<SmsSendResult> {
    const norm = normalizeTanzanianPhone(phone);
    if (!norm.valid) {
      return {
        success: false,
        provider: 'SANDBOX',
        error: norm.error || 'Invalid phone format',
        deliveryStatus: 'FAILED',
      };
    }

    const gateway = SmsFactory.getGateway();
    const result = await gateway.sendNotification(norm.e164, message, templateId);

    await MloHubDB.init();
    await MloHubDB.smsLogs.create({
      id: `sms_log_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      recipient: norm.e164,
      carrier: norm.carrier,
      templateId: templateId || 'TRANSACTIONAL_NOTIFICATION',
      provider: result.provider,
      providerMessageId: result.messageId,
      status: result.deliveryStatus || (result.success ? 'SENT' : 'FAILED'),
      errorMessage: result.error,
      createdAt: new Date().toISOString(),
    });

    return result;
  }
}
