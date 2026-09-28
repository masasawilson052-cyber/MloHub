import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MenuCategory, MenuItem, BranchMenuItem, ItemStockStatus, MenuModifierGroup, MenuModifierOption } from '../types/domain';

export class MenuRepository {
  private static mapRowToCategory(row: any): MenuCategory {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      nameEn: row.name_en,
      nameSw: row.name_sw,
      description: row.description,
      displayOrder: row.display_order || 1,
      isActive: row.is_active ?? true,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at,
    };
  }

  private static mapRowToItem(row: any): MenuItem {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      categoryId: row.category_id,
      name: row.name_en || row.name_sw || '',
      nameEn: row.name_en,
      nameSw: row.name_sw,
      description: row.description_en || row.description_sw,
      descriptionEn: row.description_en,
      descriptionSw: row.description_sw,
      basePrice: row.price_tzs || 0,
      priceTzs: row.price_tzs || 0,
      currency: 'TZS',
      photoUrl: row.photo_url,
      imageUrl: row.photo_url,
      stockQuantity: row.stock_quantity ?? 50,
      isAvailable: row.is_available ?? true,
      isArchived: row.is_archived ?? false,
      preparationMinutes: row.estimated_prep_time_minutes || 20,
      dietaryTags: row.dietary_tags || [],
      spiceLevel: row.spice_level || 'Mild',
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  public static async listCategories(restaurantId: string): Promise<MenuCategory[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error(`MenuRepository.listCategories(${restaurantId}) error:`, error.message);
      throw new Error(`Failed to load menu categories: ${error.message}`);
    }

    return (data || []).map(this.mapRowToCategory);
  }

  public static async createCategory(category: Partial<MenuCategory>): Promise<MenuCategory> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    if (!category.restaurantId) {
      throw new Error('restaurantId is required to create a menu category.');
    }
    const nameEn = (category.nameEn || '').trim();
    const nameSw = (category.nameSw || category.nameEn || '').trim();
    if (!nameEn && !nameSw) {
      throw new Error('Category name is required.');
    }

    const row = {
      id: category.id || `cat_${Date.now()}`,
      restaurant_id: category.restaurantId,
      name_en: nameEn || nameSw,
      name_sw: nameSw || nameEn,
      display_order: category.displayOrder || 1,
      is_active: category.isActive ?? true,
    };

    const { data, error } = await supabase
      .from('menu_categories')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('MenuRepository.createCategory error:', error.message);
      throw new Error(`Failed to create category: ${error.message}`);
    }

    return this.mapRowToCategory(data);
  }

  public static async archiveCategory(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { error } = await supabase
      .from('menu_categories')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error(`MenuRepository.archiveCategory(${id}) error:`, error.message);
      throw new Error(`Failed to archive category: ${error.message}`);
    }
  }

  public static async listItems(restaurantId: string, categoryId?: string): Promise<MenuItem[]> {
    if (!isSupabaseConfigured()) return [];

    let query = supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_archived', false);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) {
      console.error(`MenuRepository.listItems(${restaurantId}) error:`, error.message);
      throw new Error(`Failed to load menu items: ${error.message}`);
    }

    return (data || []).map(this.mapRowToItem);
  }

  public static async searchItems(
    queryText: string,
    options?: { restaurantId?: string; maxPrice?: number }
  ): Promise<MenuItem[]> {
    if (!isSupabaseConfigured()) return [];

    let query = supabase
      .from('menu_items')
      .select('*')
      .eq('is_archived', false)
      .eq('is_available', true);

    if (options?.restaurantId) {
      query = query.eq('restaurant_id', options.restaurantId);
    }
    if (options?.maxPrice) {
      query = query.lte('price_tzs', options.maxPrice);
    }

    const q = queryText.trim();
    if (q) {
      query = query.or(`name_en.ilike.%${q}%,name_sw.ilike.%${q}%,description_en.ilike.%${q}%,description_sw.ilike.%${q}%`);
    }

    const { data, error } = await query.order('price_tzs', { ascending: true });
    if (error) {
      console.error('MenuRepository.searchItems error:', error.message);
      throw new Error(`Failed to search menu items: ${error.message}`);
    }

    return (data || []).map(this.mapRowToItem);
  }

  public static async getItemById(id: string): Promise<MenuItem | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`MenuRepository.getItemById(${id}) error:`, error.message);
      throw new Error(`Failed to load menu item: ${error.message}`);
    }

    return data ? this.mapRowToItem(data) : null;
  }

  public static async createItem(item: Partial<MenuItem>): Promise<MenuItem> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const nameEn = (item.nameEn || item.name || '').trim();
    const nameSw = (item.nameSw || item.name || '').trim();
    if (!nameEn && !nameSw) {
      throw new Error('Menu item name is required.');
    }

    const priceTzs = item.priceTzs ?? item.basePrice;
    if (!Number.isSafeInteger(priceTzs) || Number(priceTzs) <= 0) {
      throw new Error('Menu item price is required.');
    }

    const row = {
      id: item.id || `item_${Date.now()}`,
      restaurant_id: item.restaurantId,
      category_id: item.categoryId,
      name_en: nameEn || nameSw,
      name_sw: nameSw || nameEn,
      description_en: item.descriptionEn || item.description,
      description_sw: item.descriptionSw || item.description,
      price_tzs: priceTzs,
      photo_url: item.photoUrl || item.imageUrl,
      stock_quantity: item.stockQuantity ?? 50,
      is_available: item.isAvailable ?? true,
      is_archived: false,
      estimated_prep_time_minutes: item.preparationMinutes || 20,
      dietary_tags: item.dietaryTags || [],
      spice_level: item.spiceLevel || 'Mild',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('menu_items')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('MenuRepository.createItem error:', error.message);
      throw new Error(`Failed to create menu item: ${error.message}`);
    }

    return this.mapRowToItem(data);
  }

  public static async updateItem(id: string, updates: Partial<MenuItem>): Promise<MenuItem> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.nameEn !== undefined || updates.name !== undefined) {
      payload.name_en = updates.nameEn || updates.name;
    }
    if (updates.nameSw !== undefined || updates.name !== undefined) {
      payload.name_sw = updates.nameSw || updates.name;
    }
    if (updates.descriptionEn !== undefined || updates.description !== undefined) {
      payload.description_en = updates.descriptionEn || updates.description;
    }
    if (updates.descriptionSw !== undefined || updates.description !== undefined) {
      payload.description_sw = updates.descriptionSw || updates.description;
    }
    if (updates.priceTzs !== undefined) {
      payload.price_tzs = updates.priceTzs;
    } else if (updates.basePrice !== undefined) {
      payload.price_tzs = updates.basePrice;
    }
    if (payload.price_tzs !== undefined && (!Number.isSafeInteger(payload.price_tzs) || payload.price_tzs <= 0)) {
      throw new Error('Price must be a positive whole number of TZS.');
    }
    if (updates.categoryId !== undefined) {
      payload.category_id = updates.categoryId;
    }
    if (updates.photoUrl !== undefined || updates.imageUrl !== undefined) {
      payload.photo_url = (updates.photoUrl ?? updates.imageUrl) || null;
    }
    if (updates.stockQuantity !== undefined) {
      payload.stock_quantity = updates.stockQuantity;
    }
    if (updates.isAvailable !== undefined) {
      payload.is_available = updates.isAvailable;
    }
    if (updates.isArchived !== undefined) {
      payload.is_archived = updates.isArchived;
    }
    if (updates.preparationMinutes !== undefined) {
      payload.estimated_prep_time_minutes = updates.preparationMinutes;
    }
    if (updates.dietaryTags !== undefined) {
      payload.dietary_tags = updates.dietaryTags;
    }
    if (updates.spiceLevel !== undefined) {
      payload.spice_level = updates.spiceLevel;
    }

    const { data, error } = await supabase
      .from('menu_items')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`MenuRepository.updateItem(${id}) error:`, error.message);
      throw new Error(`Failed to update menu item: ${error.message}`);
    }

    return this.mapRowToItem(data);
  }

  public static async archiveItem(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { error } = await supabase
      .from('menu_items')
      .update({
        is_archived: true,
        is_available: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error(`MenuRepository.archiveItem(${id}) error:`, error.message);
      throw new Error(`Failed to archive menu item: ${error.message}`);
    }
  }

  public static async setAvailability(id: string, isAvailable: boolean): Promise<MenuItem> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase
      .from('menu_items')
      .update({
        is_available: isAvailable,
        last_availability_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`MenuRepository.setAvailability(${id}) error:`, error.message);
      throw new Error(`Failed to update availability: ${error.message}`);
    }

    return this.mapRowToItem(data);
  }

  public static async bulkSetAvailability(ids: string[], isAvailable: boolean): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }
    if (!ids || ids.length === 0) return;

    const { error } = await supabase
      .from('menu_items')
      .update({
        is_available: isAvailable,
        last_availability_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', ids);

    if (error) {
      console.error(`MenuRepository.bulkSetAvailability error:`, error.message);
      throw new Error(`Failed to update items availability: ${error.message}`);
    }
  }

  public static async setBranchPrice(branchId: string, menuItemId: string, priceTzs: number): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { error } = await supabase
      .from('branch_menu_items')
      .upsert(
        {
          branch_id: branchId,
          menu_item_id: menuItemId,
          price_tzs: priceTzs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'branch_id,menu_item_id' }
      );

    if (error) {
      console.error(`MenuRepository.setBranchPrice error:`, error.message);
      throw new Error(`Failed to set branch price: ${error.message}`);
    }
  }

  public static async listBranchPrices(branchId: string): Promise<{ branchId: string; menuItemId: string; priceTzs: number }[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('branch_menu_items')
      .select('branch_id, menu_item_id, price_tzs')
      .eq('branch_id', branchId);

    if (error) {
      console.error(`MenuRepository.listBranchPrices error:`, error.message);
      throw new Error(`Failed to list branch prices: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      branchId: row.branch_id,
      menuItemId: row.menu_item_id,
      priceTzs: row.price_tzs,
    }));
  }

  public static async verifyPrice(id: string, newPriceTzs: number, verifiedBy: string): Promise<MenuItem> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    // 1. Fetch current price to log audit
    const current = await this.getItemById(id);

    // 2. Update price in menu_items
    const { data, error } = await supabase
      .from('menu_items')
      .update({
        price_tzs: newPriceTzs,
        last_price_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`MenuRepository.verifyPrice(${id}) error:`, error.message);
      throw new Error(`Failed to verify and update price: ${error.message}`);
    }

    // 3. Log into menu_verifications
    if (current) {
      await supabase.from('menu_verifications').insert({
        restaurant_id: current.restaurantId,
        menu_item_id: id,
        verification_type: 'PRICE',
        verified_by: verifiedBy,
        verification_source: 'RESTAURANT',
        previous_value: { price_tzs: current.priceTzs },
        verified_value: { price_tzs: newPriceTzs },
      });
    }

    return this.mapRowToItem(data);
  }

  /**
   * Sets operational availability for a specific item at a specific branch via secure RPC.
   */
  public static async setItemOperationalAvailability(
    branchId: string,
    menuItemId: string,
    status: ItemStockStatus,
    unavailableUntil?: string | null,
    reason?: string | null
  ): Promise<{ success: boolean; operationalStatus: ItemStockStatus; isAvailable: boolean }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('set_item_operational_availability_secure', {
      p_branch_id: branchId,
      p_menu_item_id: menuItemId,
      p_status: status,
      p_unavailable_until: unavailableUntil || null,
      p_reason: reason || null,
    });

    if (error) {
      console.error(`MenuRepository.setItemOperationalAvailability error:`, error.message);
      throw new Error(`Failed to update item availability: ${error.message}`);
    }

    return {
      success: data?.success ?? true,
      operationalStatus: data?.operational_status ?? status,
      isAvailable: data?.is_available ?? (status === 'IN_STOCK'),
    };
  }

  /**
   * Bulk updates operational availability for multiple items at a branch.
   */
  public static async bulkSetItemsOperationalAvailability(
    branchId: string,
    menuItemIds: string[],
    status: ItemStockStatus,
    unavailableUntil?: string | null,
    reason?: string | null
  ): Promise<{ success: boolean; updatedCount: number }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('bulk_set_items_availability_secure', {
      p_branch_id: branchId,
      p_menu_item_ids: menuItemIds,
      p_status: status,
      p_unavailable_until: unavailableUntil || null,
      p_reason: reason || null,
    });

    if (error) {
      console.error(`MenuRepository.bulkSetItemsOperationalAvailability error:`, error.message);
      throw new Error(`Failed to bulk update items availability: ${error.message}`);
    }

    return {
      success: data?.success ?? true,
      updatedCount: data?.updated_count ?? menuItemIds.length,
    };
  }

  /**
   * Retrieves branch-specific menu item overrides including operational stock status and dayparts.
   */
  public static async getBranchMenuItems(branchId: string): Promise<BranchMenuItem[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('branch_menu_items')
      .select('*')
      .eq('branch_id', branchId);

    if (error) {
      console.error(`MenuRepository.getBranchMenuItems(${branchId}) error:`, error.message);
      throw new Error(`Failed to load branch menu items: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      branchId: row.branch_id,
      menuItemId: row.menu_item_id,
      price: row.price_tzs || 0,
      isAvailable: row.is_available ?? true,
      stockStatus: row.stock_status || (row.is_available ? 'IN_STOCK' : 'OUT_OF_STOCK'),
      operationalStatus: row.operational_status,
      unavailableUntil: row.unavailable_until,
      unavailableReason: row.unavailable_reason,
      prepTimeMinutes: row.prep_time_minutes,
      daypartStart: row.daypart_start,
      daypartEnd: row.daypart_end,
      lastPriceVerifiedAt: row.last_price_verified_at,
      lastAvailabilityVerifiedAt: row.last_availability_verified_at,
      updatedAt: row.updated_at,
    }));
  }

  private static fallbackModifiers: Map<string, MenuModifierGroup[]> = new Map();

  /**
   * Retrieves modifier groups and options for a specific menu item.
   */
  public static async getModifiersForItem(menuItemId: string): Promise<MenuModifierGroup[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackModifiers.get(menuItemId) || [];
    }

    let groups: any = null;
    try {
      const res = await supabase
        .from('menu_modifier_groups')
        .select('*')
        .eq('menu_item_id', menuItemId)
        .order('sort_order', { ascending: true });
      if (res.error) {
        if (this.fallbackModifiers.has(menuItemId)) {
          return this.fallbackModifiers.get(menuItemId) || [];
        }
        console.error(`MenuRepository.getModifiersForItem(${menuItemId}) groups error:`, res.error.message);
        throw new Error(`MODIFIER_LOOKUP_FAILED: ${res.error.message}`);
      }
      groups = res.data;
    } catch (e: any) {
      if (this.fallbackModifiers.has(menuItemId)) {
        return this.fallbackModifiers.get(menuItemId) || [];
      }
      throw e;
    }

    if (!groups || groups.length === 0) return [];

    const groupIds = groups.map((g: any) => g.id);
    const { data: options, error: optionsError } = await supabase
      .from('menu_modifier_options')
      .select('*')
      .in('group_id', groupIds)
      .order('sort_order', { ascending: true });

    if (optionsError) {
      console.error(`MenuRepository.getModifiersForItem(${menuItemId}) options error:`, optionsError.message);
      throw new Error(`MODIFIER_LOOKUP_FAILED: ${optionsError.message}`);
    }

    const optionsByGroup: Record<string, MenuModifierOption[]> = {};
    (options || []).forEach((opt: any) => {
      if (!optionsByGroup[opt.group_id]) {
        optionsByGroup[opt.group_id] = [];
      }
      optionsByGroup[opt.group_id].push({
        id: opt.id,
        groupId: opt.group_id,
        name: opt.name,
        priceDeltaTzs: Number(opt.price_delta_tzs || 0),
        isAvailable: Boolean(opt.is_available),
        sortOrder: Number(opt.sort_order || 0),
        createdAt: opt.created_at,
      });
    });

    return groups.map((g: any) => ({
      id: g.id,
      menuItemId: g.menu_item_id,
      name: g.name,
      minSelections: Number(g.min_selections || 0),
      maxSelections: Number(g.max_selections || 1),
      minSelect: Number(g.min_selections || 0),
      maxSelect: Number(g.max_selections || 1),
      isRequired: Boolean(g.is_required),
      sortOrder: Number(g.sort_order || 0),
      options: optionsByGroup[g.id] || [],
      createdAt: g.created_at,
    }));
  }

  /**
   * Validates modifier groups and options schema before persisting.
   */
  public static validateModifierGroups(groups: Array<Partial<MenuModifierGroup>>): void {
    if (!Array.isArray(groups)) {
      throw new Error('Modifier groups must be an array.');
    }
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const groupName = (g.name || '').trim();
      if (!groupName) {
        throw new Error(`Modifier group #${i + 1} must have a name.`);
      }

      const isRequired = Boolean(g.isRequired);
      const minSelections = Number(g.minSelections ?? g.minSelect ?? (isRequired ? 1 : 0));
      const maxSelections = Number(g.maxSelections ?? g.maxSelect ?? Math.max(1, minSelections));

      if (isRequired && minSelections < 1) {
        throw new Error(`Required modifier group "${groupName}" must require at least 1 selection.`);
      }
      if (maxSelections < minSelections) {
        throw new Error(`Modifier group "${groupName}" cannot have max selections (${maxSelections}) less than min selections (${minSelections}).`);
      }
      if (minSelections < 0) {
        throw new Error(`Modifier group "${groupName}" cannot have negative min selections.`);
      }

      const options = g.options || [];
      if (!Array.isArray(options)) {
        throw new Error(`Modifier group "${groupName}" options must be an array.`);
      }

      if (options.length < minSelections) {
        throw new Error(`Modifier group "${groupName}" requires at least ${minSelections} option(s), but only ${options.length} provided.`);
      }

      const seenNames = new Set<string>();
      for (let j = 0; j < options.length; j++) {
        const opt = options[j];
        const optName = (opt.name || '').trim();
        if (!optName) {
          throw new Error(`Option #${j + 1} in group "${groupName}" must have a name.`);
        }
        const lowerName = optName.toLowerCase();
        if (seenNames.has(lowerName)) {
          throw new Error(`Duplicate option name "${optName}" in group "${groupName}".`);
        }
        seenNames.add(lowerName);

        const delta = Number(opt.priceDeltaTzs ?? 0);
        if (isNaN(delta) || delta < 0) {
          throw new Error(`Option "${optName}" in group "${groupName}" cannot have negative price delta.`);
        }
      }
    }
  }

  /**
   * Persists modifier groups and options atomically for a menu item.
   */
  public static async replaceModifiersForItem(
    menuItemId: string,
    groups: Array<Partial<MenuModifierGroup>>
  ): Promise<MenuModifierGroup[]> {
    if (!menuItemId || typeof menuItemId !== 'string') {
      throw new Error('Valid menuItemId is required.');
    }

    this.validateModifierGroups(groups);

    const sanitizedPayload = groups.map((g, gIdx) => {
      const isRequired = Boolean(g.isRequired);
      const minSelections = Number(g.minSelections ?? g.minSelect ?? (isRequired ? 1 : 0));
      const maxSelections = Number(g.maxSelections ?? g.maxSelect ?? Math.max(1, minSelections));

      return {
        id: g.id || undefined,
        name: (g.name || '').trim(),
        minSelections,
        maxSelections,
        min_selections: minSelections,
        max_selections: maxSelections,
        isRequired,
        is_required: isRequired,
        sortOrder: Number(g.sortOrder ?? gIdx),
        sort_order: Number(g.sortOrder ?? gIdx),
        options: (g.options || []).map((o, oIdx) => ({
          id: o.id || undefined,
          name: (o.name || '').trim(),
          priceDeltaTzs: Number(o.priceDeltaTzs ?? 0),
          price_delta_tzs: Number(o.priceDeltaTzs ?? 0),
          isAvailable: o.isAvailable ?? true,
          is_available: o.isAvailable ?? true,
          sortOrder: Number(o.sortOrder ?? oIdx),
          sort_order: Number(o.sortOrder ?? oIdx),
        })),
      };
    });

    const fallbackList: MenuModifierGroup[] = sanitizedPayload.map((g, idx) => ({
      id: g.id || `mod_grp_${menuItemId}_${idx}_${Date.now()}`,
      menuItemId,
      name: g.name,
      minSelections: g.minSelections,
      maxSelections: g.maxSelections,
      minSelect: g.minSelections,
      maxSelect: g.maxSelections,
      isRequired: g.isRequired,
      sortOrder: g.sortOrder,
      options: g.options.map((o, oIdx) => ({
        id: o.id || `mod_opt_${idx}_${oIdx}_${Date.now()}`,
        groupId: g.id || `mod_grp_${menuItemId}_${idx}`,
        name: o.name,
        priceDeltaTzs: o.priceDeltaTzs,
        isAvailable: o.isAvailable,
        sortOrder: o.sortOrder,
        createdAt: new Date().toISOString(),
      })),
      createdAt: new Date().toISOString(),
    }));
    this.fallbackModifiers.set(menuItemId, fallbackList);

    if (!isSupabaseConfigured()) {
      return fallbackList;
    }

    try {
      const { error } = await supabase.rpc('replace_menu_item_modifiers_secure', {
        p_menu_item_id: menuItemId,
        p_groups: sanitizedPayload,
      });

      if (error) {
        if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
          return fallbackList;
        }
        console.error(`MenuRepository.replaceModifiersForItem(${menuItemId}) RPC error:`, error.message);
        throw new Error(`MODIFIER_SAVE_FAILED: ${error.message}`);
      }

      return this.getModifiersForItem(menuItemId);
    } catch (networkErr: any) {
      if (networkErr.message?.includes('fetch failed') || networkErr.message?.includes('ECONNREFUSED')) {
        return fallbackList;
      }
      throw networkErr;
    }
  }
}


