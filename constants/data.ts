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

export const RESTAURANTS: Restaurant[] = [
  {
    id: 'mama-amina-biryani',
    name: 'Mama Amina Biryani House',
    cuisine: 'Biryani • Swahili Specialist',
    specialistCategory: 'biryani',
    specialistBadge: '👑 Biryani Specialist',
    specialistBadgeSw: '👑 Bingwa wa Biryani',
    rating: 4.9,
    reviews: 640,
    distanceKm: 0.8,
    distance: '0.8 km',
    time: '20–35 min',
    price: 'TZS 8,000–20,000',
    minPrice: 8000,
    maxPrice: 20000,
    isOpen: true,
    budgetTier: 'budget',
    tags: ['biryani', 'swahili', 'pilau', 'meat', 'spiced', 'mikocheni', 'group'],
    emoji: '👑',
    bgGradient: ['#fef3c7', '#fde68a'],
    specialty: 'Authentic Slow-Cooked Zanzibar Beef & Mutton Biryani',
    address: 'Old Bagamoyo Rd, Mikocheni B, Dar es Salaam',
    neighborhood: 'Mikocheni',
    phone: '+255 754 889 120',
    lat: -6.7645,
    lng: 39.2450,
    supportsOrderAhead: true,
    maxGroupCapacity: 50,
    menu: [
      { id: 'mab-1', name: 'Zanzibar Royal Mutton Biryani', desc: 'Slow-braised goat meat with saffron basmati rice, eggs, tomato gravy', price: 'TZS 14,000', priceNum: 14000, popular: true },
      { id: 'mab-2', name: 'Swahili Chicken Dum Biryani', desc: 'Marinated kuku wa kienyeji, golden caramelized onions, kachumbari', price: 'TZS 12,000', priceNum: 12000, popular: true },
      { id: 'mab-3', name: 'Beef Masala Biryani Pot (Serves 2-3)', desc: 'Tender beef chunks in thick spiced masala, fragrant long-grain rice', price: 'TZS 22,000', priceNum: 22000 },
      { id: 'mab-4', name: 'Tangawizi Spiced Lemonade', desc: 'Fresh ginger root, lime juice, and wild honey', price: 'TZS 4,000', priceNum: 4000 },
    ],
  },
  {
    id: 'kibo-mchemsho',
    name: 'Kibo Mchemsho & Supu Lounge',
    cuisine: 'Mchemsho • Traditional Broths',
    specialistCategory: 'mchemsho',
    specialistBadge: '🍲 Mchemsho Specialist',
    specialistBadgeSw: '🍲 Bingwa wa Mchemsho',
    rating: 4.8,
    reviews: 490,
    distanceKm: 1.2,
    distance: '1.2 km',
    time: '25–40 min',
    price: 'TZS 10,000–28,000',
    minPrice: 10000,
    maxPrice: 28000,
    isOpen: true,
    budgetTier: 'mid',
    tags: ['mchemsho', 'supu', 'kienyeji', 'healthy', 'traditional', 'sinza'],
    emoji: '🍲',
    bgGradient: ['#fed7aa', '#fb923c'],
    specialty: 'Kuku wa Kienyeji Mchemsho with Steamed Green Plantains & Carrots',
    address: 'Shekilango Rd, Sinza Mori, Dar es Salaam',
    neighborhood: 'Sinza',
    phone: '+255 768 334 991',
    lat: -6.7820,
    lng: 39.2280,
    supportsOrderAhead: true,
    maxGroupCapacity: 30,
    menu: [
      { id: 'km-1', name: 'Kuku wa Kienyeji Mchemsho (Whole/Half)', desc: 'Free-range village chicken boiled slowly with potatoes, carrots, ginger, green pepper', price: 'TZS 18,000', priceNum: 18000, popular: true },
      { id: 'km-2', name: 'Ndizi Machoma Mchemsho Combo', desc: 'Simmered green bananas with tender beef ribs in rich herbal broth', price: 'TZS 15,000', priceNum: 15000, popular: true },
      { id: 'km-3', name: 'Samaki wa Kupika Mchemsho', desc: 'Fresh tilapia boiled in lemongrass, lime juice, sweet onions', price: 'TZS 16,000', priceNum: 16000 },
      { id: 'km-4', name: 'Fresh Sugar Cane & Ginger Juice', desc: 'Cold-pressed raw sugar cane with lime', price: 'TZS 4,500', priceNum: 4500 },
    ],
  },
  {
    id: 'serengeti-nyama-choma',
    name: 'Serengeti Choma & Grill Hub',
    cuisine: 'Nyama Choma • Charcoal Grill',
    specialistCategory: 'nyama_choma',
    specialistBadge: '🥩 Nyama Choma Specialist',
    specialistBadgeSw: '🥩 Bingwa wa Nyama Choma',
    rating: 4.9,
    reviews: 820,
    distanceKm: 1.5,
    distance: '1.5 km',
    time: '30–50 min',
    price: 'TZS 12,000–35,000',
    minPrice: 12000,
    maxPrice: 35000,
    isOpen: true,
    budgetTier: 'mid',
    tags: ['choma', 'bbq', 'goat', 'mishkaki', 'grill', 'oysterbay', 'group'],
    emoji: '🥩',
    bgGradient: ['#fecaca', '#ef4444'],
    specialty: 'Tender Charcoal-Grilled Goat Ribs & Spicy Mishkaki Skewers',
    address: 'Ali Hassan Mwinyi Rd, Oysterbay, Dar es Salaam',
    neighborhood: 'Oysterbay',
    phone: '+255 755 990 011',
    lat: -6.7710,
    lng: 39.2680,
    supportsOrderAhead: true,
    maxGroupCapacity: 60,
    menu: [
      { id: 'snc-1', name: 'Mbuzi Choma 1kg (Goat Ribs)', desc: 'Seasoned in rock salt, garlic, charred on charcoal with ugali and kachumbari', price: 'TZS 22,000', priceNum: 22000, popular: true },
      { id: 'snc-2', name: 'Mishkaki ya Ngombe (6 Skewers)', desc: 'Marinated beef fillet cubes grilled on skewers with tamarind chili sauce', price: 'TZS 12,000', priceNum: 12000, popular: true },
      { id: 'snc-3', name: 'Kuku Choma Platter (Half Chicken)', desc: 'Charcoal-grilled kuku kienyeji, chips mayai, coleslaw', price: 'TZS 16,000', priceNum: 16000 },
      { id: 'snc-4', name: 'Chips Mayai (Zanzibar Omelette)', desc: 'Crispy hand-cut fries cooked into a 2-egg fluffy omelette', price: 'TZS 5,500', priceNum: 5500 },
    ],
  },
  {
    id: 'green-leaf',
    name: 'Green Leaf Café & Plant Lab',
    cuisine: 'Healthy • Vegetarian Specialist',
    specialistCategory: 'vegetarian',
    specialistBadge: '🌿 Vegetarian Specialist',
    specialistBadgeSw: '🌿 Bingwa wa Vyakula vya Mboga',
    rating: 4.8,
    reviews: 320,
    distanceKm: 0.4,
    distance: '0.4 km',
    time: '15–25 min',
    price: 'TZS 6,000–18,000',
    minPrice: 6000,
    maxPrice: 18000,
    isOpen: true,
    budgetTier: 'mid',
    tags: ['healthy', 'salad', 'avocado', 'smoothie', 'vegan', 'vegetarian'],
    emoji: '🥗',
    bgGradient: ['#dbecc8', '#b7d7aa'],
    specialty: 'Superfood Quinoa Bowl, Vegan Wraps & Cold-Pressed Juices',
    address: 'Haile Selassie Rd, Oysterbay, Dar es Salaam',
    neighborhood: 'Oysterbay',
    phone: '+255 754 112 233',
    lat: -6.7735,
    lng: 39.2730,
    supportsOrderAhead: true,
    maxGroupCapacity: 25,
    menu: [
      { id: 'gl-1', name: 'Superfood Avocado Salad', desc: 'Crisp local greens, Hass avocado, chia seeds, lemon vinaigrette', price: 'TZS 12,000', priceNum: 12000, popular: true },
      { id: 'gl-2', name: 'Power Protein Smoothie Bowl', desc: 'Spirulina, frozen mango, coconut milk, roasted almonds', price: 'TZS 9,500', priceNum: 9500, popular: true },
      { id: 'gl-3', name: 'Artisan Sourdough Melt', desc: 'Smoked mozzarella, heirloom tomatoes, fresh pesto', price: 'TZS 14,000', priceNum: 14000 },
      { id: 'gl-4', name: 'Zanzibar Spice Cold Brew', desc: 'Single-origin Arabica infused with cinnamon & cardamom', price: 'TZS 6,000', priceNum: 6000 },
    ],
  },
  {
    id: 'samaki-corner',
    name: 'Samaki Corner Coastal Kitchen',
    cuisine: 'Swahili • Traditional Coastal Specialist',
    specialistCategory: 'traditional',
    specialistBadge: '🥘 Traditional Swahili Specialist',
    specialistBadgeSw: '🥘 Bingwa wa Mapishi ya Asili',
    rating: 4.7,
    reviews: 410,
    distanceKm: 0.9,
    distance: '0.9 km',
    time: '20–30 min',
    price: 'TZS 7,000–25,000',
    minPrice: 7000,
    maxPrice: 25000,
    isOpen: true,
    budgetTier: 'mid',
    tags: ['fish', 'seafood', 'swahili', 'samaki', 'local', 'masaki'],
    emoji: '🐟',
    bgGradient: ['#e9d5ff', '#c084fc'],
    specialty: 'Samaki wa Kupaka, Coconut Rice & Matokeo ya Nazi',
    address: 'Slipway Rd, Masaki, Dar es Salaam',
    neighborhood: 'Masaki',
    phone: '+255 759 667 788',
    lat: -6.7570,
    lng: 39.2790,
    supportsOrderAhead: true,
    maxGroupCapacity: 35,
    menu: [
      { id: 'sc-1', name: 'Samaki wa Kupaka', desc: 'Charcoal-grilled whole fish bathed in rich spiced coconut sauce', price: 'TZS 22,000', priceNum: 22000, popular: true },
      { id: 'sc-2', name: 'Crispy Calamari Rings', desc: 'Local squid rings lightly dusted, lime-chili tartar sauce', price: 'TZS 16,000', priceNum: 16000, popular: true },
      { id: 'sc-3', name: 'Wali wa Nazi (Coconut Rice)', desc: 'Fragrant jasmine rice slowly simmered in fresh coconut milk', price: 'TZS 5,000', priceNum: 5000 },
      { id: 'sc-4', name: 'Fresh Passion Juice (500ml)', desc: '100% natural cold-pressed local passion fruit juice', price: 'TZS 4,000', priceNum: 4000 },
    ],
  },
  {
    id: 'ocean-view',
    name: 'Ocean View Seafood & Grill',
    cuisine: 'Seafood • Grill',
    specialistCategory: 'traditional',
    specialistBadge: '🦞 Seafood & Grill Specialist',
    specialistBadgeSw: '🦞 Bingwa wa Vyakula vya Baharini',
    rating: 4.9,
    reviews: 780,
    distanceKm: 1.8,
    distance: '1.8 km',
    time: '30–45 min',
    price: 'TZS 12,000–45,000',
    minPrice: 12000,
    maxPrice: 45000,
    isOpen: true,
    budgetTier: 'premium',
    tags: ['seafood', 'lobster', 'prawns', 'grill', 'masaki'],
    emoji: '🦞',
    bgGradient: ['#bae6fd', '#7dd3fc'],
    specialty: 'Jumbo Garlic Butter Prawns & Catch of the Day',
    address: 'Toure Drive, Masaki Peninsula, Dar es Salaam',
    neighborhood: 'Masaki',
    phone: '+255 715 889 900',
    lat: -6.7510,
    lng: 39.2885,
    supportsOrderAhead: true,
    maxGroupCapacity: 40,
    menu: [
      { id: 'ov-1', name: 'Jumbo Garlic Butter Prawns', desc: 'Indian Ocean wild-caught tiger prawns, saffron rice, garlic dip', price: 'TZS 32,000', priceNum: 32000, popular: true },
      { id: 'ov-2', name: 'Grilled Red Snapper Platter', desc: 'Whole reef snapper grilled on charcoal, cassava fries', price: 'TZS 28,000', priceNum: 28000, popular: true },
    ],
  },
];

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
