/**
 * Location presets for branches in Dar es Salaam.
 * Provides accurate geo-coordinates, districts, wards, and typical addresses
 * for fast and accurate merchant branch onboarding.
 */

export interface LocationPreset {
  id: string;
  name: string;
  region: string;
  district: string;
  ward: string;
  address: string;
  latitude: number;
  longitude: number;
  tag: string;
}

export const DAR_ES_SALAAM_LOCATION_PRESETS: LocationPreset[] = [
  {
    id: 'sinza',
    name: 'Sinza (Mori / Shekilango)',
    region: 'Dar es Salaam',
    district: 'Kinondoni',
    ward: 'Sinza',
    address: 'Shekilango Road, Karibu na Mori',
    latitude: -6.7865,
    longitude: 39.2250,
    tag: 'Popular Food Hub',
  },
  {
    id: 'mikocheni',
    name: 'Mikocheni (Old Bagamoyo / Kibaki)',
    region: 'Dar es Salaam',
    district: 'Kinondoni',
    ward: 'Mikocheni',
    address: 'Mwai Kibaki Road, Karibu na Mayfair',
    latitude: -6.7620,
    longitude: 39.2480,
    tag: 'Commercial / Dining',
  },
  {
    id: 'masaki',
    name: 'Masaki / Peninsula (Chole / Toure)',
    region: 'Dar es Salaam',
    district: 'Kinondoni',
    ward: 'Masaki',
    address: 'Chole Road / Haile Selassie',
    latitude: -6.7540,
    longitude: 39.2830,
    tag: 'Peninsula Dining',
  },
  {
    id: 'oysterbay',
    name: 'Oysterbay (Haile Selassie)',
    region: 'Dar es Salaam',
    district: 'Kinondoni',
    ward: 'Oysterbay',
    address: 'Haile Selassie Road, Dar es Salaam',
    latitude: -6.7735,
    longitude: 39.2730,
    tag: 'Upscale / Cafes',
  },
  {
    id: 'kinondoni',
    name: 'Kinondoni (Biafra / Manyanya)',
    region: 'Dar es Salaam',
    district: 'Kinondoni',
    ward: 'Kinondoni',
    address: 'Kawawa Road, Karibu na Biafra',
    latitude: -6.7910,
    longitude: 39.2610,
    tag: 'Vibrant Local Spot',
  },
  {
    id: 'mwenge',
    name: 'Mwenge (Sam Nujoma / Mlimani)',
    region: 'Dar es Salaam',
    district: 'Kinondoni',
    ward: 'Mwenge',
    address: 'Sam Nujoma Road, Karibu na Mlimani City',
    latitude: -6.7710,
    longitude: 39.2190,
    tag: 'High Traffic Area',
  },
  {
    id: 'kariakoo',
    name: 'Kariakoo (Msimbazi / Swahili)',
    region: 'Dar es Salaam',
    district: 'Ilala',
    ward: 'Kariakoo',
    address: 'Msimbazi Street, Katikati ya Soko',
    latitude: -6.8220,
    longitude: 39.2760,
    tag: 'Central Market',
  },
  {
    id: 'posta',
    name: 'Posta / CBD (Samora / Kivukoni)',
    region: 'Dar es Salaam',
    district: 'Ilala',
    ward: 'Kivukoni',
    address: 'Samora Avenue, Karibu na Mnara wa Saa',
    latitude: -6.8160,
    longitude: 39.2890,
    tag: 'Business District',
  },
  {
    id: 'upanga',
    name: 'Upanga (United Nations / Ali Hassan)',
    region: 'Dar es Salaam',
    district: 'Ilala',
    ward: 'Upanga',
    address: 'United Nations Road, Upanga Mashariki',
    latitude: -6.8080,
    longitude: 39.2810,
    tag: 'Residential & Cafes',
  },
  {
    id: 'mbezi-beach',
    name: 'Mbezi Beach (Africana / Kawe)',
    region: 'Dar es Salaam',
    district: 'Kinondoni',
    ward: 'Kawe',
    address: 'Africana Junction, Mbezi Beach Road',
    latitude: -6.7180,
    longitude: 39.2310,
    tag: 'Coastal / Fast Food',
  },
  {
    id: 'tegeta',
    name: 'Tegeta (Kibo Complex / Wazo)',
    region: 'Dar es Salaam',
    district: 'Kinondoni',
    ward: 'Kunduchi',
    address: 'Bagamoyo Road, Karibu na Kibo Complex',
    latitude: -6.6780,
    longitude: 39.2100,
    tag: 'North Hub',
  },
  {
    id: 'kimara',
    name: 'Kimara / Ubungo (Morogoro Road)',
    region: 'Dar es Salaam',
    district: 'Ubungo',
    ward: 'Kimara',
    address: 'Morogoro Road, Karibu na Stendi ya Mwendokasi',
    latitude: -6.7990,
    longitude: 39.1760,
    tag: 'West Corridor',
  },
];
