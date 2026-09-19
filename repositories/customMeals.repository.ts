import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  CustomMealRequest,
  RestaurantQuote,
  RestaurantQuoteItem,
  CustomMealInvitation,
  CustomMealMessage,
  DeclineReason,
  CustomMealFulfillmentMode,
} from '../types/domain';

export interface StructuredQuoteInput {
  requestId: string;
  restaurantId: string;
  branchId?: string;
  items: {
    name: string;
    description?: string;
    quantity: number;
    unitPriceTzs: number;
  }[];
  deliveryFeeTzs?: number;
  estimatedPrepMinutes: number;
  promisedReadyAt: string;
  fulfillmentMode: CustomMealFulfillmentMode;
  restaurantNote?: string;
  substitutionNotes?: string;
  dietaryAcknowledged: boolean;
  allergyAcknowledged: boolean;
  validUntil: string;
}

export class CustomMealRepository {
  private static mapRowToRequest(row: any, quotes?: RestaurantQuote[]): CustomMealRequest {
    return {
      id: row.id,
      orderNumber: row.order_number,
      customerId: row.user_id,
      title: row.title || row.dish_name,
      dishName: row.dish_name || row.title,
      description: row.special_instructions,
      specialInstructions: row.special_instructions,
      occasion: row.occasion,
      cuisineType: row.cuisine_type,
      budgetType: row.budget_type,
      budgetMinTzs: row.budget_min_tzs,
      budgetMaxTzs: row.budget_max_tzs,
      budgetTzs: row.budget_tzs || row.budget_min_tzs || 0,
      servings: row.servings_count || '1',
      servingsCount: row.servings_count || '1',
      spiceLevel: row.spice_level,
      ingredientsRequested: row.ingredients_requested || [],
      ingredientsToAvoid: row.ingredients_to_avoid || [],
      dietaryTags: row.dietary_tags || [],
      allergens: row.allergens || [],
      desiredAt: row.desired_at,
      quoteDeadline: row.quote_deadline,
      expiresAt: row.expires_at,
      fulfillmentMode: row.fulfillment_mode || 'RESTAURANT_DELIVERY',
      diningOption: row.dining_option || 'Delivery',
      customerArea: row.customer_area,
      landmark: row.landmark,
      exactDeliveryAddress: row.exact_delivery_address,
      exactDeliveryPhone: row.exact_delivery_phone,
      location: row.customer_area || row.delivery_location,
      deliveryLocation: row.delivery_location || row.customer_area,
      referenceImages: row.reference_images || [],
      status: row.status || 'PENDING',
      statusMessageEn: row.status_message_en,
      statusMessageSw: row.status_message_sw,
      acceptedQuoteId: row.accepted_quote_id,
      lockedQuoteSnapshot: row.locked_quote_snapshot,
      convertedOrderId: row.converted_order_id,
      quotes: quotes || (row.restaurant_quotes || []).map(this.mapRowToQuote),
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  private static mapRowToQuote(row: any): RestaurantQuote {
    return {
      id: row.id,
      requestId: row.request_id,
      restaurantId: row.restaurant_id,
      restaurantName: row.restaurants?.name,
      branchId: row.branch_id,
      submittedByUserId: row.submitted_by_user_id,
      subtotalTzs: row.subtotal_tzs || row.quoted_price_tzs || 0,
      deliveryFeeTzs: row.delivery_fee_tzs || 0,
      otherAuthorizedFeeTzs: row.other_authorized_fee_tzs || 0,
      totalTzs: row.total_tzs || row.quoted_price_tzs || 0,
      amountTzs: row.total_tzs || row.quoted_price_tzs || 0,
      quotedPriceTzs: row.quoted_price_tzs || row.total_tzs || 0,
      estimatedPrepMinutes: row.estimated_prep_minutes || 30,
      promisedReadyAt: row.promised_ready_at,
      fulfillmentMode: row.fulfillment_mode,
      message: row.chef_notes || row.restaurant_note,
      chefNotes: row.chef_notes || row.restaurant_note,
      restaurantNote: row.restaurant_note || row.chef_notes,
      substitutionNotes: row.substitution_notes,
      dietaryAcknowledged: row.dietary_acknowledged ?? false,
      allergyAcknowledged: row.allergy_acknowledged ?? false,
      validUntil: row.valid_until,
      revisionNumber: row.revision_number || 1,
      items: (row.restaurant_quote_items || []).map((item: any) => ({
        id: item.id,
        quoteId: item.quote_id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPriceTzs: item.unit_price_tzs,
        lineTotalTzs: item.line_total_tzs,
        sortOrder: item.sort_order,
      })),
      status: row.status || 'SUBMITTED',
      createdAt: row.created_at || new Date().toISOString(),
    };
  }

  public static async createStructuredRequest(params: {
    title: string;
    description: string;
    occasion: string;
    servings: number;
    cuisineType: string;
    budgetType: string;
    budgetMinTzs?: number;
    budgetMaxTzs?: number;
    spiceLevel: string;
    ingredientsRequested?: string[];
    ingredientsToAvoid?: string[];
    dietaryTags?: string[];
    allergens?: string[];
    desiredAt: string;
    quoteDeadline: string;
    fulfillmentMode: CustomMealFulfillmentMode;
    customerArea: string;
    landmark?: string;
    exactDeliveryAddress?: string;
    exactDeliveryPhone?: string;
    referenceImages?: string[];
  }): Promise<any> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('create_structured_custom_meal_request', {
      p_title: params.title,
      p_description: params.description,
      p_occasion: params.occasion,
      p_servings: params.servings,
      p_cuisine_type: params.cuisineType,
      p_budget_type: params.budgetType,
      p_budget_min_tzs: params.budgetMinTzs || 15000,
      p_budget_max_tzs: params.budgetMaxTzs || params.budgetMinTzs || 25000,
      p_spice_level: params.spiceLevel,
      p_ingredients_requested: params.ingredientsRequested || [],
      p_ingredients_to_avoid: params.ingredientsToAvoid || [],
      p_dietary_tags: params.dietaryTags || [],
      p_allergens: params.allergens || [],
      p_desired_at: params.desiredAt,
      p_quote_deadline: params.quoteDeadline,
      p_fulfillment_mode: params.fulfillmentMode,
      p_customer_area: params.customerArea,
      p_landmark: params.landmark || null,
      p_exact_delivery_address: params.exactDeliveryAddress || null,
      p_exact_delivery_phone: params.exactDeliveryPhone || null,
      p_reference_images: params.referenceImages || [],
    });

    if (error) {
      console.error('CustomMealRepository.createStructuredRequest error:', error.message);
      throw new Error(`Failed to create structured custom meal request: ${error.message}`);
    }

    return data;
  }

  public static async listRequestsForCustomer(customerId: string): Promise<CustomMealRequest[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('custom_meal_requests')
      .select('*, restaurant_quotes(*, restaurant_quote_items(*), restaurants(name))')
      .eq('user_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`CustomMealRepository.listRequestsForCustomer error:`, error.message);
      throw new Error(`Failed to list customer requests: ${error.message}`);
    }

    return (data || []).map((r) =>
      this.mapRowToRequest(r, (r.restaurant_quotes || []).map(this.mapRowToQuote))
    );
  }

  public static async getRequestById(id: string): Promise<CustomMealRequest | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('custom_meal_requests')
      .select('*, restaurant_quotes(*, restaurant_quote_items(*), restaurants(name))')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`CustomMealRepository.getRequestById(${id}) error:`, error.message);
      throw new Error(`Failed to fetch custom meal request: ${error.message}`);
    }

    if (!data) return null;
    return this.mapRowToRequest(data, (data.restaurant_quotes || []).map(this.mapRowToQuote));
  }

  public static async listUserRequests(userId: string): Promise<CustomMealRequest[]> {
    return this.listRequestsForCustomer(userId);
  }

  public static async listQuotesForRequest(requestId: string): Promise<RestaurantQuote[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('restaurant_quotes')
      .select('*, restaurant_quote_items(*), restaurants(name, rating, phone)')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`CustomMealRepository.listQuotesForRequest(${requestId}) error:`, error.message);
      return [];
    }

    return (data || []).map((row: any) => this.mapRowToQuote(row));
  }

  public static async listInvitedRequestsForRestaurant(
    restaurantId: string,
    statusFilter?: string
  ): Promise<
    {
      invitation: CustomMealInvitation;
      request: CustomMealRequest;
      myQuote?: RestaurantQuote;
    }[]
  > {
    if (!isSupabaseConfigured()) return [];

    let query = supabase
      .from('custom_meal_invitations')
      .select(`
        *,
        custom_meal_requests(
          id, order_number, user_id, title, dish_name, special_instructions,
          occasion, cuisine_type, budget_type, budget_min_tzs, budget_max_tzs, budget_tzs,
          servings_count, spice_level, ingredients_requested, ingredients_to_avoid,
          dietary_tags, allergens, desired_at, quote_deadline, expires_at,
          fulfillment_mode, dining_option, customer_area, landmark,
          reference_images, status, created_at, updated_at
        )
      `)
      .eq('restaurant_id', restaurantId)
      .order('invited_at', { ascending: false });

    if (statusFilter && statusFilter !== 'ALL') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('CustomMealRepository.listInvitedRequestsForRestaurant error:', error.message);
      throw new Error(`Failed to list invitations: ${error.message}`);
    }

    // Fetch existing quotes submitted by this restaurant
    const requestIds = (data || []).map((inv: any) => inv.request_id);
    const { data: myQuotes } = await supabase
      .from('restaurant_quotes')
      .select('*, restaurant_quote_items(*)')
      .eq('restaurant_id', restaurantId)
      .in('request_id', requestIds);

    const quotesByReq = new Map<string, any>();
    (myQuotes || []).forEach((q: any) => {
      quotesByReq.set(q.request_id, this.mapRowToQuote(q));
    });

    return (data || []).map((inv: any) => ({
      invitation: {
        id: inv.id,
        requestId: inv.request_id,
        restaurantId: inv.restaurant_id,
        branchId: inv.branch_id,
        status: inv.status,
        matchScore: inv.match_score,
        matchReasons: inv.match_reasons || [],
        invitedAt: inv.invited_at,
        viewedAt: inv.viewed_at,
        declinedAt: inv.declined_at,
        declineReason: inv.decline_reason,
        declineNotes: inv.decline_notes,
        quoteDeadline: inv.quote_deadline,
      },
      request: this.mapRowToRequest(inv.custom_meal_requests),
      myQuote: quotesByReq.get(inv.request_id),
    }));
  }

  public static async submitStructuredQuote(params: StructuredQuoteInput): Promise<any> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const normalizedItems = (params.items || []).map((it: any) => ({
      name: it.name,
      description: it.description || null,
      quantity: it.quantity,
      unit_price_tzs: it.unitPriceTzs ?? it.unit_price_tzs ?? 0,
    }));

    const { data, error } = await supabase.rpc('submit_structured_restaurant_quote', {
      p_request_id: params.requestId,
      p_restaurant_id: params.restaurantId,
      p_branch_id: params.branchId || null,
      p_items: normalizedItems,
      p_delivery_fee_tzs: params.deliveryFeeTzs || 0,
      p_estimated_prep_minutes: params.estimatedPrepMinutes,
      p_promised_ready_at: params.promisedReadyAt,
      p_fulfillment_mode: params.fulfillmentMode,
      p_restaurant_note: params.restaurantNote || null,
      p_substitution_notes: params.substitutionNotes || null,
      p_dietary_acknowledged: params.dietaryAcknowledged,
      p_allergy_acknowledged: params.allergyAcknowledged,
      p_valid_until: params.validUntil,
    });

    if (error) {
      console.error('CustomMealRepository.submitStructuredQuote error:', error.message);
      throw new Error(`Failed to submit structured quote: ${error.message}`);
    }

    return data;
  }

  public static async declineInvitation(
    requestId: string,
    restaurantId: string,
    reason: DeclineReason,
    notes?: string
  ): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('custom_meal_invitations')
      .update({
        status: 'DECLINED',
        declined_at: new Date().toISOString(),
        decline_reason: reason,
        decline_notes: notes || null,
      })
      .eq('request_id', requestId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      console.error('CustomMealRepository.declineInvitation error:', error.message);
      throw new Error(`Failed to decline invitation: ${error.message}`);
    }

    return true;
  }

  public static async lockQuoteSelection(requestId: string, quoteId: string): Promise<any> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('lock_custom_meal_quote_selection', {
      p_request_id: requestId,
      p_quote_id: quoteId,
    });

    if (error) {
      console.error('CustomMealRepository.lockQuoteSelection error:', error.message);
      throw new Error(`Failed to lock quote selection: ${error.message}`);
    }

    return data;
  }

  public static async convertCustomMealToOrder(requestId: string, paymentId: string): Promise<any> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('convert_custom_meal_to_order', {
      p_request_id: requestId,
      p_payment_id: paymentId,
    });

    if (error) {
      console.error('CustomMealRepository.convertCustomMealToOrder error:', error.message);
      throw new Error(`Failed to convert custom meal to canonical order: ${error.message}`);
    }

    return data;
  }

  public static async listMessages(
    requestId: string,
    restaurantId: string
  ): Promise<CustomMealMessage[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('custom_meal_messages')
      .select('*')
      .eq('request_id', requestId)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('CustomMealRepository.listMessages error:', error.message);
      return [];
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      requestId: m.request_id,
      quoteId: m.quote_id,
      restaurantId: m.restaurant_id,
      senderUserId: m.sender_user_id,
      senderRole: m.sender_role,
      messageType: m.message_type,
      body: m.body,
      createdAt: m.created_at,
      editedAt: m.edited_at,
    }));
  }

  public static async sendMessage(
    requestId: string,
    restaurantId: string,
    senderUserId: string,
    senderRole: 'CUSTOMER' | 'RESTAURANT',
    body: string,
    messageType: 'TEXT' | 'CLARIFICATION' | 'QUOTE_REVISION_REQUEST' = 'TEXT',
    quoteId?: string
  ): Promise<CustomMealMessage> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase
      .from('custom_meal_messages')
      .insert({
        request_id: requestId,
        restaurant_id: restaurantId,
        quote_id: quoteId || null,
        sender_user_id: senderUserId,
        sender_role: senderRole,
        message_type: messageType,
        body: body.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('CustomMealRepository.sendMessage error:', error.message);
      throw new Error(`Failed to send message: ${error.message}`);
    }

    return {
      id: data.id,
      requestId: data.request_id,
      quoteId: data.quote_id,
      restaurantId: data.restaurant_id,
      senderUserId: data.sender_user_id,
      senderRole: data.sender_role,
      messageType: data.message_type,
      body: data.body,
      createdAt: data.created_at,
      editedAt: data.edited_at,
    };
  }

  // ============================================================================
  // Backward compatibility methods for existing callers
  // ============================================================================

  public static async createRequest(request: Partial<CustomMealRequest>): Promise<CustomMealRequest> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const id = request.id || `req_${Date.now()}`;
    const orderNumber = request.orderNumber || `MLO-${Date.now().toString().slice(-4)}`;

    const row = {
      id,
      order_number: orderNumber,
      user_id: request.customerId,
      dish_name: request.dishName || request.title || 'Custom Meal',
      title: request.title || request.dishName || 'Custom Meal',
      special_instructions: request.specialInstructions || request.description || '',
      budget_tzs: request.budgetTzs || request.budgetMinTzs || 15000,
      budget_min_tzs: request.budgetMinTzs || request.budgetTzs || 15000,
      budget_max_tzs: request.budgetMaxTzs || request.budgetTzs || 25000,
      servings_count: request.servingsCount || request.servings || '1 Person',
      dining_option: request.diningOption || 'Delivery',
      fulfillment_mode: request.fulfillmentMode || 'RESTAURANT_DELIVERY',
      delivery_location: request.deliveryLocation || request.location,
      customer_area: request.customerArea || request.deliveryLocation || request.location || 'Dar es Salaam',
      preferred_time: request.preferredTime || request.desiredDate,
      desired_at: request.desiredAt || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      quote_deadline: request.quoteDeadline || new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
      expires_at: request.expiresAt || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      status: request.status || 'PENDING',
      status_message_en: request.statusMessageEn || 'Order submitted. Awaiting chef bids.',
      status_message_sw: request.statusMessageSw || 'Agizo limetumwa. Inasubiri ofa za wapishi.',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('custom_meal_requests')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('CustomMealRepository.createRequest error:', error.message);
      throw new Error(`Failed to create custom meal request: ${error.message}`);
    }

    return this.mapRowToRequest(data);
  }

  public static async listOpenRequests(): Promise<CustomMealRequest[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('custom_meal_requests')
      .select('*, restaurant_quotes(*, restaurant_quote_items(*), restaurants(name))')
      .in('status', ['PENDING', 'QUOTES_RECEIVED'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('CustomMealRepository.listOpenRequests error:', error.message);
      throw new Error(`Failed to list open custom meal requests: ${error.message}`);
    }

    return (data || []).map((r) =>
      this.mapRowToRequest(r, (r.restaurant_quotes || []).map(this.mapRowToQuote))
    );
  }

  public static async submitQuote(quote: Partial<RestaurantQuote>): Promise<RestaurantQuote> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const row = {
      id: quote.id || `quote_${Date.now()}`,
      request_id: quote.requestId,
      restaurant_id: quote.restaurantId,
      quoted_price_tzs: quote.quotedPriceTzs || quote.amountTzs || 15000,
      subtotal_tzs: quote.subtotalTzs || quote.quotedPriceTzs || quote.amountTzs || 15000,
      total_tzs: quote.totalTzs || quote.quotedPriceTzs || quote.amountTzs || 15000,
      estimated_prep_minutes: quote.estimatedPrepMinutes || 35,
      chef_notes: quote.chefNotes || quote.message,
      restaurant_note: quote.restaurantNote || quote.chefNotes || quote.message,
      status: 'OFFERED',
    };

    const { data, error } = await supabase
      .from('restaurant_quotes')
      .insert(row)
      .select('*, restaurants(name)')
      .single();

    if (error) {
      console.error('CustomMealRepository.submitQuote error:', error.message);
      throw new Error(`Failed to submit quote: ${error.message}`);
    }

    return this.mapRowToQuote(data);
  }

  public static async acceptQuote(requestId: string, quoteId: string): Promise<CustomMealRequest> {
    await this.lockQuoteSelection(requestId, quoteId);
    const updated = await this.getRequestById(requestId);
    if (!updated) throw new Error('Request locked but could not be refetched.');
    return updated;
  }

  public static async updateRequest(
    id: string,
    updates: Partial<CustomMealRequest>
  ): Promise<CustomMealRequest> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const rowUpdates: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.dishName !== undefined || updates.title !== undefined) {
      rowUpdates.dish_name = updates.dishName || updates.title;
      rowUpdates.title = updates.title || updates.dishName;
    }
    if (updates.specialInstructions !== undefined || updates.description !== undefined) {
      rowUpdates.special_instructions = updates.specialInstructions || updates.description;
    }
    if (updates.budgetTzs !== undefined) {
      rowUpdates.budget_tzs = updates.budgetTzs;
    }
    if (updates.servingsCount !== undefined || updates.servings !== undefined) {
      rowUpdates.servings_count = updates.servingsCount || updates.servings;
    }
    if (updates.status !== undefined) {
      rowUpdates.status = updates.status;
    }

    const { data, error } = await supabase
      .from('custom_meal_requests')
      .update(rowUpdates)
      .eq('id', id)
      .select('*, restaurant_quotes(*, restaurant_quote_items(*), restaurants(name))')
      .single();

    if (error) {
      console.error(`CustomMealRepository.updateRequest(${id}) error:`, error.message);
      throw new Error(`Failed to update custom meal request: ${error.message}`);
    }

    return this.mapRowToRequest(data, (data.restaurant_quotes || []).map(this.mapRowToQuote));
  }

  public static async cancelRequest(id: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { error } = await supabase
      .from('custom_meal_requests')
      .update({
        status: 'CANCELLED',
        status_message_en: 'Custom meal request cancelled.',
        status_message_sw: 'Agizo maalum limesitishwa.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error(`CustomMealRepository.cancelRequest(${id}) error:`, error.message);
      throw new Error(`Failed to cancel custom meal request: ${error.message}`);
    }

    return true;
  }

  public static async deleteRequest(id: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { error } = await supabase
      .from('custom_meal_requests')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`CustomMealRepository.deleteRequest(${id}) error:`, error.message);
      throw new Error(`Failed to delete custom meal request: ${error.message}`);
    }

    return true;
  }
}
