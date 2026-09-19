import { MenuRepository } from '../repositories';
import { MenuCategory, MenuItem } from '../types/domain';

export class MenuService {
  public static async getMenuWithCategories(restaurantId: string): Promise<{
    categories: MenuCategory[];
    items: MenuItem[];
    grouped: { category: MenuCategory; items: MenuItem[] }[];
  }> {
    const [categories, items] = await Promise.all([
      MenuRepository.listCategories(restaurantId),
      MenuRepository.listItems(restaurantId),
    ]);

    const grouped = categories.map((cat) => ({
      category: cat,
      items: items.filter((item) => item.categoryId === cat.id),
    }));

    // Group any unassigned items
    const uncategorized = items.filter((item) => !item.categoryId);
    if (uncategorized.length > 0) {
      grouped.push({
        category: {
          id: 'cat-uncategorized',
          restaurantId,
          nameEn: 'Other Specials',
          nameSw: 'Vyakula Vingine',
          displayOrder: 99,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        items: uncategorized,
      });
    }

    return { categories, items, grouped };
  }

  public static async toggleAvailability(itemId: string, isAvailable: boolean): Promise<MenuItem> {
    return await MenuRepository.setAvailability(itemId, isAvailable);
  }

  public static async updatePriceAndVerify(
    itemId: string,
    newPriceTzs: number,
    verifiedByUserId: string
  ): Promise<MenuItem> {
    return await MenuRepository.verifyPrice(itemId, newPriceTzs, verifiedByUserId);
  }
}
