/**
 * ============================================================================
 * MLOHUB FORMATTERS & DISCOVERY UTILITIES
 * ============================================================================
 */

import { FreshnessTier } from '../types/discovery';

/**
 * Formats a Tanzanian Shillings numerical value into standard currency display.
 * Examples:
 *   formatTzs(11000) -> "TZS 11,000"
 *   formatTzs(9500)  -> "TZS 9,500"
 */
export function formatTzs(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'TZS 0';
  }
  const integerVal = Math.round(amount);
  const formattedNumber = integerVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `TZS ${formattedNumber}`;
}

/**
 * Formats distance in kilometers to user-friendly units.
 * Examples:
 *   formatDistance(0.35) -> "350 m"
 *   formatDistance(0.8)  -> "800 m"
 *   formatDistance(1.3)  -> "1.3 km"
 *   formatDistance(5.2)  -> "5.2 km"
 */
export function formatDistance(distanceKm: number | undefined | null): string {
  if (distanceKm === undefined || distanceKm === null || isNaN(distanceKm) || distanceKm < 0) {
    return 'Nearby';
  }

  if (distanceKm < 1.0) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }

  return `${distanceKm.toFixed(1)} km`;
}

export interface FreshnessCalculation {
  score: number;
  tier: FreshnessTier;
  label: string;
  hoursAgo: number;
}

/**
 * Calculates menu & price verification freshness tier, score (0–100), and human label.
 */
export function calculateFreshnessScore(dateString: string | undefined | null): FreshnessCalculation {
  if (!dateString) {
    return {
      score: 20,
      tier: 'UNKNOWN',
      label: 'Not recently verified',
      hoursAgo: 9999,
    };
  }

  const timestamp = new Date(dateString).getTime();
  if (isNaN(timestamp) || timestamp <= 0) {
    return {
      score: 20,
      tier: 'UNKNOWN',
      label: 'Not recently verified',
      hoursAgo: 9999,
    };
  }

  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const hoursAgo = Math.floor(diffMs / (1000 * 60 * 60));

  if (hoursAgo <= 1) {
    return {
      score: 100,
      tier: 'FRESH',
      label: 'Verified just now',
      hoursAgo,
    };
  }

  if (hoursAgo <= 24) {
    return {
      score: 95,
      tier: 'FRESH',
      label: hoursAgo === 1 ? 'Verified 1h ago' : `Verified ${hoursAgo}h ago`,
      hoursAgo,
    };
  }

  if (hoursAgo <= 48) {
    return {
      score: 80,
      tier: 'RECENT',
      label: 'Verified yesterday',
      hoursAgo,
    };
  }

  if (hoursAgo <= 72) {
    return {
      score: 75,
      tier: 'RECENT',
      label: 'Updated 2 days ago',
      hoursAgo,
    };
  }

  if (hoursAgo <= 168) {
    const days = Math.floor(hoursAgo / 24);
    return {
      score: 55,
      tier: 'AGING',
      label: `Updated ${days} days ago`,
      hoursAgo,
    };
  }

  return {
    score: 25,
    tier: 'STALE',
    label: 'Price may be outdated',
    hoursAgo,
  };
}

/**
 * Returns badge styling colors and icon for a freshness tier.
 */
export function formatFreshnessBadge(tier: FreshnessTier): {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  icon: string;
} {
  switch (tier) {
    case 'FRESH':
      return {
        backgroundColor: '#ecfdf5',
        textColor: '#047857',
        borderColor: '#a7f3d0',
        icon: '✓',
      };
    case 'RECENT':
      return {
        backgroundColor: '#eff6ff',
        textColor: '#1d4ed8',
        borderColor: '#bfdbfe',
        icon: '⏱',
      };
    case 'AGING':
      return {
        backgroundColor: '#fffbeb',
        textColor: '#b45309',
        borderColor: '#fde68a',
        icon: 'ℹ',
      };
    case 'STALE':
      return {
        backgroundColor: '#fef2f2',
        textColor: '#b91c1c',
        borderColor: '#fecaca',
        icon: '⚠',
      };
    case 'UNKNOWN':
    default:
      return {
        backgroundColor: '#f3f4f6',
        textColor: '#4b5563',
        borderColor: '#e5e7eb',
        icon: '•',
      };
  }
}

/**
 * Evaluates whether an operating branch is currently open based on opening_hours.
 * Supports structured JSON ({ monday: { open: "08:00", close: "22:00" } })
 * or simple strings like "08:00 AM - 10:00 PM".
 */
export function isOpenNow(openingHours: any): boolean | 'UNKNOWN' {
  if (!openingHours) return 'UNKNOWN';

  // If boolean directly passed
  if (typeof openingHours === 'boolean') return openingHours;

  // Simple string format
  if (typeof openingHours === 'string') {
    const lower = openingHours.toLowerCase();
    if (lower.includes('24 hour') || lower.includes('24/7') || lower.includes('masaa 24')) return true;
    if (lower.includes('closed') || lower.includes('imefungwa')) return false;

    // Parse simple "08:00 - 22:00"
    const match = openingHours.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (!match) return 'UNKNOWN';

    try {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      let startH = parseInt(match[1], 10);
      const startM = match[2] ? parseInt(match[2], 10) : 0;
      const startAmPm = (match[3] || '').toLowerCase();
      if (startAmPm === 'pm' && startH < 12) startH += 12;
      if (startAmPm === 'am' && startH === 12) startH = 0;
      const startTotal = startH * 60 + startM;

      let endH = parseInt(match[4], 10);
      const endM = match[5] ? parseInt(match[5], 10) : 0;
      const endAmPm = (match[6] || '').toLowerCase();
      if (endAmPm === 'pm' && endH < 12) endH += 12;
      if (endAmPm === 'am' && endH === 12) endH = 0;
      const endTotal = endH * 60 + endM;

      if (endTotal > startTotal) {
        return currentMinutes >= startTotal && currentMinutes <= endTotal;
      }
      // Overnight span (e.g. 18:00 to 02:00)
      return currentMinutes >= startTotal || currentMinutes <= endTotal;
    } catch {
      return 'UNKNOWN';
    }
  }

  // Structured object format e.g. { mon_fri: "07:00-21:00" } or { monday: { open: "08:00", close: "22:00" } }
  if (typeof openingHours === 'object') {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[new Date().getDay()];

    const todaySpec = openingHours[currentDay] || openingHours.mon_fri || openingHours.daily || openingHours.all;
    if (!todaySpec) return 'UNKNOWN';

    if (typeof todaySpec === 'string') {
      return isOpenNow(todaySpec);
    }

    if (todaySpec.open && todaySpec.close) {
      return isOpenNow(`${todaySpec.open} - ${todaySpec.close}`);
    }
  }

  return 'UNKNOWN';
}
