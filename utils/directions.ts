export function directionsUrl(place: { lat?: number; lng?: number; name?: string; address?: string }): string {
  const validCoordinates = typeof place.lat === 'number' && typeof place.lng === 'number' &&
    Number.isFinite(place.lat) && Number.isFinite(place.lng) && Math.abs(place.lat) <= 90 && Math.abs(place.lng) <= 180;
  const destination = validCoordinates ? `${place.lat},${place.lng}` : [place.name, place.address].filter(Boolean).join(', ');
  if (!destination) throw new Error('This restaurant has not provided a location yet.');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
