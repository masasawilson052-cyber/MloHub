/**
 * Staging Seed Login Accounts.
 * Strictly reads every password from environment variables:
 * STAGING_DEFAULT_PASSWORD, STAGING_CUSTOMER_PASSWORD,
 * STAGING_OWNER_PASSWORD, STAGING_ADMIN_PASSWORD.
 * Zero hard-coded credentials.
 */

import { SeedUserAccount } from './types';

export function getStagingAccounts(): {
  customer: SeedUserAccount;
  owner1: SeedUserAccount;
  owner2: SeedUserAccount;
  admin: SeedUserAccount;
} {
  const defaultPass = process.env.STAGING_DEFAULT_PASSWORD || '';

  return {
    customer: {
      email: process.env.STAGING_CUSTOMER_EMAIL || 'staging.customer@mlohub.tz',
      password: process.env.STAGING_CUSTOMER_PASSWORD || defaultPass,
      fullName: 'Juma Mteja (Staging Customer)',
      phone: '+255711000001',
      role: 'CUSTOMER',
    },
    owner1: {
      email: process.env.STAGING_OWNER1_EMAIL || 'staging.owner.amina@mlohub.tz',
      password: process.env.STAGING_OWNER_PASSWORD || defaultPass,
      fullName: 'Mama Amina (Staging Owner)',
      phone: '+255711000002',
      role: 'RESTAURANT_OWNER',
      restaurantSlug: 'mama-amina-mikocheni',
    },
    owner2: {
      email: process.env.STAGING_OWNER2_EMAIL || 'staging.owner.biryani@mlohub.tz',
      password: process.env.STAGING_OWNER_PASSWORD || defaultPass,
      fullName: 'Sharif Zanzibar (Staging Owner)',
      phone: '+255711000003',
      role: 'RESTAURANT_OWNER',
      restaurantSlug: 'zanzibar-spice-msasani',
    },
    admin: {
      email: process.env.STAGING_ADMIN_EMAIL || 'staging.admin@mlohub.tz',
      password: process.env.STAGING_ADMIN_PASSWORD || defaultPass,
      fullName: 'Admin MloHub (Staging Admin)',
      phone: '+255711000004',
      role: 'ADMIN',
    },
  };
}
