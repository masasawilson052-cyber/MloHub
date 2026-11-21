# Staging Seed Images

This directory contains local food and restaurant photography used by `scripts/seed-staging-demo.ts` to populate the `mlohub-media` storage bucket in staging and testing environments.

## Licensing and Usage Policy

1. **Original or Properly Licensed**: All photographs placed in this directory must be original photography taken by or for MloHub, or licensed under terms allowing commercial distribution and display in mobile applications.
2. **No Unlicensed Third-Party Content**: Do not place copyrighted images scraped from Google, Instagram, food blogs, or competitor platforms in this directory.
3. **Format & Sizing Guidelines**:
   - **Cover Photos**: Minimum 1600x900 px (recommended 2000x1200 px), JPEG or WebP, under 5 MB.
   - **Dish Photos**: Minimum 800x800 px (recommended 1200x800 px), JPEG or WebP, under 3 MB.
   - Supported extensions: `.jpg`, `.jpeg`, `.png`, `.webp`.

## Default Files

- `default_cover.jpg` / `default_cover.png`: Fallback restaurant storefront or dining area cover photo.
- `default_dish.jpg` / `default_dish.png`: Fallback dish presentation photo.
- Dedicated category images: `chipsi_mayai.png`, `pilau.png`, `biryani.png`, `mishkaki.png`, `samaki.png`, `wali_maharage.png`, `chai.png`, `juice.png`.
