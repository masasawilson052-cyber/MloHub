import {
  NotificationChannel,
  CommunicationClass,
  NotificationPriority,
  NotificationPreference,
  MarketingConsent,
} from '../../types/domain';

export interface ReachabilityDecision {
  reachable: boolean;
  channel: NotificationChannel;
  reason: string;
  isSuppressed: boolean;
}

export class DeliveryPolicy {
  /**
   * Check if quiet hours are active given the user's settings and timezone.
   * Standard timezone is Africa/Dar_es_Salaam (UTC+3).
   * Spans across midnight supported (e.g. 22:00 to 07:00).
   */
  public static isQuietHoursActive(
    startStr: string = '22:00:00',
    endStr: string = '07:00:00',
    timezone: string = 'Africa/Dar_es_Salaam',
    currentDate: Date = new Date()
  ): boolean {
    try {
      const timeStr = currentDate.toLocaleTimeString('en-GB', {
        timeZone: timezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const parseMinutes = (t: string) => {
        const parts = t.split(':').map(Number);
        return parts[0] * 60 + (parts[1] || 0);
      };

      const currentMins = parseMinutes(timeStr);
      const startMins = parseMinutes(startStr);
      const endMins = parseMinutes(endStr);

      if (startMins < endMins) {
        return currentMins >= startMins && currentMins <= endMins;
      } else {
        // Spans midnight, e.g. 22:00 to 07:00
        return currentMins >= startMins || currentMins <= endMins;
      }
    } catch {
      return false;
    }
  }

  /**
   * Evaluates reachability for a given channel and communication class.
   * Strict Suppression Precedence Matrix:
   * 1. Hard block destination suppressions (HARD_BOUNCE, SPAM_COMPLAINT, CARRIER_BLOCK, INVALID_DESTINATION,
   *    DEVICE_NOT_REGISTERED, PROVIDER_SUPPRESSION, MANUAL_SUPPRESSION) CAN NEVER be bypassed, even by SECURITY.
   * 2. Commercial opt-outs (USER_MARKETING_OPT_OUT, UNSUBSCRIBED) CAN be bypassed by SECURITY or TRANSACTIONAL_CRITICAL.
   * 3. SECURITY and TRANSACTIONAL_CRITICAL bypass quiet hours and user category preferences.
   * 4. MARKETING requires explicit opt-in consent.
   */
  public static evaluate(params: {
    channel: NotificationChannel;
    communicationClass: CommunicationClass;
    priority?: NotificationPriority;
    preference?: NotificationPreference | null;
    marketingConsent?: MarketingConsent | null;
    isDestinationSuppressed?: boolean;
    suppressionReason?: string;
    currentDate?: Date;
  }): ReachabilityDecision {
    const {
      channel,
      communicationClass,
      preference,
      marketingConsent,
      isDestinationSuppressed = false,
      suppressionReason,
      currentDate = new Date(),
    } = params;

    // 1. Destination suppression evaluation (Strict Precedence Matrix)
    if (isDestinationSuppressed) {
      if (!suppressionReason) {
        return {
          reachable: false,
          channel,
          reason: 'DESTINATION_SUPPRESSED',
          isSuppressed: true,
        };
      }

      const reasonUpper = suppressionReason.toUpperCase();

      // Permanent non-bypassable block categories
      const nonBypassableReasons = [
        'HARD_BOUNCE',
        'SPAM_COMPLAINT',
        'SPAM_REPORT',
        'INVALID_DESTINATION',
        'INVALID_NUMBER',
        'CARRIER_BLOCK',
        'CARRIER_BLOCKED',
        'DEVICE_NOT_REGISTERED',
        'PROVIDER_SUPPRESSION',
        'MANUAL_SUPPRESSION',
      ];

      if (nonBypassableReasons.includes(reasonUpper)) {
        return {
          reachable: false,
          channel,
          reason: `SUPPRESSED: ${reasonUpper}`,
          isSuppressed: true,
        };
      }

      // Bypassable ONLY for marketing unsubscription / opt-out
      if (reasonUpper === 'USER_MARKETING_OPT_OUT' || reasonUpper === 'UNSUBSCRIBED') {
        if (communicationClass !== 'SECURITY' && communicationClass !== 'TRANSACTIONAL_CRITICAL') {
          return {
            reachable: false,
            channel,
            reason: `SUPPRESSED: ${reasonUpper}`,
            isSuppressed: true,
          };
        }
      }
    }

    // 2. Security & Critical bypass marketing opt-out, preferences & quiet hours
    if (communicationClass === 'SECURITY' || communicationClass === 'TRANSACTIONAL_CRITICAL') {
      return {
        reachable: true,
        channel,
        reason: 'CRITICAL_BYPASS',
        isSuppressed: false,
      };
    }

    // 3. Marketing consent isolation
    if (communicationClass === 'MARKETING') {
      if (!marketingConsent || !marketingConsent.consented) {
        return {
          reachable: false,
          channel,
          reason: 'NO_MARKETING_CONSENT',
          isSuppressed: true,
        };
      }
    }

    // 4. In-App is always reachable unless explicitly disabled
    if (channel === 'IN_APP') {
      if (preference && preference.enabled === false) {
        return {
          reachable: false,
          channel,
          reason: 'CHANNEL_DISABLED',
          isSuppressed: true,
        };
      }
      return {
        reachable: true,
        channel,
        reason: 'IN_APP_ALLOWED',
        isSuppressed: false,
      };
    }

    // 5. User channel preferences
    if (preference && preference.enabled === false) {
      return {
        reachable: false,
        channel,
        reason: 'USER_PREFERENCE_DISABLED',
        isSuppressed: true,
      };
    }

    // 6. Quiet hours check (for Push, SMS, Email on non-critical notifications)
    if (preference?.quietHoursEnabled) {
      const inQuiet = this.isQuietHoursActive(
        preference.quietHoursStart || '22:00:00',
        preference.quietHoursEnd || '07:00:00',
        preference.quietHoursTimezone || 'Africa/Dar_es_Salaam',
        currentDate
      );
      if (inQuiet) {
        return {
          reachable: false,
          channel,
          reason: 'QUIET_HOURS_ACTIVE',
          isSuppressed: true,
        };
      }
    }

    return {
      reachable: true,
      channel,
      reason: 'ALLOWED',
      isSuppressed: false,
    };
  }
}
