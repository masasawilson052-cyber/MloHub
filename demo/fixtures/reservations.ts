import { ReservationEntity } from '../../db/types';

/**
 * Isolated demo / test reservation fixtures.
 * STRICTLY FOR USE IN TESTS AND DEMO SANDBOX MODE.
 * FORBIDDEN IN PRODUCTION, STAGING, AND LOCAL DEVELOPMENT BACKEND CALLS.
 */
export const DEMO_RESERVATIONS: ReservationEntity[] = [
  {
    id: 'res-101',
    userId: 'usr-frank',
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    guestsCount: '10 Guests (Corporate Lunch)',
    reservationDate: 'Tomorrow (May 18, 2026)',
    timeSlot: '1:00 PM',
    status: 'confirmed',
    address: 'Old Bagamoyo Rd, Mikocheni B, Dar es Salaam',
    specialNotes: 'VIP Private dining section for 10 executives with fresh passion juice.',
    createdAt: '2026-08-25T14:30:00Z',
  },
];
