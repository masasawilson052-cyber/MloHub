# Staging Seed Images

This directory contains local food and restaurant photography used by `scripts/seed-staging-demo.ts` to populate the `mlohub-media` Supabase storage bucket in staging and testing environments.

---

## Required Image Specifications

The seed runner (`scripts/seed-staging-demo.ts`) strictly validates all images before uploading:

| Parameter | Specification | Enforcement |
|-----------|---------------|-------------|
| **Recommended Dimensions** | **1,200 × 900 px** (4:3 aspect ratio) | Recommended |
| **Minimum Width** | **800 px** wide | **Strictly enforced** (width < 800 px rejected) |
| **Maximum File Size** | **500 KB** (512,000 bytes) | **Strictly enforced** (> 500 KB rejected) |
| **Recommended File Size** | **Under 300 KB** | Best practice for mobile performance |
| **Allowed Formats** | **JPG / JPEG, WebP, PNG** | JPG or WebP preferred for compression |

---

## Full Inventory of Required Filenames

All 18 filenames referenced by the staging seed data:

### 1. Restaurant Cover Images (8 files)
- `cover_mama_amina.png` (or `.jpg` / `.webp`): Mama Amina Kitchen (Mikocheni, Mama Ntilie)
- `cover_mama_asha.png` (or `.jpg` / `.webp`): Mama Asha Kitchen (Sinza, Mama Ntilie)
- `cover_biryani.png` (or `.jpg` / `.webp`): Zanzibar Spice & Biryani House (Msasani, Biryani & Pilau)
- `cover_nyama_choma.png` (or `.jpg` / `.webp`): Kibo Nyama Choma Grill (Mwenge / UDSM, Choma Grill)
- `cover_seafood.png` (or `.jpg` / `.webp`): Samaki Samaki Express (Masaki, Coastal Seafood)
- `cover_cafe.png` (or `.jpg` / `.webp`): Kahawa & Chapati Lounge (Upanga, Breakfast & Cafe)
- `cover_juice.png` (or `.jpg` / `.webp`): Matunda Fresh Juice & Bites (Kariakoo, Juice Bar & Street Snacks)
- `cover_bistro.png` (or `.jpg` / `.webp`): The Palm Bistro & Grill (Mlimani City, Continental Bistro & Reservations)

### 2. Category Dish Photos (8 files)
- `chipsi_mayai.png` (or `.jpg` / `.webp`): Chipsi Mayai (Zege) / Omelettes
- `pilau.png` (or `.jpg` / `.webp`): Pilau ya Ng'ombe / Mbuzi / Royal Pilau
- `biryani.png` (or `.jpg` / `.webp`): Biryani ya Kuku / Nyama na Sosi Nzito
- `mishkaki.png` (or `.jpg` / `.webp`): Mishkaki ya Ng'ombe / Kuku / Samaki (Skewers)
- `samaki.png` (or `.jpg` / `.webp`): Sato wa Kuoka / Samaki Changu wa Nazi / Sato wa Kukaanga
- `wali_maharage.png` (or `.jpg` / `.webp`): Wali Maharage ya Nazi na Mboga
- `chai.png` (or `.jpg` / `.webp`): Chai ya Maziwa ya Masala / Kahawa ya Tangawizi
- `juice.png` (or `.jpg` / `.webp`): Juisi ya Embe Dodo / Passion / Parachichi / Nanasi

### 3. Fallback Assets (2 files)
- `default_cover.png` (or `.jpg` / `.webp`): Fallback storefront/dining cover
- `default_dish.png` (or `.jpg` / `.webp`): Fallback dish presentation photo

---

## Licensing & Content Safety Policy

1. **Original or Properly Licensed**: All photographs must be original photography taken by/for MloHub or licensed for commercial mobile application distribution.
2. **No Scraped Content**: Do not place copyrighted images scraped from Google, Instagram, food delivery apps, or competitor platforms.
