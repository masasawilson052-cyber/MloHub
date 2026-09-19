import { RestaurantRole } from '../types/auth';
import { Ionicons } from '@expo/vector-icons';

export type RestaurantTab =
  | 'overview'
  | 'orders'
  | 'kitchen'
  | 'custom-meals'
  | 'menu'
  | 'reservations'
  | 'reviews'
  | 'earnings'
  | 'analytics'
  | 'staff'
  | 'settings';

export interface NavItemConfig {
  id: RestaurantTab;
  label: string;
  labelSw: string;
  icon: keyof typeof Ionicons.glyphMap;
  badgeCount?: number;
  allowedRoles: RestaurantRole[];
}


export const RESTAURANT_NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    labelSw: 'Muhtasari',
    icon: 'grid-outline',
    allowedRoles: ['OWNER', 'MANAGER'],
  },
  {
    id: 'orders',
    label: 'Orders',
    labelSw: 'Oda Mpya',
    icon: 'receipt-outline',
    allowedRoles: ['OWNER', 'MANAGER', 'CHEF', 'STAFF'],
  },
  {
    id: 'kitchen',
    label: 'Kitchen Board',
    labelSw: 'Jikoni (Queue)',
    icon: 'flame-outline',
    allowedRoles: ['OWNER', 'MANAGER', 'CHEF'],
  },
  {
    id: 'custom-meals',
    label: 'Custom Meals',
    labelSw: 'Milo Maalum',
    icon: 'sparkles-outline',
    allowedRoles: ['OWNER', 'MANAGER', 'CHEF'],
  },
  {
    id: 'menu',
    label: 'Menu & Prices',
    labelSw: 'Vyakula na Bei',
    icon: 'restaurant-outline',
    allowedRoles: ['OWNER', 'MANAGER', 'CHEF'],
  },
  {
    id: 'reservations',
    label: 'Reservations',
    labelSw: 'Nafasi za Meza',
    icon: 'calendar-outline',
    allowedRoles: ['OWNER', 'MANAGER', 'STAFF'],
  },
  {
    id: 'reviews',
    label: 'Reviews',
    labelSw: 'Maoni ya Wateja',
    icon: 'star-outline',
    allowedRoles: ['OWNER', 'MANAGER'],
  },
  {
    id: 'earnings',
    label: 'Earnings',
    labelSw: 'Mapato na Malipo',
    icon: 'cash-outline',
    allowedRoles: ['OWNER', 'MANAGER'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    labelSw: 'Takwimu',
    icon: 'trending-up-outline',
    allowedRoles: ['OWNER', 'MANAGER'],
  },
  {
    id: 'staff',
    label: 'Staff Management',
    labelSw: 'Wafanyakazi',
    icon: 'people-outline',
    allowedRoles: ['OWNER'],
  },
  {
    id: 'settings',
    label: 'Settings',
    labelSw: 'Mipangilio',
    icon: 'settings-outline',
    allowedRoles: ['OWNER', 'MANAGER'],
  },
];
