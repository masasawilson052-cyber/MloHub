import { useState, useMemo, useEffect } from 'react';
import { Restaurant } from '../../types/domain';
import { MenuRepository } from '../../repositories';
import { BranchRepository } from '../../repositories/branches.repository';
import { RestaurantRepository } from '../../repositories/restaurants.repository';
import { BranchOperationsRepository } from '../../repositories/branchOperations.repository';
import { TrustService } from '../../services/TrustService';
import { MenuItem, CategoryItem } from './MenuSection';

function parsePriceTzs(priceStr: string | number): number {
  if (typeof priceStr === 'number') return priceStr;
  const cleaned = String(priceStr).replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 10000;
}

export function useRestaurantPageData(
  id: string | undefined,
  restaurants: any[],
  loading: boolean,
  language: string
) {
  // 1. Matched or direct fetched restaurant
  const matched = restaurants.find((r) => r.id === id);
  const [directRestaurant, setDirectRestaurant] = useState<Restaurant | null>(null);
  const [isDirectLoading, setIsDirectLoading] = useState(false);

  const fetchDirectRestaurant = () => {
    if (!id) return;
    setIsDirectLoading(true);
    RestaurantRepository.getById(id)
      .then((fetched) => {
        setDirectRestaurant(fetched);
        setIsDirectLoading(false);
      })
      .catch((err) => {
        console.warn('useRestaurantPageData: direct fetch failed:', err);
        setIsDirectLoading(false);
      });
  };

  useEffect(() => {
    if (!loading && !matched && id) {
      fetchDirectRestaurant();
    } else if (matched) {
      setDirectRestaurant(null);
      setIsDirectLoading(false);
    }
  }, [loading, matched, id]);

  const candidateRestaurant = matched || directRestaurant;
  const isAvailableForCustomers =
    candidateRestaurant &&
    !candidateRestaurant.isSuspended &&
    candidateRestaurant.verificationStatus !== 'SUSPENDED' &&
    candidateRestaurant.verificationStatus !== 'REJECTED' &&
    candidateRestaurant.verificationStatus !== 'PENDING_VERIFICATION' &&
    (candidateRestaurant as any).isVerified !== false &&
    candidateRestaurant.isActive !== false &&
    candidateRestaurant.isPublished !== false &&
    (candidateRestaurant as any).launchStatus === 'PUBLISHED' &&
    (!matched ||
      (matched.verificationStatus !== 'PENDING_VERIFICATION' &&
        matched.isPublished !== false &&
        (matched as any).launchStatus === 'PUBLISHED'));

  const restaurant: any = isAvailableForCustomers ? candidateRestaurant : undefined;

  // 2. Branches, operating hours & delivery zones
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<any | null>(null);
  const [operatingHours, setOperatingHours] = useState<any[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      BranchRepository.listByRestaurant(id)
        .then((bList) => {
          const activeBranches = bList.filter((b: any) => b.isActive !== false);
          const resolvedList = activeBranches.length > 0 ? activeBranches : bList;
          setBranches(resolvedList);
          if (resolvedList.length > 0) {
            setSelectedBranch(resolvedList[0]);
          }
        })
        .catch((err) => console.warn('useRestaurantPageData: branch list failed:', err));
    }
  }, [id]);

  useEffect(() => {
    const branchId = selectedBranch?.id || branches[0]?.id;
    if (branchId) {
      Promise.all([
        BranchOperationsRepository.getOperatingHours(branchId).catch(() => []),
        BranchOperationsRepository.getDeliveryZones(branchId).catch(() => []),
      ]).then(([hours, zones]) => {
        setOperatingHours(hours || []);
        setDeliveryZones(zones || []);
      });
    }
  }, [selectedBranch?.id, branches]);

  // 3. Menu items, categories, prices & overrides
  const [dbMenuItems, setDbMenuItems] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<CategoryItem[]>([]);
  const [branchPrices, setBranchPrices] = useState<any[]>([]);
  const [branchItemStates, setBranchItemStates] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      Promise.all([
        MenuRepository.listItems(id),
        MenuRepository.listCategories(id).catch(() => []),
      ]).then(([mItems, mCats]: [any, any]) => {
        setDbMenuItems(mItems || []);
        setDbCategories(mCats || []);
      });
    }
  }, [id]);

  useEffect(() => {
    const branchId = selectedBranch?.id || branches[0]?.id;
    if (branchId) {
      Promise.all([
        MenuRepository.listBranchPrices(branchId).catch(() => []),
        MenuRepository.getBranchMenuItems(branchId).catch(() => []),
      ]).then(([prices, itemStates]) => {
        setBranchPrices(prices || []);
        setBranchItemStates(itemStates || []);
      });
    }
  }, [selectedBranch?.id, branches]);

  // 4. Resolved Menu items
  const menuItems: MenuItem[] = useMemo(() => {
    if (dbMenuItems && dbMenuItems.length > 0) {
      const catMap = new Map<string, string>();
      for (const c of dbCategories) {
        catMap.set(c.id, language === 'sw' && c.nameSw ? c.nameSw : c.nameEn || c.name);
      }
      return dbMenuItems
        .filter((item) => {
          const bs = branchItemStates.find((s: any) => s.menuItemId === item.id);
          return bs?.operationalStatus !== 'HIDDEN';
        })
        .map((item) => {
          const bp = branchPrices.find((p: any) => p.menuItemId === item.id);
          const bs = branchItemStates.find((s: any) => s.menuItemId === item.id);
          const effectivePrice =
            bp?.priceTzs && bp.priceTzs > 0
              ? bp.priceTzs
              : bs?.priceOverrideTzs && bs.priceOverrideTzs > 0
              ? bs.priceOverrideTzs
              : item.basePrice;
          const isBranchAvail =
            (bp ? bp.isAvailable !== false : true) &&
            (bs
              ? bs.isAvailable !== false && bs.operationalStatus !== 'SOLD_OUT_TODAY'
              : true);
          const isAvailable = item.isAvailable !== false && isBranchAvail;
          const resolvedCat =
            (item.categoryId && catMap.get(item.categoryId)) ||
            item.categoryName ||
            item.category ||
            (language === 'sw' ? 'Vyakula' : 'Dishes');

          return {
            id: item.id,
            name: language === 'sw' && item.nameSw ? item.nameSw : item.nameEn || item.name,
            nameSw: item.nameSw,
            desc: language === 'sw' && item.descriptionSw ? item.descriptionSw : item.description || '',
            price: `TZS ${effectivePrice.toLocaleString()}`,
            priceNum: effectivePrice,
            popular: (item as any).isPopular ?? (item as any).popular ?? false,
            category: resolvedCat,
            categoryId: item.categoryId,
            imageUrl: item.imageUrl,
            photoUrl: item.imageUrl,
            isAvailable,
          };
        });
    }
    return ((restaurant?.menu as any[]) || []).map((m) => ({
      ...m,
      priceNum: parsePriceTzs(m.price),
      isAvailable: m.isAvailable !== false,
      category: m.category || (language === 'sw' ? 'Vyakula' : 'Dishes'),
    }));
  }, [dbMenuItems, dbCategories, branchPrices, branchItemStates, restaurant?.menu, language]);

  // 5. Unique Category tabs
  const categories = useMemo(() => {
    const cats = ['All'];
    menuItems.forEach((m) => {
      const cat = m.category || (language === 'sw' ? 'Vyakula' : 'Dishes');
      if (!cats.includes(cat)) cats.push(cat);
    });
    return cats;
  }, [menuItems, language]);

  const supportsReservations = useMemo(() => {
    return (
      (restaurant as any)?.reservationsEnabled === true ||
      (restaurant as any)?.reservations_enabled === true ||
      branches.some((b) => b.reservationsEnabled === true || b.reservations_enabled === true)
    );
  }, [restaurant, branches]);

  const restaurantAssessment = useMemo(() => {
    return TrustService.computeRestaurantTrust({
      restaurantId: restaurant?.id || '',
      restaurantName: restaurant?.name || '',
      isVerified: (restaurant as any)?.isVerified ?? false,
      verificationStatus: (restaurant as any)?.verificationStatus ?? 'PENDING_VERIFICATION',
      totalOrders: (restaurant as any)?.totalOrders ?? 0,
      completedOrders: (restaurant as any)?.completedOrders ?? 0,
      menuLastVerifiedAt:
        (restaurant as any)?.menuUpdatedAt || (restaurant as any)?.menuLastVerifiedAt || undefined,
    });
  }, [restaurant]);

  const isPageLoading = loading || (Boolean(id) && !matched && isDirectLoading);

  return {
    restaurant,
    branches,
    selectedBranch,
    operatingHours,
    deliveryZones,
    dbCategories,
    menuItems,
    categories,
    supportsReservations,
    restaurantAssessment,
    isPageLoading,
    fetchDirectRestaurant,
  };
}
