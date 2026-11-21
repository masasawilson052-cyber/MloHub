-- Migration: Add nullable photo_card_url to menu_items and cover_card_url to restaurants
-- For fast 3G loading of 400px card images without server-side transformation

ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS photo_card_url TEXT;

ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS cover_card_url TEXT;

COMMENT ON COLUMN public.menu_items.photo_card_url IS 'Pre-resized 400px card image URL for fast mobile 3G card feeds';
COMMENT ON COLUMN public.restaurants.cover_card_url IS 'Pre-resized 400px card image URL for fast mobile 3G card feeds';
