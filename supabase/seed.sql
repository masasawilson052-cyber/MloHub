-- ============================================================================
-- MLOHUB SUPABASE SEED DATA
-- Version: 20260908000001
-- Description: Consistent seed data for testing real user journeys.
-- ============================================================================

-- 1. Create auth.users and profiles
-- Note: In production Supabase, users are inserted via auth.signUp or Admin API.
-- Profiles seed matching default test credentials

INSERT INTO public.profiles (
    id, full_name, email, phone, role, roles, active_workspace, language, avatar_emoji, company_or_group, is_phone_verified, is_email_verified
) VALUES
('00000000-0000-0000-0000-000000000001', 'Frank Mlaki', 'frank.mlaki@mlohub.tz', '+255754123456', 'CUSTOMER', ARRAY['CUSTOMER'::user_role_enum], 'CUSTOMER', 'en', '👨‍💼', 'Dar Tech Labs (10 Staff)', TRUE, TRUE),
('00000000-0000-0000-0000-000000000002', 'Amina Bakari', 'amina.bakari@mlohub.tz', '+255784987654', 'CUSTOMER', ARRAY['CUSTOMER'::user_role_enum], 'CUSTOMER', 'sw', '👩‍🦰', 'Solo Meal Plan', TRUE, TRUE),
('00000000-0000-0000-0000-000000000003', 'Mama Amina Juma', 'mama.amina@mlohub.tz', '+255754889120', 'RESTAURANT_OWNER', ARRAY['CUSTOMER'::user_role_enum, 'RESTAURANT_OWNER'::user_role_enum], 'RESTAURANT_OWNER', 'sw', '👑', 'Mama Amina Biryani House', TRUE, TRUE),
('00000000-0000-0000-0000-000000000004', 'MloHub Admin Team', 'admin@mlohub.tz', '+255700000000', 'SUPER_ADMIN', ARRAY['SUPER_ADMIN'::user_role_enum, 'ADMIN'::user_role_enum], 'MLOHUB_ADMIN', 'sw', '🛡️', 'MloHub Administration', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- 2. Restaurants Seed
INSERT INTO public.restaurants (
    id, owner_id, name, slug, cuisine, description, seller_tier, rating, reviews_count,
    min_price_tzs, max_price_tzs, address, neighborhood, region_city, distance_km, estimated_prep_time_minutes,
    is_open, is_verified, verification_status, opening_hours, closing_hours, cover_image_url, specialty, emoji
) VALUES
('mama-amina-biryani', '00000000-0000-0000-0000-000000000003', 'Mama Amina Biryani House', 'mama-amina-biryani', 'Zanzibar Biryani & Pilau', 'Authentic Zanzibar dum biryani slow-cooked with fresh local spices.', 'VERIFIED_SELLER', 4.9, 142, 6000, 25000, 'Old Bagamoyo Rd, Mikocheni B', 'Mikocheni', 'Dar es Salaam', 0.8, 30, TRUE, TRUE, 'VERIFIED', '09:00 AM', '09:00 PM', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 'Authentic Zanzibar Beef Biryani', '🍚'),
('kibo-mchemsho', NULL, 'Kibo Peak Mchemsho Spot', 'kibo-mchemsho', 'Swahili Soups & Healthy Boils', 'Nutritious slow-simmered beef and fish broth with sweet potatoes and green bananas.', 'BASIC_SELLER', 4.7, 89, 5000, 18000, 'Sinza Mori Near Deluxe', 'Sinza', 'Dar es Salaam', 2.3, 20, TRUE, TRUE, 'VERIFIED', '06:30 AM', '08:00 PM', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', 'Special Supu ya Mkia', '🥣'),
('green-leaf', NULL, 'Green Leaf Fresh Kitchen', 'green-leaf', 'Healthy Salads & Vegan Bowls', 'Fresh organic salads and cold-pressed juices.', 'VERIFIED_SELLER', 4.8, 64, 8000, 22000, 'Masaki Chole Road', 'Masaki', 'Dar es Salaam', 3.5, 25, TRUE, TRUE, 'VERIFIED', '08:00 AM', '08:00 PM', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80', 'Avocado Protein Bowl', '🥗')
ON CONFLICT (id) DO NOTHING;

-- 3. Restaurant Membership Seed
INSERT INTO public.restaurant_members (
    id, user_id, restaurant_id, role, is_primary_owner, is_active
) VALUES
('mem-amina-01', '00000000-0000-0000-0000-000000000003', 'mama-amina-biryani', 'OWNER', TRUE, TRUE)
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- 4. Menu Categories
INSERT INTO public.menu_categories (
    id, restaurant_id, name_en, name_sw, display_order
) VALUES
('cat-amina-main', 'mama-amina-biryani', 'Main Dishes', 'Vyakula Vikuu', 1),
('cat-amina-specials', 'mama-amina-biryani', 'Weekend Specials', 'Vyakula Maalum vya Wikendi', 2),
('cat-amina-drinks', 'mama-amina-biryani', 'Fresh Drinks', 'Vinywaji Baridi', 3)
ON CONFLICT (id) DO NOTHING;

-- 5. Menu Items
INSERT INTO public.menu_items (
    id, restaurant_id, category_id, name_en, name_sw, description_en, description_sw, price_tzs, photo_url, stock_quantity, is_available, estimated_prep_time_minutes, dietary_tags
) VALUES
('item-biryani-beef', 'mama-amina-biryani', 'cat-amina-main', 'Zanzibar Beef Biryani', 'Biryani ya Ng''ombe ya Zanzibar', 'Tender marinated beef served over fragrant basmati saffron rice with spicy kachumbari.', 'Nyama laini ya ng''ombe na mchele wa basmati uliopikwa na viungo asilia vya Zanzibar.', 12000, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 35, TRUE, 25, ARRAY['High Protein', 'Halal']),
('item-pilau-kuku', 'mama-amina-biryani', 'cat-amina-main', 'Swahili Spiced Chicken Pilau', 'Pilau ya Kuku ya Viungo', 'Traditional fragrant spiced rice with tender free-range chicken and salad.', 'Pilau yenye harufu nzuri na kuku wa kienyeji.', 14000, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&q=80', 25, TRUE, 20, ARRAY['Halal']),
('item-tamarind-juice', 'mama-amina-biryani', 'cat-amina-drinks', 'Fresh Ukwaju Juice', 'Jusi Safi ya Ukwaju', 'Refreshing chilled tamarind juice with hints of ginger and clove.', 'Jusi baridi ya ukwaju na tangawizi.', 3000, 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80', 50, TRUE, 5, ARRAY['Vegan', 'Gluten-Free'])
ON CONFLICT (id) DO NOTHING;

-- 6. Sample Initial Order
INSERT INTO public.orders (
    id, order_number, user_id, restaurant_id, status, payment_status, subtotal_tzs, service_fee_tzs, total_tzs, dining_option, delivery_address, estimated_prep_minutes
) VALUES
('ord-sample-01', 'MLO-2026-8801', '00000000-0000-0000-0000-000000000001', 'mama-amina-biryani', 'ACCEPTED', 'SUCCESS', 24000, 1500, 25500, 'Delivery', 'Old Bagamoyo Rd, Mikocheni B', 30)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (
    id, order_id, menu_item_id, item_name, unit_price_tzs, quantity, total_price_tzs
) VALUES
('item-ord-01', 'ord-sample-01', 'item-biryani-beef', 'Zanzibar Beef Biryani', 12000, 2, 24000)
ON CONFLICT (id) DO NOTHING;
