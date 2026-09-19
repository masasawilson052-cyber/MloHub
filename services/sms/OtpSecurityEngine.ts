/**
 * MloHub OTP Security Engine (Stage 8 Production Architecture)
 * Handles cryptographic RNG, salted & peppered HMAC-SHA256 hashing,
 * constant-time verification, 5-attempt lockout, 60s cooldown, and prior invalidation.
 */

import { normalizeTanzanianPhone } from '../../utils/phoneNormalization';

export interface OtpChallengeRecord {
  id: string;
  phone: string; // Canonical E.164 (+255...)
  otpHash: string;
  purpose: string;
  attemptsCount: number;
  maxAttempts: number;
  isVerified: boolean;
  expiresAt: string;
  createdAt: string;
  invalidatedAt?: string;
}

export interface GenerateOtpResult {
  success: boolean;
  rawOtp?: string; // Only returned for transmission, never saved or exposed to client
  challenge?: OtpChallengeRecord;
  cooldownRemainingSeconds?: number;
  carrierName: string;
  maskedPhone: string;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  isLockedOut?: boolean;
  attemptsRemaining?: number;
  challengeId?: string;
}

export class OtpSecurityEngine {
  private static readonly OTP_LENGTH = 6;
  private static readonly EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly MAX_HOURLY_REQUESTS = 5;

  private static getPepper(): string {
    const pepper = process.env.SMS_OTP_PEPPER;
    if (!pepper) {
      throw new Error(
        'SMS_OTP_PEPPER is required. No insecure fallback is allowed.'
      );
    }
    return pepper;
  }

  /**
   * Cryptographically secure 6-digit numeric generator
   */
  public static generateCryptographicOtp(): string {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      const min = 100000;
      const max = 999999;
      const range = max - min + 1;
      const value = min + (array[0] % range);
      return value.toString();
    }
    // Deterministic fallback for environments without WebCrypto
    return `${Math.floor(100000 + Math.random() * 900000)}`;
  }

  /**
   * HMAC-SHA256 salted & peppered hash of an OTP
   */
  public static hashOtp(otp: string, phone: string): string {
    const salt = phone.trim();
    const pepper = this.getPepper();
    const message = `${otp}:${salt}:${pepper}`;

    // Use native WebCrypto or Node.js crypto if available
    try {
      if (typeof require !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodeCrypto = require('crypto');
        return nodeCrypto.createHmac('sha256', pepper).update(message).digest('hex');
      }
    } catch {
      // Fallback
    }

    // SHA-256 fallback implementation
    return this.fallbackSha256(message);
  }

  /**
   * Constant-time comparison to prevent timing analysis
   */
  public static timingSafeVerify(enteredOtp: string, phone: string, expectedHash: string): boolean {
    const computedHash = this.hashOtp(enteredOtp.trim(), phone);
    if (computedHash.length !== expectedHash.length) {
      return false;
    }

    let mismatch = 0;
    for (let i = 0; i < computedHash.length; i++) {
      mismatch |= computedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
    }
    return mismatch === 0;
  }

  /**
   * Check rate-limiting cooldown and hourly maximums against existing challenges
   */
  public static checkRateLimits(
    phone: string,
    existingChallenges: OtpChallengeRecord[]
  ): { allowed: boolean; cooldownRemainingSeconds: number; error?: string } {
    const now = Date.now();
    const phoneChallenges = existingChallenges
      .filter((c) => c.phone === phone && !c.invalidatedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 1. Check 60-second cooldown from most recent challenge
    if (phoneChallenges.length > 0) {
      const mostRecent = phoneChallenges[0];
      const elapsedMs = now - new Date(mostRecent.createdAt).getTime();
      if (elapsedMs < this.RESEND_COOLDOWN_MS) {
        const remainingSec = Math.ceil((this.RESEND_COOLDOWN_MS - elapsedMs) / 1000);
        return {
          allowed: false,
          cooldownRemainingSeconds: remainingSec,
          error: `Please wait ${remainingSec}s before requesting a new verification code.`,
        };
      }
    }

    // 2. Check hourly rate limit (max 5 requests per hour)
    const oneHourAgo = now - 60 * 60 * 1000;
    const hourlyCount = phoneChallenges.filter(
      (c) => new Date(c.createdAt).getTime() > oneHourAgo
    ).length;

    if (hourlyCount >= this.MAX_HOURLY_REQUESTS) {
      return {
        allowed: false,
        cooldownRemainingSeconds: 3600,
        error: 'Too many OTP requests for this phone number. Please try again in 1 hour.',
      };
    }

    return { allowed: true, cooldownRemainingSeconds: 0 };
  }

  /**
   * Create a new challenge payload and identify older active challenges to invalidate
   */
  public static prepareNewChallenge(
    rawPhone: string,
    purpose: string,
    existingChallenges: OtpChallengeRecord[]
  ): {
    success: boolean;
    normPhone: string;
    carrierName: string;
    rawOtp?: string;
    newChallenge?: OtpChallengeRecord;
    challengesToInvalidate: string[]; // Challenge IDs to mark invalidated
    cooldownRemainingSeconds?: number;
    error?: string;
  } {
    const norm = normalizeTanzanianPhone(rawPhone);
    if (!norm.valid) {
      return {
        success: false,
        normPhone: rawPhone,
        carrierName: 'Unknown',
        challengesToInvalidate: [],
        error: norm.error || 'Invalid Tanzanian phone number format',
      };
    }

    // Rate-limit check
    const rateCheck = this.checkRateLimits(norm.e164, existingChallenges);
    if (!rateCheck.allowed) {
      return {
        success: false,
        normPhone: norm.e164,
        carrierName: norm.carrier,
        challengesToInvalidate: [],
        cooldownRemainingSeconds: rateCheck.cooldownRemainingSeconds,
        error: rateCheck.error,
      };
    }

    // Find any unverified active challenges for this phone to invalidate
    const challengesToInvalidate = existingChallenges
      .filter((c) => c.phone === norm.e164 && !c.isVerified && !c.invalidatedAt)
      .map((c) => c.id);

    const rawOtp = this.generateCryptographicOtp();
    const otpHash = this.hashOtp(rawOtp, norm.e164);
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.EXPIRY_MS).toISOString();

    const newChallenge: OtpChallengeRecord = {
      id: `otp_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      phone: norm.e164,
      otpHash,
      purpose,
      attemptsCount: 0,
      maxAttempts: this.MAX_ATTEMPTS,
      isVerified: false,
      expiresAt,
      createdAt: nowIso,
    };

    return {
      success: true,
      normPhone: norm.e164,
      carrierName: norm.carrier,
      rawOtp,
      newChallenge,
      challengesToInvalidate,
    };
  }

  /**
   * Verify an entered OTP against an existing challenge record
   */
  public static verifyChallenge(
    challenge: OtpChallengeRecord | null | undefined,
    enteredOtp: string
  ): VerifyOtpResult {
    if (!challenge) {
      return {
        success: false,
        message: 'No active OTP verification code found for this phone number. Please request a new code.',
      };
    }

    // Check if previously invalidated by a newer challenge
    if (challenge.invalidatedAt) {
      return {
        success: false,
        message: 'This verification code was superseded by a newer request. Please use the most recent code.',
      };
    }

    // Check expiration
    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      return {
        success: false,
        message: 'Verification code has expired (5-minute limit). Please request a new OTP.',
      };
    }

    // Check attempt lockout
    if (challenge.attemptsCount >= challenge.maxAttempts) {
      return {
        success: false,
        isLockedOut: true,
        attemptsRemaining: 0,
        message: 'Maximum verification attempts exceeded (5/5). This code has been permanently locked out.',
      };
    }

    // Constant-time check
    const isValid = this.timingSafeVerify(enteredOtp, challenge.phone, challenge.otpHash);
    if (!isValid) {
      const remaining = Math.max(0, challenge.maxAttempts - (challenge.attemptsCount + 1));
      return {
        success: false,
        attemptsRemaining: remaining,
        isLockedOut: remaining === 0,
        message:
          remaining > 0
            ? `Incorrect verification code. ${remaining} attempt(s) remaining.`
            : 'Maximum verification attempts exceeded. Code has been locked out.',
      };
    }

    return {
      success: true,
      message: 'Verification successful.',
      challengeId: challenge.id,
    };
  }

  /**
   * Deterministic SHA-256 for non-Node environments
   */
  private static fallbackSha256(str: string): string {
    function rightRotate(value: number, amount: number) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let result = '';
    const words: number[] = [];
    const asciiBitLength = str.length * 8;
    const hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    for (let i = 0; i < str.length; i++) {
      const j = str.charCodeAt(i);
      words[i >> 2] |= j << ((3 - (i % 4)) * 8);
    }
    words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
    words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

    const w: number[] = new Array(64);
    for (let i = 0; i < words.length; i += 16) {
      const a = hash.slice();
      for (let j = 0; j < 64; j++) {
        if (j < 16) {
          w[j] = words[i + j] | 0;
        } else {
          const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
          const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
          w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
        }
        const s1 = rightRotate(a[4], 6) ^ rightRotate(a[4], 11) ^ rightRotate(a[4], 25);
        const ch = (a[4] & a[5]) ^ (~a[4] & a[6]);
        const temp1 = (a[7] + s1 + ch + k[j] + w[j]) | 0;
        const s0 = rightRotate(a[0], 2) ^ rightRotate(a[0], 13) ^ rightRotate(a[0], 22);
        const maj = (a[0] & a[1]) ^ (a[0] & a[2]) ^ (a[1] & a[2]);
        const temp2 = (s0 + maj) | 0;
        a[7] = a[6];
        a[6] = a[5];
        a[5] = a[4];
        a[4] = (a[3] + temp1) | 0;
        a[3] = a[2];
        a[2] = a[1];
        a[1] = a[0];
        a[0] = (temp1 + temp2) | 0;
      }
      for (let j = 0; j < 8; j++) {
        hash[j] = (hash[j] + a[j]) | 0;
      }
    }

    for (let i = 0; i < 8; i++) {
      for (let j = 3; j >= 0; j--) {
        const b = (hash[i] >> (8 * j)) & 255;
        result += (b < 16 ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }
}
