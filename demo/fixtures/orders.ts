import { CustomMealRequestEntity } from '../../db/types';

/**
 * Isolated demo / test custom meal and order fixtures.
 * STRICTLY FOR USE IN TESTS AND DEMO SANDBOX MODE.
 * FORBIDDEN IN PRODUCTION, STAGING, AND LOCAL DEVELOPMENT BACKEND CALLS.
 */
export const DEMO_CUSTOM_MEALS: CustomMealRequestEntity[] = [
  {
    id: 'cm-201',
    userId: 'usr-frank',
    orderNumber: 'MLO-8842',
    dishName: '10x Zanzibar Spiced Beef Pilau & Biryani (Mikocheni Workshop)',
    restaurantName: 'Mama Amina Biryani House',
    targetRestaurantId: 'mama-amina-biryani',
    specialInstructions: 'Schedule: Tomorrow 1:00 PM | Area: Mikocheni B | High Protein Beef, No peanut oil, mild spice with cold-pressed passion juice.',
    budgetTzs: 110000,
    servingsCount: '10',
    diningOption: 'Delivery',
    status: 'Pending Confirmation',
    statusMessageEn: 'Pending chef final confirmation • You can edit menu items & spice anytime before cooking begins.',
    statusMessageSw: 'Inasubiri uthibitisho wa mpishi • Unaweza kuhariri vyakula na viungo kabla ya mapishi kuanza.',
    createdAt: '2026-08-27T06:30:00Z',
    updatedAt: '2026-08-27T06:30:00Z',
  },
];
