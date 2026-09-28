import { authStorage } from '../lib/authStorage';

const SOUND_SETTING_KEY = 'mlohub_restaurant_new_order_sound_enabled';
let lastPlayedAt = 0;
const DEBOUNCE_MS = 2500;

export class OrderNotificationSoundService {
  /**
   * Checks whether new paid order chime is enabled for this device/portal.
   * Defaults to true.
   */
  public static async isSoundEnabled(): Promise<boolean> {
    try {
      const stored = await authStorage.getItem(SOUND_SETTING_KEY);
      if (stored === null) return true;
      return stored === 'true';
    } catch {
      return true;
    }
  }

  /**
   * Sets whether new paid order chime is enabled.
   */
  public static async setSoundEnabled(enabled: boolean): Promise<void> {
    try {
      await authStorage.setItem(SOUND_SETTING_KEY, enabled ? 'true' : 'false');
    } catch (e) {
      console.warn('[OrderNotificationSoundService] Failed to persist sound setting:', e);
    }
  }

  /**
   * Plays a crisp, short non-looping chime tone and triggers haptic vibration
   * when a RESTAURANT_NEW_PAID_ORDER notification arrives.
   */
  public static async playNewPaidOrderAlert(): Promise<void> {
    const now = Date.now();
    if (now - lastPlayedAt < DEBOUNCE_MS) {
      return;
    }
    lastPlayedAt = now;

    const enabled = await this.isSoundEnabled();
    if (!enabled) return;

    // 1. Haptic Feedback (Native & Web supported browsers)
    try {
      if (typeof window === 'undefined' || !(window as any).document) {
        // Only run native haptics if not running in a node test environment
        if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'test') {
          const mod = 'expo-haptics';
          const req = typeof require !== 'undefined' ? require : null;
          const Haptics = req ? req(mod) : null;
          if (Haptics?.notificationAsync) {
            await Haptics.notificationAsync(Haptics?.NotificationFeedbackType?.Success || 'success');
          }
        }
      }
    } catch (hapticErr) {
      // Haptics may be unsupported on some devices; ignore gracefully
    }

    // 2. Audio Chime (Synthetic Web Audio API or fallback)
    if (typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') {
            await ctx.resume().catch(() => undefined);
          }

          // Two-tone chime: Note 1 (880 Hz / A5) -> Note 2 (1174.66 Hz / D6)
          const nowTime = ctx.currentTime;

          // First chime note
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(880, nowTime);
          gain1.gain.setValueAtTime(0.25, nowTime);
          gain1.gain.exponentialRampToValueAtTime(0.001, nowTime + 0.2);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(nowTime);
          osc1.stop(nowTime + 0.2);

          // Second higher pleasant chime note
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1174.66, nowTime + 0.15);
          gain2.gain.setValueAtTime(0.25, nowTime + 0.15);
          gain2.gain.exponentialRampToValueAtTime(0.001, nowTime + 0.45);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(nowTime + 0.15);
          osc2.stop(nowTime + 0.45);
        }
      } catch (audioErr) {
        // AudioContext may be restricted by browser autoplay policy before user gesture
      }
    }
  }
}
