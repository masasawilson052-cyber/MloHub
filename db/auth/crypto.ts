/**
 * MloHub Security & Cryptography Engine
 * Provides secure salted password hashing, JWT-style token signing, and constant-time verification.
 */

// Simple SHA-256 implementation in pure TypeScript for cross-platform compatibility
function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];

  let primeCounter = 0;
  const isComposite: { [key: number]: boolean } = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 300; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return ''; // ASCII check
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const s0 = i < 16 ? w[i] : (w[i] =
        (w[i - 16] +
          (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
          w[i - 7] +
          (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
        0);

      const s1 =
        (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) +
        ((hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]));

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 =
        (hash[7] +
          (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
          ch +
          k[i] +
          s0) |
        0;
      const temp2 = s1 | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (b * 8)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

const JWT_SECRET_SALT = 'mlohub-sec-2026-auth-salt-key';

function toUtf8String(str: string): string {
  try {
    return unescape(encodeURIComponent(str));
  } catch {
    return str;
  }
}

export const CryptoEngine = {
  /**
   * Generates a random alphanumeric salt
   */
  generateSalt: (length: number = 16): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let salt = '';
    for (let i = 0; i < length; i++) {
      salt += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return salt;
  },

  /**
   * Hashes a password with salt using SHA-256 and UTF-8 encoding.
   * Produces modern mlohub_v2$ hashes.
   */
  hashPassword: (password: string, salt?: string): string => {
    const s = salt || CryptoEngine.generateSalt(16);
    const hash = sha256(toUtf8String(`${s}:${password}:${JWT_SECRET_SALT}`));
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
      throw new Error('Failed to generate valid password hash digest.');
    }
    return `mlohub_v2$${s}$${hash}`;
  },

  /**
   * Generates legacy mlohub_v1 hash for backwards-compatibility tests.
   */
  createLegacyV1Hash: (password: string, salt?: string, utf8: boolean = false): string => {
    const s = salt || CryptoEngine.generateSalt(16);
    const text = `${s}:${password}:${JWT_SECRET_SALT}`;
    const digest = utf8 ? sha256(toUtf8String(text)) : sha256(text);
    return `mlohub_v1$${s}$${digest}`;
  },

  /**
   * Identifies whether a stored hash is an older format (mlohub_v1) eligible for upgrade.
   */
  shouldUpgradeHash: (storedHash: string): boolean => {
    return typeof storedHash === 'string' && storedHash.startsWith('mlohub_v1$');
  },

  /**
   * Verifies password against stored hash with constant-time check.
   * Supports both mlohub_v2 (strict UTF-8) and mlohub_v1 (legacy compatibility for raw Latin-1 and UTF-8).
   * Rejects malformed, truncated, or unrecoverable hashes safely.
   */
  verifyPassword: (password: string, storedHash: string): boolean => {
    try {
      if (!storedHash || typeof storedHash !== 'string') {
        return false;
      }
      const parts = storedHash.split('$');
      if (parts.length !== 3) return false;
      const [version, salt, expectedHash] = parts;

      if (!salt || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
        return false;
      }

      const constantTimeCheck = (computed: string): boolean => {
        if (!computed || !/^[a-f0-9]{64}$/i.test(computed) || computed.length !== expectedHash.length) {
          return false;
        }
        let diff = 0;
        for (let i = 0; i < computed.length; i++) {
          diff |= computed.charCodeAt(i) ^ expectedHash.charCodeAt(i);
        }
        return diff === 0;
      };

      if (version === 'mlohub_v2') {
        // Modern strict UTF-8
        const computed = sha256(toUtf8String(`${salt}:${password}:${JWT_SECRET_SALT}`));
        return constantTimeCheck(computed);
      }

      if (version === 'mlohub_v1') {
        // Legacy compatibility:
        // 1. Check historical raw string (Latin-1/direct character codes for existing accented passwords)
        const rawComputed = sha256(`${salt}:${password}:${JWT_SECRET_SALT}`);
        if (constantTimeCheck(rawComputed)) {
          return true;
        }
        // 2. Check UTF-8 byte encoding
        const utf8Computed = sha256(toUtf8String(`${salt}:${password}:${JWT_SECRET_SALT}`));
        return constantTimeCheck(utf8Computed);
      }

      // Any other prefix or version is rejected
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Hashes an OTP code with a phone-specific salt using SHA-256
   */
  hashOtp: (otp: string, phone: string, salt?: string): string => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const s = salt || CryptoEngine.generateSalt(16);
    const hash = sha256(`${cleanPhone}:${otp}:${s}:${JWT_SECRET_SALT}`);
    return `otp_v1$${s}$${hash}`;
  },

  /**
   * Verifies an OTP code against a stored hash with constant-time check
   */
  verifyOtpHash: (otp: string, phone: string, storedHash: string): boolean => {
    try {
      if (!storedHash || !storedHash.startsWith('otp_v1$')) return false;
      const parts = storedHash.split('$');
      if (parts.length !== 3) return false;
      const salt = parts[1];
      const expectedHash = parts[2];
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const computedHash = sha256(`${cleanPhone}:${otp}:${salt}:${JWT_SECRET_SALT}`);

      if (computedHash.length !== expectedHash.length) return false;
      let diff = 0;
      for (let i = 0; i < computedHash.length; i++) {
        diff |= computedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
      }
      return diff === 0;
    } catch {
      return false;
    }
  },

  /**
   * Generates a signed session token.
   * Embeds an unpredictable, unique session identifier (sessionId / jti) so identical claims
   * issued within the same millisecond or with a frozen clock produce distinct tokens.
   */
  signToken: (
    payload: { userId: string; role: string; email: string; restaurantId?: string; sessionId?: string; jti?: string },
    expiresInMs?: number
  ): string => {
    const header = { alg: 'HS256', typ: 'JWT' };
    const exp = Date.now() + (expiresInMs !== undefined ? expiresInMs : 30 * 24 * 60 * 60 * 1000);
    const sessionId = payload.sessionId || payload.jti || `sess_${CryptoEngine.generateSalt(24)}`;
    const fullPayload = { ...payload, sessionId, jti: sessionId, exp, iat: Date.now() };

    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(fullPayload));
    const signature = sha256(`${encodedHeader}.${encodedPayload}.${JWT_SECRET_SALT}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  },

  /**
   * Verifies and decodes a token
   */
  verifyToken: (
    token: string
  ): {
    userId: string;
    role: string;
    email: string;
    restaurantId?: string;
    exp: number;
    sessionId?: string;
    jti?: string;
  } | null => {
    try {
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [encodedHeader, encodedPayload, signature] = parts;
      const expectedSignature = sha256(`${encodedHeader}.${encodedPayload}.${JWT_SECRET_SALT}`);

      if (signature !== expectedSignature) {
        return null;
      }

      const payload = JSON.parse(atob(encodedPayload));
      if (payload.exp && payload.exp < Date.now()) {
        return null; // Expired
      }

      return payload;
    } catch {
      return null;
    }
  },

  /**
   * Evaluates password strength:
   * 0: Empty, 1: Weak, 2: Fair, 3: Good, 4: Strong
   */
  checkPasswordStrength: (password: string): { score: number; label: string; feedback: string[] } => {
    const feedback: string[] = [];
    if (!password) return { score: 0, label: 'Empty', feedback: ['Password required'] };

    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (password.length < 6) {
      feedback.push('At least 6 characters required');
    }
    if (!/[A-Z]/.test(password)) {
      feedback.push('Include at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      feedback.push('Include at least one number');
    }

    if (password.length < 6) {
      return {
        score: 1,
        label: 'Too Short',
        feedback,
      };
    }

    const labels = ['Empty', 'Weak', 'Fair', 'Good', 'Strong'];
    return {
      score: Math.min(4, Math.max(1, score)),
      label: labels[Math.min(4, Math.max(1, score))],
      feedback,
    };
  },
};
