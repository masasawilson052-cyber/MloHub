export type SpecialistCategory =
  | 'biryani'
  | 'mchemsho'
  | 'nyama_choma'
  | 'traditional'
  | 'vegetarian'
  | 'breakfast_baking';

export interface MenuItem {
  id: string;
  name: string;
  desc: string;
  price: string;
  priceNum: number;
  popular?: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  specialistCategory: SpecialistCategory;
  specialistBadge: string;
  specialistBadgeSw: string;
  rating: number;
  reviews: number;
  distanceKm: number;
  distance: string;
  time: string;
  price: string;
  minPrice: number;
  maxPrice: number;
  isOpen: boolean;
  budgetTier: 'budget' | 'mid' | 'premium';
  tags: string[];
  emoji: string;
  bgGradient: [string, string];
  specialty: string;
  address: string;
  neighborhood: string;
  phone: string;
  lat: number;
  lng: number;
  supportsOrderAhead: boolean;
  maxGroupCapacity: number;
  menu: MenuItem[];
}

import { DEMO_RESTAURANTS } from '../demo/fixtures/restaurants';

/**
 * @deprecated Test/demo fixture only.
 * Production code must load restaurants authoritatively via RestaurantRepository.
 */
export const RESTAURANTS: Restaurant[] = DEMO_RESTAURANTS;

export const SPECIALIST_CATEGORIES = [
  { id: 'all', nameEn: 'All Specialists', nameSw: 'Wataalamu Wote', emoji: '⭐' },
  { id: 'biryani', nameEn: 'Biryani Specialist', nameSw: 'Bingwa wa Biryani', emoji: '👑' },
  { id: 'mchemsho', nameEn: 'Mchemsho Specialist', nameSw: 'Bingwa wa Mchemsho', emoji: '🍲' },
  { id: 'nyama_choma', nameEn: 'Nyama Choma Specialist', nameSw: 'Bingwa wa Nyama Choma', emoji: '🥩' },
  { id: 'traditional', nameEn: 'Traditional Swahili', nameSw: 'Mapishi ya Asili', emoji: '🥘' },
  { id: 'vegetarian', nameEn: 'Vegetarian & Plant', nameSw: 'Mboga na Afya', emoji: '🌿' },
];

export const DAR_LOCATIONS = [
  { id: 'all', name: 'All Dar es Salaam', count: 6, popular: true },
  { id: 'mikocheni', name: 'Mikocheni', count: 2, popular: true },
  { id: 'oysterbay', name: 'Oysterbay', count: 2, popular: true },
  { id: 'masaki', name: 'Masaki Peninsula', count: 2, popular: true },
  { id: 'sinza', name: 'Sinza', count: 1, popular: true },
  { id: 'city-centre', name: 'City Centre (Posta)', count: 0, popular: false },
  { id: 'upanga', name: 'Upanga', count: 0, popular: false },
  { id: 'kariakoo', name: 'Kariakoo', count: 0, popular: false },
];
