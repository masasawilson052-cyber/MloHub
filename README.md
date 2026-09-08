# MloHub Mobile & Web App (Expo SDK 54)

Cross-platform restaurant discovery and custom meal platform for Dar es Salaam, Tanzania built with **Expo SDK 54** and **Expo Router**.

## Project Location on Your Computer

```
/Users/frank/Downloads/MloHub_Expo
```

---

## Features

- **Cross-Platform**: Runs natively on iOS & Android via Expo Go, and in desktop/mobile web browsers.
- **Home (`/`)**:
  - Dar es Salaam location switcher modal (Oysterbay, Masaki, Mikocheni, Kariakoo, City Centre).
  - Real-time search with clear button and collapsible quick filter chips (`Within 3 km`, `Open now`, `Rating 4.0+`, `Budget`).
  - 4 Service Shortcut Cards (`Nearby`, `Compare`, `Reservations`, `Top Rated`).
  - Prominent Custom Meal Banner (*"Can’t find it on the menu?"*).
  - Restaurant cards with ratings, prep time, distance, price range in TZS, favorite toggles, and instant reservation modal.
  - Why MloHub benefit cards.
- **Explore / Compare (`/explore`)**:
  - Live search and category filters (Swahili, Indian, Healthy, Burgers, Seafood).
  - Sorting by rating, proximity, and price.
- **Custom Meal (`/custom`)**:
  - Interactive 3-step meal request flow (*Describe -> Get offers -> Choose*).
  - Dish description, budget in TZS, serving size selector, and simulated chef offers.
- **Bookings (`/bookings`)**:
  - Instant table reservations with party size, date, time slot, and booking confirmation history.
- **Diner Profile (`/profile`)**:
  - Saved favorites list, active requests, neighborhood selector, and notification preferences.
- **Restaurant Details & Menu (`/restaurant/[id]`)**:
  - Full menu with item descriptions, prices in TZS, customer review score, and table booking modal.

---

## How to Run the App

### 1. Install Dependencies

```bash
cd /Users/frank/Downloads/MloHub_Expo
npm install
```

### 2. Run on Web Browser

```bash
npx expo start --web
```
Or:
```bash
npm run web
```
This starts the development server at `http://localhost:8081` with responsive web layout.

### 3. Run on Mobile (iOS / Android)

```bash
npx expo start
```
- Open the **Expo Go** app on your iPhone or Android phone.
- Scan the QR code displayed in your terminal.
- Press `i` to launch in iOS Simulator (if installed on Mac).
- Press `a` to launch in Android Emulator (if installed).
