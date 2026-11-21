/**
 * Type definitions for Staging Seed Data.
 * Strongly-typed domain structures for dense-zone Dar es Salaam restaurants,
 * dishes, delivery zones, categories, and staging user accounts.
 */

export interface SeedDish {
  nameSw: string;
  nameEn: string;
  descriptionSw: string;
  descriptionEn: string;
  priceTzs: number;
  imageFileName: string;
  categoryIndex: number;
  spiceLevel?: 'Mild' | 'Medium' | 'Hot';
  dietaryTags?: string[];
}

export interface SeedDeliveryZone {
  zoneName: string;
  feeTzs: number;
  minimumOrderTzs: number;
  estimatedDeliveryMinutes: number;
  supportedWards: string[];
}

export interface SeedCategory {
  nameSw: string;
  nameEn: string;
  displayOrder: number;
}

export interface SeedRestaurant {
  id: string;
  name: string;
  slug: string;
  cuisine: string;
  description: string;
  emoji: string;
  tags: string[];
  address: string;
  neighborhood: string;
  district: string;
  ward: string;
  lat: number;
  lng: number;
  phone: string;
  minPriceTzs: number;
  maxPriceTzs: number;
  rating: number;
  reviewsCount: number;
  coverImageFileName: string;
  specialty: string;
  specialistBadge: string;
  categories: SeedCategory[];
  zones: SeedDeliveryZone[];
  dishes: SeedDish[];
}

export interface SeedUserAccount {
  email: string;
  password?: string;
  fullName: string;
  phone: string;
  role: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'ADMIN';
  restaurantSlug?: string;
}
