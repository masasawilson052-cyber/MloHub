/**
 * ============================================================================
 * MLOHUB FOOD CATEGORIES CONFIGURATION
 * ============================================================================
 * 8 fast-browse craving categories for the Home screen category grid.
 * Mapped to real seed data cuisine types and top 3 keywords present in dish names.
 */

export interface FoodCategory {
  id: string;
  labelEn: string;
  labelSw: string;
  icon: string;
  cuisineTypes: string[];
  searchKeywords: [string, string, string];
}

export const FOOD_CATEGORIES: FoodCategory[] = [
  {
    id: 'breakfast-chai',
    labelEn: 'Breakfast / Chai',
    labelSw: 'Chai & Asubuhi',
    icon: 'cafe-outline',
    cuisineTypes: ['Breakfast & Cafe'],
    searchKeywords: ['Chai', 'Chapati', 'Kahawa'],
  },
  {
    id: 'pilau-biryani',
    labelEn: 'Pilau & Biryani',
    labelSw: 'Pilau & Biriani',
    icon: 'flame-outline',
    cuisineTypes: ['Coastal & Biryani'],
    searchKeywords: ['Biryani', 'Pilau', 'Wali'],
  },
  {
    id: 'chipsi-street-food',
    labelEn: 'Chipsi & Street Food',
    labelSw: 'Chipsi & Mtaani',
    icon: 'fast-food-outline',
    cuisineTypes: ['Street Food & Swahili'],
    searchKeywords: ['Chipsi', 'Mishkaki', 'Zege'],
  },
  {
    id: 'nyama-choma-grill',
    labelEn: 'Nyama Choma & Grill',
    labelSw: 'Nyama Choma',
    icon: 'bonfire-outline',
    cuisineTypes: ['BBQ & Grill'],
    searchKeywords: ['Choma', 'Mishkaki', 'Grill'],
  },
  {
    id: 'seafood-samaki',
    labelEn: 'Seafood / Samaki',
    labelSw: 'Samaki & Bahari',
    icon: 'fish-outline',
    cuisineTypes: ['Coastal Seafood'],
    searchKeywords: ['Samaki', 'Fish', 'Pweza'],
  },
  {
    id: 'mama-ntilie',
    labelEn: 'Mama Ntilie',
    labelSw: 'Mama Ntilie',
    icon: 'home-outline',
    cuisineTypes: ['Traditional Swahili'],
    searchKeywords: ['Ugali', 'Maharage', 'Kienyeji'],
  },
  {
    id: 'juice-snacks',
    labelEn: 'Juice & Snacks',
    labelSw: 'Juisi & Vitafunwa',
    icon: 'wine-outline',
    cuisineTypes: ['Juice Bar & Snacks'],
    searchKeywords: ['Juisi', 'Juice', 'Mihogo'],
  },
  {
    id: 'healthy-light',
    labelEn: 'Healthy & Light',
    labelSw: 'Vyakula Vyepesi',
    icon: 'leaf-outline',
    cuisineTypes: [], // Keywords only per specification
    searchKeywords: ['Salad', 'Supu', 'Matunda'],
  },
];

export function getCategoryById(id: string): FoodCategory | undefined {
  return FOOD_CATEGORIES.find((c) => c.id === id);
}
