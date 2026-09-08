-- ============================================================================
-- MLOHUB DATABASE SEED DATA (Dar es Salaam Restaurants & Discovery Data)
-- ============================================================================

-- 1. Insert Default User
INSERT INTO users (id, full_name, email, phone, location, role, language, dietary_preferences)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Frank Mlaki',
    'frank.mlaki@mlohub.tz',
    '+255 754 123 456',
    'Dar es Salaam, Masaki',
    'customer',
    'en',
    ARRAY['Swahili', 'Healthy', 'Fresh Seafood', 'Low Chili']
) ON CONFLICT (email) DO NOTHING;

-- 2. Insert Popular Dar es Salaam Restaurants
INSERT INTO restaurants (id, name, slug, cuisine, rating, reviews_count, min_price_tzs, max_price_tzs, budget_tier, address, neighborhood, distance_km, estimated_time, is_open, is_verified, specialty, emoji, tags)
VALUES
(
    'green-leaf',
    'Green Leaf Café',
    'green-leaf-cafe',
    'Healthy & Salads',
    4.8,
    142,
    8000,
    18000,
    'mid',
    'Haile Selassie Rd, Oysterbay',
    'Oysterbay',
    1.2,
    '20-30m',
    TRUE,
    TRUE,
    'Fresh organic avocado salad bowl',
    '🥗',
    ARRAY['healthy', 'salads', 'vegan', 'organic', 'oysterbay']
),
(
    'spice-bowl',
    'Spice Bowl',
    'spice-bowl',
    'Tanzanian & Swahili',
    4.6,
    98,
    5000,
    15000,
    'budget',
    'Shekilango Rd, Sinza',
    'Sinza',
    2.4,
    '25-35m',
    TRUE,
    TRUE,
    'Authentic coconut fish curry & spiced pilau',
    '🍲',
    ARRAY['tanzanian', 'swahili', 'curry', 'pilau', 'sinza']
),
(
    'ocean-view',
    'Ocean View Restaurant',
    'ocean-view-restaurant',
    'Seafood & Grill',
    4.9,
    215,
    15000,
    38000,
    'premium',
    'Toure Drive, Masaki',
    'Masaki',
    3.1,
    '30-45m',
    TRUE,
    TRUE,
    'Charcoal grilled giant prawns & lobster platter',
    '🦞',
    ARRAY['seafood', 'grill', 'masaki', 'romantic', 'ocean']
),
(
    'burger-lab',
    'The Burger Lab',
    'the-burger-lab',
    'Burgers & Fast Casual',
    4.4,
    86,
    10000,
    22000,
    'mid',
    'Mwai Kibaki Rd, Mikocheni',
    'Mikocheni',
    1.8,
    '15-25m',
    TRUE,
    TRUE,
    'Double smashed beef burger with smoked cheddar',
    '🍔',
    ARRAY['burgers', 'american', 'fries', 'mikocheni']
),
(
    'samaki-corner',
    'Samaki Corner',
    'samaki-corner',
    'Swahili Seafood',
    4.7,
    178,
    12000,
    26000,
    'mid',
    'Slipway Rd, Masaki',
    'Masaki',
    2.9,
    '25-40m',
    TRUE,
    TRUE,
    'Fresh catch snapper with coconut tamarind glaze',
    '🐟',
    ARRAY['seafood', 'swahili', 'fish', 'masaki']
)
ON CONFLICT (id) DO UPDATE SET rating = EXCLUDED.rating;

-- 3. Insert Menu Items
INSERT INTO menu_items (id, restaurant_id, name, description, price_tzs, category, is_popular, is_available)
VALUES
('m-gl-1', 'green-leaf', 'Avocado Quinoa Power Bowl', 'Organic avocado, baby spinach, roasted pumpkin seeds, quinoa and lemon dressing.', 14000, 'Salads', TRUE, TRUE),
('m-gl-2', 'green-leaf', 'Grilled Chicken Caesar Salad', 'Herb-marinated chicken breast, crispy parmesan chips and low-fat garlic yogurt dressing.', 16000, 'Salads', FALSE, TRUE),
('m-sb-1', 'spice-bowl', 'Swahili Coconut Fish Curry', 'Fresh Kingfish simmered in coconut milk, turmeric, ginger and traditional coastal spices.', 15000, 'Main Course', TRUE, TRUE),
('m-sb-2', 'spice-bowl', 'Zanzibar Spiced Pilau with Beef', 'Aromatic fragrant basmati rice cooked with tender beef, cardamom, cumin and cloves.', 12000, 'Main Course', TRUE, TRUE),
('m-ov-1', 'ocean-view', 'Jumbo Garlic Butter Prawns', 'Wild caught giant ocean prawns grilled with roasted garlic butter and sweet plantains.', 28000, 'Seafood', TRUE, TRUE),
('m-ov-2', 'ocean-view', 'Grilled Red Snapper Fillet', 'Whole pan-seared red snapper served with kachumbari salsa and coconut rice.', 24000, 'Seafood', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Initial Active Custom Meal Request
INSERT INTO custom_meal_requests (
    id, user_id, order_number, dish_name, restaurant_name, target_restaurant_id,
    special_instructions, budget_tzs, servings_count, dining_option, status,
    status_message_en, status_message_sw
)
VALUES (
    'ord-1',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '#MLO-8492',
    'Swahili Coconut Fish Curry with Brown Rice',
    'Samaki Corner',
    'samaki-corner',
    'Cook with extra coconut milk, mild chili, and add fried sweet plantains on the side.',
    18000,
    '2',
    'Delivery',
    'Pending Confirmation',
    'Awaiting restaurant confirmation • You can edit your menu & instructions freely',
    'Inasubiri uthibitisho wa mgahawa • Unaweza kuhariri menyu na viungo upendavyo'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Initial Confirmed Payment
INSERT INTO payments (id, user_id, restaurant_name, amount_tzs, payment_method, reference_number, status)
VALUES (
    'pay-501',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Spice Bowl',
    25000,
    'M-Pesa',
    'MP-894291849',
    'success'
)
ON CONFLICT (id) DO NOTHING;
