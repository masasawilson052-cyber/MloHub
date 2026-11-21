/**
 * ============================================================================
 * MLOHUB RESTAURANT MENU SCROLL & JUMP MATHEMATICS
 * ============================================================================
 * Pure functions calculating:
 * 1. jumpTargetY: Exact vertical scroll offset so the section heading lands
 *    directly beneath the pinned category tab bar.
 * 2. activeCategoryAt: Scroll-spy determination of the active menu category
 *    based on current vertical scroll position.
 * 3. tabPillScrollX: Horizontal scroll offset for the category tabs bar to ensure
 *    the active pill remains visible in the horizontal viewport.
 * ============================================================================
 */

export interface JumpTargetParams {
  category: string;
  menuContainerY: number;
  categoryRelativeOffsets: Record<string, number>;
  tabBarHeight: number;
  minScrollY?: number;
}

export interface ActiveCategoryParams {
  scrollY: number;
  menuContainerY: number;
  categoryRelativeOffsets: Record<string, number>;
  categories: string[];
  tabBarHeight: number;
  threshold?: number;
}

export interface TabPillScrollParams {
  activeCategory: string;
  tabPillOffsets: Record<string, { x: number; width: number }>;
  paddingLeft?: number;
}

/**
 * Calculates the exact vertical scroll coordinate to jump to a menu category.
 * When scrolled to targetY, the category heading sits precisely below the sticky tab bar.
 */
export function jumpTargetY(params: JumpTargetParams): number {
  const {
    category,
    menuContainerY,
    categoryRelativeOffsets,
    tabBarHeight,
    minScrollY = 0,
  } = params;

  if (category === 'All') {
    return Math.max(minScrollY, Math.round(menuContainerY - tabBarHeight));
  }

  const relativeY = categoryRelativeOffsets[category] ?? 0;
  const absoluteSectionY = menuContainerY + relativeY;

  return Math.max(minScrollY, Math.round(absoluteSectionY - tabBarHeight));
}

/**
 * Determines the currently active category for scroll spy.
 * Returns 'All' if scroll position is above the menu container, or the name of
 * the category section currently in view directly below the sticky tab bar.
 */
export function activeCategoryAt(params: ActiveCategoryParams): string {
  const {
    scrollY,
    menuContainerY,
    categoryRelativeOffsets,
    categories,
    tabBarHeight,
    threshold = 20,
  } = params;

  // Above the menu sections
  if (scrollY < menuContainerY - tabBarHeight) {
    return 'All';
  }

  const effectiveY = scrollY + tabBarHeight + threshold;

  // Filter actual categories (excluding 'All') that have recorded offsets
  const actualCategories = categories.filter((c) => c !== 'All');

  let currentActive = 'All';
  let highestMatchingY = -1;

  for (const cat of actualCategories) {
    const relY = categoryRelativeOffsets[cat];
    if (relY != null) {
      const absY = menuContainerY + relY;
      if (absY <= effectiveY && absY > highestMatchingY) {
        highestMatchingY = absY;
        currentActive = cat;
      }
    }
  }

  return currentActive;
}

/**
 * Calculates the horizontal scroll position for the tab bar so the active pill is visible.
 */
export function tabPillScrollX(params: TabPillScrollParams): number {
  const { activeCategory, tabPillOffsets, paddingLeft = 32 } = params;
  const pill = tabPillOffsets[activeCategory];
  if (!pill) return 0;

  return Math.max(0, Math.round(pill.x - paddingLeft));
}
