/**
 * ============================================================================
 * MLOHUB SWAHILI-ENGLISH FOOD SYNONYM DICTIONARY
 * ============================================================================
 * Maps common Tanzanian Swahili culinary terms with their English equivalents
 * to enable seamless bilingual search term expansion.
 */

export interface FoodSynonymGroup {
  canonicalEn: string;
  canonicalSw: string;
  terms: string[];
}

export const FOOD_SYNONYMS: FoodSynonymGroup[] = [
  {
    canonicalEn: 'chicken',
    canonicalSw: 'kuku',
    terms: ['chicken', 'kuku', 'kuku wa kienyeji', 'kienyeji', 'broiler', 'poultry'],
  },
  {
    canonicalEn: 'fish',
    canonicalSw: 'samaki',
    terms: ['fish', 'samaki', 'tilapia', 'sato', 'sangara', 'changu', 'seafood'],
  },
  {
    canonicalEn: 'rice',
    canonicalSw: 'wali',
    terms: ['rice', 'wali', 'basmati', 'steamed rice'],
  },
  {
    canonicalEn: 'fries',
    canonicalSw: 'chipsi',
    terms: ['fries', 'chips', 'chipsi', 'chipsi mayai', 'french fries', 'potato chips'],
  },
  {
    canonicalEn: 'beef',
    canonicalSw: 'nyama ya ngombe',
    terms: ['beef', 'nyama', 'ngombe', "nyama ya ng'ombe", 'steak'],
  },
  {
    canonicalEn: 'goat',
    canonicalSw: 'mbuzi',
    terms: ['goat', 'mbuzi', 'nyama ya mbuzi', 'mutton', 'kambuzi'],
  },
  {
    canonicalEn: 'grilled',
    canonicalSw: 'choma',
    terms: ['grilled', 'bbq', 'barbecue', 'choma', 'kuchoma', 'mishkaki', 'roast'],
  },
  {
    canonicalEn: 'stew',
    canonicalSw: 'mchuzi',
    terms: ['stew', 'curry', 'gravy', 'mchuzi', 'rojo'],
  },
  {
    canonicalEn: 'soup',
    canonicalSw: 'supu',
    terms: ['soup', 'broth', 'supu', 'supu ya kuku', 'supu ya kongoro', 'supu ya mbuzi'],
  },
  {
    canonicalEn: 'boiled',
    canonicalSw: 'mchemsho',
    terms: ['boiled', 'simmered', 'mchemsho', 'mchemsho wa kuku', 'mchemsho wa samaki'],
  },
  {
    canonicalEn: 'biryani',
    canonicalSw: 'biriani',
    terms: ['biryani', 'biriani', 'dum biryani', 'zanzibar biryani'],
  },
  {
    canonicalEn: 'pilau',
    canonicalSw: 'pilau',
    terms: ['pilau', 'spiced rice', 'zanzibar pilau', 'pilau ya nyama', 'pilau kuku'],
  },
  {
    canonicalEn: 'vegetable',
    canonicalSw: 'mbogamboga',
    terms: ['vegetables', 'veg', 'vegetarian', 'greens', 'mboga', 'mbogamboga', 'sukuma', 'mchicha'],
  },
  {
    canonicalEn: 'banana',
    canonicalSw: 'ndizi',
    terms: ['banana', 'plantain', 'ndizi', 'ndizi machoma', 'ndizi nyama', 'matoke'],
  },
  {
    canonicalEn: 'bread',
    canonicalSw: 'chapati',
    terms: ['bread', 'flatbread', 'chapati', 'naan', 'mkate', 'maandazi', 'vitumbua'],
  },
  {
    canonicalEn: 'meat',
    canonicalSw: 'nyama',
    terms: ['meat', 'nyama', 'nyama choma', 'mishkaki'],
  },
];

/**
 * Expands a customer search query by identifying food keywords
 * and appending bilingual synonyms.
 *
 * Example:
 *   "chicken biryani" -> ["chicken biryani", "kuku", "biriani"]
 */
export function expandSearchTerms(rawQuery: string): string[] {
  if (!rawQuery || typeof rawQuery !== 'string') return [];

  const normalized = rawQuery.trim().toLowerCase();
  if (!normalized) return [];

  const termsSet = new Set<string>();
  termsSet.add(normalized);

  const words = normalized.split(/\s+/).filter((w) => w.length > 2);

  for (const group of FOOD_SYNONYMS) {
    const matchesGroup = group.terms.some(
      (term) => normalized.includes(term) || words.some((w) => term.includes(w) || w.includes(term))
    );

    if (matchesGroup) {
      termsSet.add(group.canonicalEn);
      termsSet.add(group.canonicalSw);
      // Add first 3 synonymous variations
      group.terms.slice(0, 3).forEach((t) => termsSet.add(t));
    }
  }

  return Array.from(termsSet);
}

/**
 * Returns the Swahili equivalent of a term if known.
 */
export function getSwahiliEquivalent(term: string): string | undefined {
  const norm = term.trim().toLowerCase();
  const group = FOOD_SYNONYMS.find((g) => g.terms.includes(norm) || g.canonicalEn === norm);
  return group?.canonicalSw;
}

/**
 * Returns the English equivalent of a term if known.
 */
export function getEnglishEquivalent(term: string): string | undefined {
  const norm = term.trim().toLowerCase();
  const group = FOOD_SYNONYMS.find((g) => g.terms.includes(norm) || g.canonicalSw === norm);
  return group?.canonicalEn;
}
