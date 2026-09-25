import AsyncStorage from '@react-native-async-storage/async-storage';
import { RestaurantApplication } from '../types/domain';

const CREDENTIALS_STORAGE_KEY = 'mlohub.restaurant_credentials.v1';
const BRIDGE_STORAGE_KEY = 'mlohub.confirmed_auth_bridge.v1';
const ACTIVE_RESTAURANT_LOGIN_KEY = 'mlohub.active_restaurant_login_email.v1';

const CRED_TAG_REGEX = /\[MLOHUB_CRED:([a-f0-9]+)\]/i;

export interface RestaurantCredentialRecord {
  email: string;
  passwordHash?: string;
  applicationId: string;
  applicantUserId?: string;
  businessName: string;
  ownerName: string;
  ownerPhone: string;
  cuisineType: string;
  neighborhood: string;
  address: string;
  hasTinOrLicense: boolean;
  tinNumber?: string;
  notes?: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  restaurantId?: string;
  syncedToServer: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConfirmedAuthBridge {
  email?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  updatedAt: string;
}

const memoryFallbackStore = new Map<string, string>();

async function safeGetItem(key: string): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const webVal = window.localStorage.getItem(key);
      if (webVal !== null) return webVal;
    }
  } catch {}
  try {
    const val = await AsyncStorage.getItem(key);
    if (val !== null) return val;
  } catch {}
  return memoryFallbackStore.get(key) ?? null;
}

async function safeSetItem(key: string, value: string): Promise<void> {
  memoryFallbackStore.set(key, value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {}
  try {
    await AsyncStorage.setItem(key, value);
  } catch {}
}

async function safeRemoveItem(key: string): Promise<void> {
  memoryFallbackStore.delete(key);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {}
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

/**
 * Pure TypeScript SHA-256 implementation (works identically in Web, React Native, and Node tests).
 */
function sha256Hex(ascii: string): string {
  const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const utf8 = unescape(encodeURIComponent(ascii));
  const asciiBitLength = utf8.length * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: { [key: number]: number } = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  let str = utf8 + '\x80';
  while ((str.length % 64) - 56) str += '\x00';
  for (let i = 0; i < str.length; i++) {
    const j = str.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);

      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

export class RestaurantCredentialsService {
  public static computeHash(email: string, password: string): string {
    const cleanEmail = (email || '').trim().toLowerCase();
    return sha256Hex(`mlohub_rest_v1:${cleanEmail}:${password}`);
  }

  public static embedHashInNotes(notes: string | undefined | null, credHash?: string): string | null {
    const clean = this.extractHashAndCleanNotes(notes).cleanNotes || '';
    if (!credHash) {
      return clean || null;
    }
    const tag = `[MLOHUB_CRED:${credHash}]`;
    return clean ? `${clean}\n${tag}` : tag;
  }

  public static extractHashAndCleanNotes(rawNotes: string | undefined | null): {
    cleanNotes?: string;
    credHash?: string;
  } {
    if (!rawNotes) return { cleanNotes: undefined, credHash: undefined };
    const match = rawNotes.match(CRED_TAG_REGEX);
    const credHash = match ? match[1].toLowerCase() : undefined;
    const stripped = rawNotes.replace(CRED_TAG_REGEX, '').trim();
    return {
      cleanNotes: stripped.length > 0 ? stripped : undefined,
      credHash,
    };
  }

  public static async getAllRecords(): Promise<RestaurantCredentialRecord[]> {
    const raw = await safeGetItem(CREDENTIALS_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private static async saveAllRecords(records: RestaurantCredentialRecord[]): Promise<void> {
    await safeSetItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(records));
  }

  public static async getRecordByEmail(emailOrPhone: string): Promise<RestaurantCredentialRecord | null> {
    const clean = (emailOrPhone || '').trim().toLowerCase();
    if (!clean) return null;
    const records = await this.getAllRecords();
    const digitsOnly = clean.replace(/[^0-9]/g, '');
    const matching = records.filter((r) => {
      if (r.email.toLowerCase() === clean) return true;
      if (digitsOnly.length >= 9 && r.ownerPhone.replace(/[^0-9]/g, '').endsWith(digitsOnly.slice(-9))) {
        return true;
      }
      return false;
    });
    if (matching.length === 0) return null;
    // Prefer APPROVED, then most recently updated
    matching.sort((a, b) => {
      if (a.status === 'APPROVED' && b.status !== 'APPROVED') return -1;
      if (b.status === 'APPROVED' && a.status !== 'APPROVED') return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return matching[0];
  }

  public static async saveCredentialRecord(
    partial: Partial<RestaurantCredentialRecord> & { email: string }
  ): Promise<RestaurantCredentialRecord> {
    const cleanEmail = partial.email.trim().toLowerCase();
    const records = await this.getAllRecords();
    const existingIdx = records.findIndex(
      (r) =>
        (partial.applicationId && r.applicationId === partial.applicationId) ||
        r.email.toLowerCase() === cleanEmail
    );

    const now = new Date().toISOString();
    if (existingIdx >= 0) {
      const prev = records[existingIdx];
      const updated: RestaurantCredentialRecord = {
        ...prev,
        ...partial,
        email: cleanEmail,
        passwordHash: partial.passwordHash || prev.passwordHash,
        restaurantId: partial.restaurantId || prev.restaurantId,
        rejectionReason:
          partial.status === 'REJECTED'
            ? partial.rejectionReason ?? prev.rejectionReason
            : partial.status === 'APPROVED'
            ? undefined
            : prev.rejectionReason,
        updatedAt: now,
      };
      records[existingIdx] = updated;
      await this.saveAllRecords(records);
      return updated;
    }

    const created: RestaurantCredentialRecord = {
      email: cleanEmail,
      passwordHash: partial.passwordHash,
      applicationId: partial.applicationId || `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      applicantUserId: partial.applicantUserId,
      businessName: partial.businessName || 'MloHub Partner Spot',
      ownerName: partial.ownerName || 'Restaurant Owner',
      ownerPhone: partial.ownerPhone || '',
      cuisineType: partial.cuisineType || 'Swahili',
      neighborhood: partial.neighborhood || 'Dar es Salaam',
      address: partial.address || 'Dar es Salaam',
      hasTinOrLicense: partial.hasTinOrLicense ?? false,
      tinNumber: partial.tinNumber,
      notes: partial.notes,
      status: partial.status || 'PENDING',
      rejectionReason: partial.rejectionReason,
      restaurantId: partial.restaurantId,
      syncedToServer: partial.syncedToServer ?? false,
      createdAt: partial.createdAt || now,
      updatedAt: now,
    };
    records.unshift(created);
    await this.saveAllRecords(records);
    return created;
  }

  public static async syncFromApplicationRow(
    app: RestaurantApplication,
    extractedHash?: string
  ): Promise<void> {
    if (!app.ownerEmail) return;
    await this.saveCredentialRecord({
      email: app.ownerEmail,
      passwordHash: extractedHash,
      applicationId: app.id,
      applicantUserId: app.applicantUserId,
      businessName: app.businessName,
      ownerName: app.ownerName,
      ownerPhone: app.ownerPhone,
      cuisineType: app.cuisineType,
      neighborhood: app.neighborhood,
      address: app.address,
      hasTinOrLicense: app.hasTinOrLicense,
      tinNumber: app.tinNumber,
      notes: app.notes,
      status: app.status,
      rejectionReason: app.rejectionReason,
      restaurantId: app.restaurantId,
      syncedToServer: true,
      createdAt: app.createdAt,
    });
  }

  public static async getUnsyncedApplications(): Promise<RestaurantCredentialRecord[]> {
    const records = await this.getAllRecords();
    return records.filter((r) => !r.syncedToServer);
  }

  public static async markApplicationSynced(
    applicationId: string,
    applicantUserId: string
  ): Promise<void> {
    const records = await this.getAllRecords();
    const idx = records.findIndex((r) => r.applicationId === applicationId);
    if (idx >= 0) {
      records[idx].syncedToServer = true;
      records[idx].applicantUserId = applicantUserId;
      records[idx].updatedAt = new Date().toISOString();
      await this.saveAllRecords(records);
    }
  }

  public static async saveConfirmedBridge(bridge: Partial<ConfirmedAuthBridge>): Promise<void> {
    const current = (await this.getConfirmedBridge()) || { updatedAt: new Date().toISOString() };
    const next: ConfirmedAuthBridge = {
      ...current,
      ...bridge,
      email: bridge.email ? bridge.email.trim().toLowerCase() : current.email,
      password: bridge.password || current.password,
      accessToken: bridge.accessToken || current.accessToken,
      refreshToken: bridge.refreshToken || current.refreshToken,
      userId: bridge.userId || current.userId,
      updatedAt: new Date().toISOString(),
    };
    await safeSetItem(BRIDGE_STORAGE_KEY, JSON.stringify(next));
  }

  public static async getConfirmedBridge(): Promise<ConfirmedAuthBridge | null> {
    const raw = await safeGetItem(BRIDGE_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public static async setActiveRestaurantLoginEmail(email: string | null): Promise<void> {
    if (!email) {
      await safeRemoveItem(ACTIVE_RESTAURANT_LOGIN_KEY);
      return;
    }
    await safeSetItem(ACTIVE_RESTAURANT_LOGIN_KEY, email.trim().toLowerCase());
  }

  public static async getActiveRestaurantLoginEmail(): Promise<string | null> {
    const val = await safeGetItem(ACTIVE_RESTAURANT_LOGIN_KEY);
    return val ? val.trim().toLowerCase() : null;
  }

  public static async ensureSupabaseBridgeSession(supabaseClient: any): Promise<any | null> {
    try {
      const { data: { session: activeSession } } = await supabaseClient.auth.getSession();
      if (activeSession?.user) {
        return activeSession;
      }
    } catch {}

    const bridge = await this.getConfirmedBridge();
    if (!bridge) return null;

    // 1. Try signing in with stored confirmed email + password
    if (bridge.email && bridge.password) {
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: bridge.email,
          password: bridge.password,
        });
        if (!error && data?.session) {
          await this.saveConfirmedBridge({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            userId: data.session.user.id,
          });
          return data.session;
        }
      } catch {}
    }

    // 2. Fallback to restoring saved accessToken + refreshToken
    if (bridge.accessToken && bridge.refreshToken) {
      try {
        const { data, error } = await supabaseClient.auth.setSession({
          access_token: bridge.accessToken,
          refresh_token: bridge.refreshToken,
        });
        if (!error && data?.session) {
          await this.saveConfirmedBridge({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            userId: data.session.user.id,
          });
          return data.session;
        }
      } catch {}
    }

    return null;
  }
}
