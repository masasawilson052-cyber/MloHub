/**
 * ============================================================================
 * MLOHUB AUTHORITATIVE OPENING HOURS EVALUATOR
 * ============================================================================
 * Pure function evaluating operating status in Africa/Dar_es_Salaam (UTC+3)
 * regardless of the client host device timezone.
 * Handles:
 * - Restaurant pause override (isOpen = false)
 * - Service-specific operating hours (DELIVERY, PICKUP, DINE_IN)
 * - Closed days (is_closed = true)
 * - Standard and overnight shifts (closes_at < opens_at)
 */

export interface OperatingHoursRow {
  dayOfWeek: number; // 0=Sunday, 1=Monday ... 6=Saturday
  serviceType?: string;
  opensAt: string; // "HH:MM:SS" or "HH:MM"
  closesAt: string;
  isClosed?: boolean;
}

export interface OpeningStatusResult {
  isOpen: boolean;
  isPaused: boolean;
  status: 'OPEN' | 'OPENS_LATER' | 'CLOSED_TODAY' | 'CLOSED' | 'PAUSED';
  labelEn: string;
  labelSw: string;
  opensAtTime?: string;
  closesAtTime?: string;
}

/**
 * Returns exact wall clock parts in Africa/Dar_es_Salaam (UTC+3)
 */
export function getDarEsSalaamTime(date: Date = new Date()): {
  dayOfWeek: number;
  hours: number;
  minutes: number;
  currentMinutes: number;
  timeStr: string;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Dar_es_Salaam',
    hour12: false,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value || 'Sun';
  const hourStr = parts.find((p) => p.type === 'hour')?.value || '0';
  const minuteStr = parts.find((p) => p.type === 'minute')?.value || '0';

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const dayOfWeek = dayMap[weekdayStr] ?? 0;
  const hours = parseInt(hourStr, 10) % 24;
  const minutes = parseInt(minuteStr, 10);
  const currentMinutes = hours * 60 + minutes;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return { dayOfWeek, hours, minutes, currentMinutes, timeStr };
}

export function parseMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map((s) => parseInt(s, 10));
  return (h || 0) * 60 + (m || 0);
}

export function formatTime24(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  return `${parts[0].padStart(2, '0')}:${(parts[1] || '00').padStart(2, '0')}`;
}

export function evaluateOpeningStatus(
  isRestaurantOpenFlag: boolean = true,
  operatingHours: OperatingHoursRow[] = [],
  serviceType: string = 'PICKUP',
  evaluationDate: Date = new Date()
): OpeningStatusResult {
  // 1. Restaurant-level pause override: If paused/not taking orders
  if (!isRestaurantOpenFlag) {
    return {
      isOpen: false,
      isPaused: true,
      status: 'PAUSED',
      labelEn: 'Not taking orders right now',
      labelSw: 'Haipokei oda kwa sasa',
    };
  }

  // 2. If no operating hours configured, fallback to open flag
  if (!operatingHours || operatingHours.length === 0) {
    return {
      isOpen: isRestaurantOpenFlag,
      isPaused: false,
      status: isRestaurantOpenFlag ? 'OPEN' : 'CLOSED',
      labelEn: isRestaurantOpenFlag ? 'Open Now' : 'Closed',
      labelSw: isRestaurantOpenFlag ? 'Imefunguliwa' : 'Imefungwa',
    };
  }

  const { dayOfWeek, currentMinutes } = getDarEsSalaamTime(evaluationDate);
  const yesterdayOfWeek = (dayOfWeek + 6) % 7;

  // Filter hours matching serviceType (fallback to PICKUP or first available)
  const serviceRows = operatingHours.filter(
    (h) => !h.serviceType || h.serviceType === serviceType
  );
  const effectiveHours = serviceRows.length > 0 ? serviceRows : operatingHours;

  const todayRow = effectiveHours.find((h) => h.dayOfWeek === dayOfWeek);
  const yesterdayRow = effectiveHours.find((h) => h.dayOfWeek === yesterdayOfWeek);

  // Check 1: Did yesterday have an overnight shift extending into today's early morning?
  if (yesterdayRow && !yesterdayRow.isClosed) {
    const yOpen = parseMinutes(yesterdayRow.opensAt);
    const yClose = parseMinutes(yesterdayRow.closesAt);
    if (yClose < yOpen && currentMinutes < yClose) {
      // Still open from yesterday's overnight shift!
      return {
        isOpen: true,
        isPaused: false,
        status: 'OPEN',
        labelEn: 'Open Now',
        labelSw: 'Imefunguliwa',
        closesAtTime: formatTime24(yesterdayRow.closesAt),
      };
    }
  }

  // Check 2: Today's schedule
  if (!todayRow || todayRow.isClosed) {
    return {
      isOpen: false,
      isPaused: false,
      status: 'CLOSED_TODAY',
      labelEn: 'Closed',
      labelSw: 'Imefungwa',
    };
  }

  const openMin = parseMinutes(todayRow.opensAt);
  const closeMin = parseMinutes(todayRow.closesAt);
  const isOvernight = closeMin < openMin;

  if (isOvernight) {
    if (currentMinutes >= openMin) {
      return {
        isOpen: true,
        isPaused: false,
        status: 'OPEN',
        labelEn: 'Open Now',
        labelSw: 'Imefunguliwa',
        opensAtTime: formatTime24(todayRow.opensAt),
        closesAtTime: formatTime24(todayRow.closesAt),
      };
    } else {
      return {
        isOpen: false,
        isPaused: false,
        status: 'OPENS_LATER',
        labelEn: `Opens at ${formatTime24(todayRow.opensAt)}`,
        labelSw: `Inafungua saa ${formatTime24(todayRow.opensAt)}`,
        opensAtTime: formatTime24(todayRow.opensAt),
      };
    }
  }

  // Standard regular day shift (openMin < closeMin)
  if (currentMinutes < openMin) {
    return {
      isOpen: false,
      isPaused: false,
      status: 'OPENS_LATER',
      labelEn: `Opens at ${formatTime24(todayRow.opensAt)}`,
      labelSw: `Inafungua saa ${formatTime24(todayRow.opensAt)}`,
      opensAtTime: formatTime24(todayRow.opensAt),
    };
  }

  if (currentMinutes >= openMin && currentMinutes < closeMin) {
    return {
      isOpen: true,
      isPaused: false,
      status: 'OPEN',
      labelEn: 'Open Now',
      labelSw: 'Imefunguliwa',
      opensAtTime: formatTime24(todayRow.opensAt),
      closesAtTime: formatTime24(todayRow.closesAt),
    };
  }

  // Current time is after closing
  return {
    isOpen: false,
    isPaused: false,
    status: 'CLOSED',
    labelEn: 'Closed',
    labelSw: 'Imefungwa',
    closesAtTime: formatTime24(todayRow.closesAt),
  };
}
