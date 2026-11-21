/**
 * ============================================================================
 * MLOHUB DELIVERY ZONE & WARD MATCHER
 * ============================================================================
 * Matches a customer's neighborhood/ward against restaurant delivery zones:
 * 1. Exact match on supported wards (e.g. "Mikocheni" === "Mikocheni")
 * 2. Prefix / suffix tolerance (e.g. "Mikocheni" matches "Mikocheni A" or vice versa)
 * 3. Fallback match against zone name
 */

export function matchDeliveryZone(
  deliveryZones: any[] = [],
  customerArea?: string
): any | null {
  if (!customerArea || !deliveryZones || deliveryZones.length === 0) return null;
  const cleanArea = customerArea.trim().toLowerCase();

  // 1. Exact match on supported wards
  for (const zone of deliveryZones) {
    const wards = zone.supportedWards || zone.supported_wards || [];
    for (const w of wards) {
      if (typeof w === 'string' && w.trim().toLowerCase() === cleanArea) {
        return zone;
      }
    }
  }

  // 2. Prefix / suffix tolerance (e.g. "Mikocheni" matches "Mikocheni A")
  for (const zone of deliveryZones) {
    const wards = zone.supportedWards || zone.supported_wards || [];
    for (const w of wards) {
      if (typeof w === 'string') {
        const cleanW = w.trim().toLowerCase();
        if (cleanW.startsWith(cleanArea) || cleanArea.startsWith(cleanW)) {
          return zone;
        }
      }
    }
  }

  // 3. Fallback: Zone name contains area or vice versa
  for (const zone of deliveryZones) {
    const name = (zone.zoneName || zone.zone_name || '').trim().toLowerCase();
    if (name && (name.includes(cleanArea) || cleanArea.includes(name))) {
      return zone;
    }
  }

  return null;
}

export function getRestaurantInitials(name: string): string {
  if (!name) return 'ML';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
