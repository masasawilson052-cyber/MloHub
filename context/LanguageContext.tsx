import React, { createContext, useContext, useState, ReactNode } from 'react';
import { DishTrustBadgeCode } from '../types/trust';

export type Language = 'en' | 'sw';

export interface Translations {
  // Tabs
  tabHome: string;
  tabExplore: string;
  tabOrders: string;
  tabCustom: string;
  tabBookings: string;
  tabAccount: string;
  tabProfile: string;

  // Header
  selectArea: string;
  savedFavorites: string;
  changeLanguage: string;
  notifications: string;

  // Hero Section
  eyebrowHero: string;
  heroHeading1: string;
  heroHeading2: string;
  heroSub: string;
  searchPlaceholder: string;
  filterTitle: string;
  filterWithin3km: string;
  filterOpenNow: string;
  filterRating4: string;
  filterBudget: string;
  resetFilters: string;
  statsRestaurants: string;
  statsRating: string;
  statsPrices: string;

  // Service Cards
  exploreEyebrow: string;
  exploreTitle: string;
  serviceNearbyLabel: string;
  serviceNearbyDetail: string;
  serviceCompareLabel: string;
  serviceCompareDetail: string;
  serviceReserveLabel: string;
  serviceReserveDetail: string;
  serviceTopRatedLabel: string;
  serviceTopRatedDetail: string;

  // Custom Meal Banner
  customBadge: string;
  customBannerHeading: string;
  customBannerSub: string;
  step1: string;
  step1Desc: string;
  step2: string;
  step2Desc: string;
  step3: string;
  step3Desc: string;
  startCustomRequest: string;

  // Popular Restaurants
  popularEyebrow: string;
  popularTitle: string;
  placesCount: string;
  mealsFrom: string;
  reserveBtn: string;
  viewMenuBtn: string;
  topPickBadge: string;
  verifiedBadge: string;
  openBadge: string;
  closedBadge: string;
  noRestaurantsTitle: string;
  noRestaurantsMsg: string;
  clearFilters: string;

  // Why MloHub
  whyEyebrow: string;
  whyHeading: string;
  why1Title: string;
  why1Desc: string;
  why2Title: string;
  why2Desc: string;
  why3Title: string;
  why3Desc: string;

  // Explore Screen
  explorePageEyebrow: string;
  explorePageTitle: string;
  sortBy: string;
  sortTopRated: string;
  sortDistance: string;
  sortPrice: string;

  // Custom Meal Screen
  customPageBadge: string;
  customPageHeading: string;
  customPageSub: string;
  submitRequestTitle: string;
  cravingLabel: string;
  cravingPlaceholder: string;
  budgetLabel: string;
  servingsLabel: string;
  broadcastBtn: string;
  broadcastSuccessTitle: string;
  broadcastSuccessText: string;
  incomingOfferTag: string;
  submitAnotherBtn: string;

  // Bookings Screen
  bookingsEyebrow: string;
  bookingsTitle: string;
  upcomingBookingsHeading: string;
  bookNearbyHeading: string;
  bookTableBtn: string;
  confirmedStatus: string;
  partyLabel: string;
  timeLabel: string;

  // Profile & Customer Menu Editor
  profileRole: string;
  savedPlacesStat: string;
  customMealsStat: string;
  bookingsStat: string;
  customerOrdersEyebrow: string;
  customerOrdersTitle: string;
  newRequestBtn: string;
  customerOrdersDesc: string;
  pendingStatus: string;
  confirmedChefStatus: string;
  editMenuBtn: string;
  cancelBtn: string;
  menuLockedNotice: string;
  simulateChefAccept: string;
  resetToPending: string;
  noOrdersTitle: string;
  noOrdersSub: string;
  createFirstRequestBtn: string;

  // Edit Modal
  editModalBadge: string;
  editModalTitle: string;
  dishNameLabel: string;
  instructionsLabel: string;
  instructionsPlaceholder: string;
  quickTagsLabel: string;
  diningMethodLabel: string;
  deliveryOpt: string;
  dineInOpt: string;
  takeawayOpt: string;
  editNoticeText: string;
  discardBtn: string;
  saveMenuBtn: string;
  orderLockedAlertTitle: string;
  orderLockedAlertMsg: string;

  // Preferences
  preferencesTitle: string;
  prefNeighborhood: string;
  prefAlerts: string;
  prefLanguage: string;
  prefOnboarding: string;
  alertsEnabled: string;

  // Modals General
  selectAreaTitle: string;
  selectAreaSub: string;
  tableReservationTitle: string;
  instantReservationSub: string;
  numGuestsLabel: string;
  dateLabel: string;
  timeSlotLabel: string;
  confirmBookingBtn: string;
  bookingSuccessTitle: string;
  bookingSuccessMsg: string;
  doneBtn: string;

  // Notifications
  notifTitle: string;
  notifMarkAllRead: string;
  notifTabAll: string;
  notifTabReservations: string;
  notifTabOrders: string;
  notifTabPayments: string;
  notifTabOffers: string;
  notifEmptyTitle: string;
  notifEmptySub: string;
  notifSettingsTitle: string;
  notifSettingsSub: string;
  notifActionViewReservation: string;
  notifActionViewOrder: string;
  notifActionViewReceipt: string;
  notifActionRate: string;
  notifActionGetDirections: string;
  notifActionFindAnother: string;
  notifActionRetryPayment: string;
  notifSimulateIncoming: string;

  // Exact 3-Slide User Onboarding Walkthrough
  onboardingSkip: string;
  onboardingBack: string;
  onboardingNext: string;
  onboardingGetStarted: string;
  onboardingStartExploring: string;
  onboardingSlide1Title: string;
  onboardingSlide1Sub: string;
  onboardingSlide2Title: string;
  onboardingSlide2Sub: string;
  onboardingSlide3Title: string;
  onboardingSlide3Sub: string;

  // One-Screen Welcome Sheet
  welcomeTagline: string;
  welcomeStartBtn: string;
  welcomeUseLocationBtn: string;
  welcomeChooseAreaBtn: string;
  welcomeLanguageLabel: string;
  welcomeLocationUnavailable: string;
  welcomeCurrentArea: string;
  welcomeCloseBtn: string;

  // Dish Card & Trust System
  trustBadgeVerifiedToday: string;
  trustBadgeConfirmedRecently: string;
  trustBadgeAging: string;
  trustBadgeNeedsVerification: string;
  trustBadgeUnverified: string;
  trustBadgeUnderReview: string;
  trustBadgeDisputed: string;

  trustDescVerifiedToday: string;
  trustDescConfirmedRecently: string;
  trustDescAging: string;
  trustDescNeedsVerification: string;
  trustDescUnverified: string;
  trustDescUnderReview: string;
  trustDescDisputed: string;

  trustIndicatorLabel: string;
  trustTapForDetails: string;

  availableBadge: string;
  lowStockBadge: string;
  soldOutBadge: string;
  newDishBadge: string;

  compareAction: string;
  compareActionActive: string;
  compareActionAccessibility: string;
  addOrderAction: string;
  addOrderActionAccessibility: string;
  mlohubDishPlaceholder: string;
  cardAccessibilityAt: string;
  cardAccessibilityAway: string;

  // Restaurant Page & Decision Facts
  factsOpenNow: string;
  factsOpensAt: string;
  factsClosed: string;
  factsNotTakingOrders: string;
  factsDeliveryFrom: string;
  factsFinalFeeAtCheckout: string;
  factsDeliveryNotAvailable: string;
  factsEstTime: string;
  factsMinOrder: string;
  factsNoMinOrder: string;
  factsServiceDelivery: string;
  factsServiceTakeaway: string;
  factsServiceDineIn: string;
  factsServiceReservations: string;
  restaurantLoading: string;
  restaurantLoadError: string;
  restaurantRetry: string;
  reserveTableBtn: string;
  menuAllCategories: string;
  itemsCount: string;
  itemSingularCount: string;
  mamaNtilie: string;

  // Image Upload & Media
  imageUploadTooLarge: string;
  imageUploadFailed: string;
  imageGalleryPermissionDenied: string;
  imageCameraPermissionDenied: string;

  // Platform Fee Rules
  feeRulesTitle: string;
  feeRulesSubtitle: string;
  feeRulesServiceFeeBps: string;
  feeRulesServiceFeeBpsHint: string;
  feeRulesServiceFeeMin: string;
  feeRulesServiceFeeMinHint: string;
  feeRulesServiceFeeMax: string;
  feeRulesServiceFeeMaxHint: string;
  feeRulesDeliveryMinOrder: string;
  feeRulesDeliveryMinOrderHint: string;
  feeRulesMinOrderTakeaway: string;
  feeRulesMinOrderTakeawayHint: string;
  feeRulesCommDelivery: string;
  feeRulesCommDeliveryHint: string;
  feeRulesCommTakeaway: string;
  feeRulesCommTakeawayHint: string;
  feeRulesCommDineIn: string;
  feeRulesCommDineInHint: string;
  feeRulesFreeDays: string;
  feeRulesFreeDaysHint: string;
  feeRulesReasonLabel: string;
  feeRulesReasonPlaceholder: string;
  feeRulesSaveBtn: string;
  feeRulesSaving: string;
  feeRulesLiveExampleTitle: string;
  feeRulesExampleSubtotal: string;
  feeRulesExampleServiceFee: string;
  feeRulesExampleCommission: string;
  feeRulesExamplePayout: string;
  feeRulesInvalidPercent: string;
  feeRulesInvalidNumber: string;
  feeRulesReasonRequired: string;
  feeRulesUpdatedSuccess: string;
  feeRulesUpdateError: string;
  feeRulesConfirmTitle: string;
  feeRulesConfirmDesc: string;
  feeRulesConfirmCancel: string;
  feeRulesConfirmSubmit: string;

  // Cart & Checkout Resilience
  itemCountSingular: string;
  itemCountPlural: string;
  cartUpdatedNotice: string;
  deliveryFromX: string;
  deliveryFeeAtCheckout: string;
  estimatedTotal: string;
  deliveryMinimumNudge: string;
  deliveryMinimumDesc: string;
  backToMenu: string;
  switchToTakeaway: string;
  branchRequired: string;
  deliveryAddressRequired: string;
  deliveryRangeExceeded: string;
  phoneRequired: string;
  orderFailed: string;
  deliveryMinimumNotMet: string;
  paymentIncomplete: string;
  signInToCheckout: string;
  signInSubtitle: string;
  tabSignIn: string;
  tabQuickSignUp: string;
  emailOrPhoneLabel: string;
  passwordLabel: string;
  fullNameLabel: string;
  phoneLabel: string;
  signInBtn: string;
  signUpBtn: string;
  termsAgree: string;
  forgotPasswordLink: string;
}

const TRANSLATIONS: Record<Language, Translations> = {
  en: {
    // Tabs
    tabHome: 'Home',
    tabExplore: 'Explore',
    tabOrders: 'Orders',
    tabCustom: 'Custom',
    tabBookings: 'Bookings',
    tabAccount: 'Account',
    tabProfile: 'Profile',

    // Header
    selectArea: 'Select Area',
    savedFavorites: 'Favorites',
    changeLanguage: 'English',
    notifications: 'Notifications',

    // Hero Section
    eyebrowHero: 'FOOD DISCOVERY, MADE FOR YOU',
    heroHeading1: 'Find a meal that',
    heroHeading2: 'feels just right.',
    heroSub: 'Discover nearby restaurants, compare real prices and ratings, reserve tables and request meals beyond the menu.',
    searchPlaceholder: 'Search by meal, cuisine, or restaurant...',
    filterTitle: 'Quick Filters:',
    filterWithin3km: 'Within 3 km',
    filterOpenNow: 'Open now',
    filterRating4: 'Rating 4.0+',
    filterBudget: 'Budget',
    resetFilters: 'Reset',
    statsRestaurants: '50+ restaurants',
    statsRating: '4.8 average rating',
    statsPrices: 'Updated local prices',

    // Service Cards
    exploreEyebrow: 'START EXPLORING',
    exploreTitle: 'What would you like to do?',
    serviceNearbyLabel: 'Nearby',
    serviceNearbyDetail: 'Spots within 3 km',
    serviceCompareLabel: 'Compare',
    serviceCompareDetail: 'Find the best price',
    serviceReserveLabel: 'Reservations',
    serviceReserveDetail: 'Book your table',
    serviceTopRatedLabel: 'Top Rated',
    serviceTopRatedDetail: 'Rated 4.5+ by diners',

    // Custom Meal Banner
    customBadge: '♨ ONLY ON MLOHUB',
    customBannerHeading: 'Can’t find it on the menu?',
    customBannerSub: 'Describe the meal you want, set your budget and let nearby restaurants send their best offers.',
    step1: 'Describe',
    step1Desc: 'Your dish',
    step2: 'Get offers',
    step2Desc: 'Chefs bid',
    step3: 'Choose',
    step3Desc: 'Best deal',
    startCustomRequest: 'Start a custom request →',

    // Popular Restaurants
    popularEyebrow: 'NEAR DAR ES SALAAM',
    popularTitle: 'Popular around you',
    placesCount: 'places',
    mealsFrom: 'Meals from',
    reserveBtn: 'Reserve',
    viewMenuBtn: 'View Menu',
    topPickBadge: 'TOP PICK',
    verifiedBadge: 'VERIFIED',
    openBadge: 'OPEN',
    closedBadge: 'CLOSED',
    noRestaurantsTitle: 'No restaurants found',
    noRestaurantsMsg: 'No restaurants found matching your search. Try Tanzanian, Healthy, or Burgers.',
    clearFilters: 'Clear all filters',

    // Why MloHub
    whyEyebrow: 'WHY MLOHUB',
    whyHeading: 'Your choice, backed by better information.',
    why1Title: 'Live Prices & Menus',
    why1Desc: 'Real menu items and current TZS pricing from verified restaurants.',
    why2Title: 'Diner Verified Reviews',
    why2Desc: 'Genuine feedback and customer ratings from local diners.',
    why3Title: 'Custom Food Craving',
    why3Desc: 'Request any custom dish and let local chefs submit price quotes.',

    // Explore Screen
    explorePageEyebrow: 'DISCOVER & COMPARE',
    explorePageTitle: 'Explore Restaurants',
    sortBy: 'Sort by:',
    sortTopRated: '★ Top Rated',
    sortDistance: '📍 Proximity',
    sortPrice: '💰 Price',

    // Custom Meal Screen
    customPageBadge: '♨ CUSTOM MEAL REQUEST',
    customPageHeading: 'Can’t find it on the menu?',
    customPageSub: 'Describe what you crave. Nearby chefs and restaurants in Dar es Salaam will send their best price offers directly to you.',
    submitRequestTitle: 'Submit a Meal Request',
    cravingLabel: 'What meal or dish are you craving?',
    cravingPlaceholder: 'e.g. Traditional Swahili Coconut Fish Curry with brown rice, no chili',
    budgetLabel: 'Your Budget (TZS)',
    servingsLabel: 'Servings (People)',
    broadcastBtn: 'Broadcast Request to Nearby Chefs →',
    broadcastSuccessTitle: 'Request Broadcasted!',
    broadcastSuccessText: 'Your custom meal request has been sent to verified restaurants in Dar es Salaam.',
    incomingOfferTag: 'Simulated Incoming Chef Offer',
    submitAnotherBtn: 'Submit Another Request',

    // Bookings Screen
    bookingsEyebrow: 'TABLE RESERVATIONS',
    bookingsTitle: 'Your Bookings',
    upcomingBookingsHeading: 'Upcoming Table Reservations',
    bookNearbyHeading: 'Book a Table at Nearby Eateries',
    bookTableBtn: 'Book Table',
    confirmedStatus: 'Confirmed',
    partyLabel: 'Party',
    timeLabel: 'Time',

    // Profile & Customer Menu Editor
    profileRole: 'Dar es Salaam Food Explorer',
    savedPlacesStat: 'Saved Places',
    customMealsStat: 'Custom Meals',
    bookingsStat: 'Bookings',
    customerOrdersEyebrow: 'CUSTOMER ORDERS PLATFORM',
    customerOrdersTitle: '♨ Your Custom Meals & Menus',
    newRequestBtn: '+ New Request',
    customerOrdersDesc: 'You can edit dishes, custom ingredients, portions, and budget anytime before the restaurant confirms the order.',
    pendingStatus: '⏳ PENDING CONFIRMATION',
    confirmedChefStatus: '🔒 CONFIRMED BY CHEF',
    editMenuBtn: '✏️ Edit Menu / Ingredients',
    cancelBtn: '✕ Cancel',
    menuLockedNotice: '🔒 Menu Locked (Cooking Started)',
    simulateChefAccept: 'Simulate Chef Accept',
    resetToPending: 'Reset to Pending',
    noOrdersTitle: 'No Active Custom Meal Orders',
    noOrdersSub: 'Have a craving not listed on standard menus? Submit a custom meal request to nearby chefs!',
    createFirstRequestBtn: 'Create Custom Meal Request →',

    // Edit Modal
    editModalBadge: 'EDITING ACTIVE REQUEST',
    editModalTitle: 'Edit Custom Meal & Menu',
    dishNameLabel: 'Meal / Dish Title',
    instructionsLabel: 'Special Cooking Instructions & Custom Ingredients',
    instructionsPlaceholder: 'Specify seasoning, spice level, ingredients to add/exclude...',
    quickTagsLabel: 'Quick Add Tags:',
    diningMethodLabel: 'Dining / Delivery Method',
    deliveryOpt: '🛵 Delivery',
    dineInOpt: '🪑 Dine-In',
    takeawayOpt: '🛍️ Takeaway',
    editNoticeText: 'ℹ️ Changes take effect immediately for chefs reviewing your request. Once confirmed by the kitchen, edits lock automatically.',
    discardBtn: 'Discard',
    saveMenuBtn: 'Save & Update Menu →',
    orderLockedAlertTitle: 'Order Locked',
    orderLockedAlertMsg: 'This order has already been confirmed by the restaurant chef. Changes are locked to ensure kitchen accuracy.',

    // Preferences
    preferencesTitle: 'Preferences',
    prefNeighborhood: '📍 Delivery & Dining Neighborhood',
    prefAlerts: '🔔 SMS & WhatsApp Booking Alerts',
    prefLanguage: '🌐 Language / Lugha',
    prefOnboarding: '📱 App Introduction Walkthrough',
    alertsEnabled: 'Enabled',

    // Modals General
    selectAreaTitle: 'Select Your Area',
    selectAreaSub: 'Discover food spots nearby in Dar es Salaam',
    tableReservationTitle: 'Book a Table',
    instantReservationSub: 'Instant reservation at',
    numGuestsLabel: 'Number of Guests',
    dateLabel: 'Date',
    timeSlotLabel: 'Time Slot',
    confirmBookingBtn: 'Confirm Table Reservation',
    bookingSuccessTitle: 'Reservation Confirmed!',
    bookingSuccessMsg: 'Your table has been reserved successfully.',
    doneBtn: 'Done',

    // Notifications
    notifTitle: 'Notifications',
    notifMarkAllRead: 'Mark all read',
    notifTabAll: 'All',
    notifTabReservations: 'Reservations',
    notifTabOrders: 'Orders',
    notifTabPayments: 'Payments',
    notifTabOffers: 'Offers',
    notifEmptyTitle: 'No notifications yet',
    notifEmptySub: 'Updates about your reservations, meal requests, payments, and offers will appear here.',
    notifSettingsTitle: 'Notification Settings',
    notifSettingsSub: 'Manage the alerts and updates you receive from MloHub',
    notifActionViewReservation: 'View Reservation',
    notifActionViewOrder: 'View Order Details',
    notifActionViewReceipt: 'View Receipt',
    notifActionRate: 'Rate Restaurant',
    notifActionGetDirections: 'Get Directions',
    notifActionFindAnother: 'Find Another Spot',
    notifActionRetryPayment: 'Retry Payment',
    notifSimulateIncoming: '⚡ Simulate New Notification',

    // Exact 3-Slide User Onboarding Walkthrough
    onboardingSkip: 'Skip',
    onboardingBack: 'Back',
    onboardingNext: 'Next',
    onboardingGetStarted: 'Get Started',
    onboardingStartExploring: 'Start Exploring',
    onboardingSlide1Title: 'Discover\nGreat Food\nNearby',
    onboardingSlide1Sub: 'Find restaurants, compare prices,\nand explore highly rated places around you.',
    onboardingSlide2Title: 'Reserve\nin Seconds',
    onboardingSlide2Sub: 'Book tables easily, manage your plans,\nand get instant reservation updates.',
    onboardingSlide3Title: 'Request\nMeals Your Way',
    onboardingSlide3Sub: 'Send custom meal requests, compare\noptions, and enjoy a more personalized\ndining experience.',

    // One-Screen Welcome Sheet
    welcomeTagline: 'Good food near you',
    welcomeStartBtn: 'Start',
    welcomeUseLocationBtn: 'Use my location',
    welcomeChooseAreaBtn: 'Choose area instead',
    welcomeLanguageLabel: 'Language',
    welcomeLocationUnavailable: 'Location access unavailable. Select your area below.',
    welcomeCurrentArea: 'Delivery area:',
    welcomeCloseBtn: 'Close',

    // Dish Card & Trust System
    trustBadgeVerifiedToday: 'Verified Today',
    trustBadgeConfirmedRecently: 'Confirmed Recently',
    trustBadgeAging: 'Audited 3+ Days Ago',
    trustBadgeNeedsVerification: 'Needs Verification',
    trustBadgeUnverified: 'Unverified Price',
    trustBadgeUnderReview: 'Price Under Review',
    trustBadgeDisputed: 'Disputed Price',

    trustDescVerifiedToday: 'Price confirmed accurate within the last 24 hours',
    trustDescConfirmedRecently: 'Verified accurate within the last 3 days',
    trustDescAging: 'Last verified between 3 and 7 days ago',
    trustDescNeedsVerification: 'Price has not been confirmed in over a week',
    trustDescUnverified: 'Listing imported without manual price audit',
    trustDescUnderReview: 'A customer recently reported a price difference',
    trustDescDisputed: 'Customers reported a price mismatch under review',

    trustIndicatorLabel: 'Trust indicator',
    trustTapForDetails: 'Tap for verification details',

    availableBadge: 'Available',
    lowStockBadge: 'Low Stock',
    soldOutBadge: 'Sold Out',
    newDishBadge: 'New',

    compareAction: 'Compare',
    compareActionActive: 'Compare',
    compareActionAccessibility: 'Compare',
    addOrderAction: '+ Add',
    addOrderActionAccessibility: 'Add to order',
    mlohubDishPlaceholder: 'MloHub Dish',
    cardAccessibilityAt: 'at',
    cardAccessibilityAway: 'away',

    // Restaurant Page & Decision Facts
    factsOpenNow: 'Open Now',
    factsOpensAt: 'Opens at',
    factsClosed: 'Closed',
    factsNotTakingOrders: 'Not taking orders right now',
    factsDeliveryFrom: 'Delivery from',
    factsFinalFeeAtCheckout: 'Final fee shown at checkout',
    factsDeliveryNotAvailable: 'Delivery not available here, choose Takeaway',
    factsEstTime: '~{min} min',
    factsMinOrder: 'Min {amount}',
    factsNoMinOrder: 'No minimum',
    factsServiceDelivery: 'Delivery',
    factsServiceTakeaway: 'Takeaway',
    factsServiceDineIn: 'Dine-in',
    factsServiceReservations: 'Reservations',
    restaurantLoading: 'Loading restaurant details...',
    restaurantLoadError: 'Could not load restaurant details',
    restaurantRetry: 'Retry',
    reserveTableBtn: 'Reserve a Table',
    menuAllCategories: 'All',
    itemsCount: 'items',
    itemSingularCount: 'item',
    mamaNtilie: 'Mama Ntilie',

    // Image Upload & Media
    imageUploadTooLarge: 'Image exceeds 500 KB limit after compression. Please select a smaller photo.',
    imageUploadFailed: 'Failed to upload image. Please try again.',
    imageGalleryPermissionDenied: 'Permission to access device photo gallery was denied.',
    imageCameraPermissionDenied: 'Permission to access device camera was denied.',

    // Platform Fee Rules
    feeRulesTitle: 'Platform Financial Fee Rules',
    feeRulesSubtitle: 'Configure customer service fees, order type commission tiers, and launch grace periods.',
    feeRulesServiceFeeBps: 'Customer Service Fee (%)',
    feeRulesServiceFeeBpsHint: 'Percentage of food subtotal for delivery orders (0-100%, max 2 decimals)',
    feeRulesServiceFeeMin: 'Service Fee Minimum (TZS)',
    feeRulesServiceFeeMinHint: 'Floor for delivery service fee',
    feeRulesServiceFeeMax: 'Service Fee Maximum (TZS)',
    feeRulesServiceFeeMaxHint: 'Cap for delivery service fee',
    feeRulesDeliveryMinOrder: 'Delivery Minimum Order (TZS)',
    feeRulesDeliveryMinOrderHint: 'Minimum subtotal required for delivery checkout',
    feeRulesMinOrderTakeaway: 'Minimum Order (Takeaway/Dine-In) (TZS)',
    feeRulesMinOrderTakeawayHint: 'Global subtotal floor for non-delivery orders',
    feeRulesCommDelivery: 'Delivery Commission (%)',
    feeRulesCommDeliveryHint: 'Standard commission rate on delivery orders',
    feeRulesCommTakeaway: 'Takeaway Commission (%)',
    feeRulesCommTakeawayHint: 'Commission rate on takeaway and pickup orders',
    feeRulesCommDineIn: 'Dine-In Commission (%)',
    feeRulesCommDineInHint: 'Commission rate on dine-in orders',
    feeRulesFreeDays: 'New Restaurant Grace Period (Days)',
    feeRulesFreeDaysHint: '0% commission window after restaurant goes live',
    feeRulesReasonLabel: 'Reason for Mutation (Audit Requirement)',
    feeRulesReasonPlaceholder: 'e.g. Approved fee policy revision Q4',
    feeRulesSaveBtn: 'Preview Impact & Save Changes',
    feeRulesSaving: 'Saving...',
    feeRulesLiveExampleTitle: 'Live Fee & Payout Example',
    feeRulesExampleSubtotal: 'Food Subtotal',
    feeRulesExampleServiceFee: 'Customer Service Fee',
    feeRulesExampleCommission: 'Platform Commission',
    feeRulesExamplePayout: 'Restaurant food payout',
    feeRulesInvalidPercent: 'Percentage must be between 0 and 100 with at most 2 decimal places.',
    feeRulesInvalidNumber: 'Please enter a valid positive number.',
    feeRulesReasonRequired: 'Please provide a descriptive reason of at least 4 characters.',
    feeRulesUpdatedSuccess: 'Financial configuration and fee rules updated successfully.',
    feeRulesUpdateError: 'Failed to update platform fee rules.',
    feeRulesConfirmTitle: 'Confirm Fee Rules Mutation',
    feeRulesConfirmDesc: 'These changes update platform commission and service fee engine rules immediately for all new orders.',
    feeRulesConfirmCancel: 'Cancel',
    feeRulesConfirmSubmit: 'Confirm & Apply Rules',

    // Cart & Checkout Resilience
    itemCountSingular: '{count} item',
    itemCountPlural: '{count} items',
    cartUpdatedNotice: 'Some items in your cart were updated to match current menu availability and prices.',
    deliveryFromX: 'Delivery: from {amount}, final at checkout',
    deliveryFeeAtCheckout: 'Delivery fee calculated at checkout',
    estimatedTotal: 'Estimated Total',
    deliveryMinimumNudge: 'Add {amount} more for delivery',
    deliveryMinimumDesc: 'Delivery minimum is {min} • Current: {current}',
    backToMenu: 'Back to Menu',
    switchToTakeaway: 'Switch to Takeaway',
    branchRequired: 'Please select a restaurant branch before checkout.',
    deliveryAddressRequired: 'Please enter a delivery address for your order.',
    deliveryRangeExceeded: 'Delivery location is outside the maximum delivery radius for this branch. Please choose Takeaway.',
    phoneRequired: 'Please enter a contact phone number for mobile money payment.',
    orderFailed: 'Unable to place order. Please try again.',
    deliveryMinimumNotMet: 'Minimum order subtotal not met for delivery.',
    paymentIncomplete: 'Payment was not completed. Your order has been registered as PENDING and you can retry payment anytime.',
    signInToCheckout: 'Sign In to Complete Order',
    signInSubtitle: 'Sign in or create an account in seconds. Your cart stays intact.',
    tabSignIn: 'Sign In',
    tabQuickSignUp: 'Quick Sign Up',
    emailOrPhoneLabel: 'Email or Phone',
    passwordLabel: 'Password',
    fullNameLabel: 'Full Name',
    phoneLabel: 'Phone Number',
    signInBtn: 'Sign In & Continue',
    signUpBtn: 'Create Account & Continue',
    termsAgree: 'I agree to the Terms & Privacy Policy',
    forgotPasswordLink: 'Forgot password?',
  },
  sw: {
    // Tabs
    tabHome: 'Nyumbani',
    tabExplore: 'Gundua',
    tabOrders: 'Oda',
    tabCustom: 'Mlo Maalum',
    tabBookings: 'Nafasi',
    tabAccount: 'Akaunti',
    tabProfile: 'Wasifu',

    // Header
    selectArea: 'Chagua Eneo',
    savedFavorites: 'Vipendwa',
    changeLanguage: 'Kiswahili',
    notifications: 'Taarifa',

    // Hero Section
    eyebrowHero: 'KUGUNDUA VYAKULA, KWA AJILI YAKO',
    heroHeading1: 'Pata mlo unaoleta',
    heroHeading2: 'ladha halisi.',
    heroSub: 'Gundua migahawa ya karibu, linganisha bei na tathmini za wateja, weka nafasi za meza na agiza vyakula nje ya menyu.',
    searchPlaceholder: 'Tafuta chakula, aina ya mapishi, au mgahawa...',
    filterTitle: 'Vichujio vya Haraka:',
    filterWithin3km: 'Chini ya 3 km',
    filterOpenNow: 'Imefunguliwa',
    filterRating4: 'Nyota 4.0+',
    filterBudget: 'Bei Nafuu',
    resetFilters: 'Weka Upya',
    statsRestaurants: 'Migahawa 50+',
    statsRating: 'Nyota 4.8 wastani',
    statsPrices: 'Bei halisi za Kitanzania',

    // Service Cards
    exploreEyebrow: 'ANZA KUGUNDUA',
    exploreTitle: 'Ungependa kufanya nini?',
    serviceNearbyLabel: 'Karibu Nawe',
    serviceNearbyDetail: 'Ndani ya kilomita 3',
    serviceCompareLabel: 'Linganisha Bei',
    serviceCompareDetail: 'Pata ofa bora zaidi',
    serviceReserveLabel: 'Weka Meza',
    serviceReserveDetail: 'Hifadhi nafasi mapema',
    serviceTopRatedLabel: 'Bora Zaidi',
    serviceTopRatedDetail: 'Nyota 4.5+ kutoka wateja',

    // Custom Meal Banner
    customBadge: '♨ MLOHUB PEKEE',
    customBannerHeading: 'Hujaona unachotaka kwenye menyu?',
    customBannerSub: 'Eleza mlo unaoutamani, weka bajeti yako na uruhusu migahawa ya karibu ikutumie ofa bora.',
    step1: 'Eleza',
    step1Desc: 'Mlo wako',
    step2: 'Pata ofa',
    step2Desc: 'Wapishi wanashindana',
    step3: 'Chagua',
    step3Desc: 'Ofa bora',
    startCustomRequest: 'Anza ombi la mlo maalum →',

    // Popular Restaurants
    popularEyebrow: 'KARIBU NA DAR ES SALAAM',
    popularTitle: 'Inayopendwa karibu nawe',
    placesCount: 'sehemu',
    mealsFrom: 'Milo kuanzia',
    reserveBtn: 'Weka Meza',
    viewMenuBtn: 'Angalia Menyu',
    topPickBadge: 'CHAGUO BORA',
    verifiedBadge: 'IMETHIBITISHWA',
    openBadge: 'IMEFUNGULIWA',
    closedBadge: 'IMEFUNGWA',
    noRestaurantsTitle: 'Hakuna mgahawa uliopatikana',
    noRestaurantsMsg: 'Hakuna mgahawa unaolingana na utafutaji wako. Jaribu vyakula vya Asili, Vya Afya, au Burgers.',
    clearFilters: 'Futa vichujio vyote',

    // Why MloHub
    whyEyebrow: 'KWA NINI MLOHUB',
    whyHeading: 'Uchaguzi wako, kwa taarifa za kuaminika.',
    why1Title: 'Bei na Menyu Halisi',
    why1Desc: 'Menyu za kisasa na bei sahihi za TZS kutoka kwenye migahawa iliyothibitishwa.',
    why2Title: 'Tathmini za Wateja',
    why2Desc: 'Maoni ya kweli na tathmini kutoka kwa walaji wa ndani ya jiji.',
    why3Title: 'Mlo Maalum Unaoutaka',
    why3Desc: 'Agiza mlo wowote unaoutamani na wapishi wa karibu watakupa makadirio ya bei.',

    // Explore Screen
    explorePageEyebrow: 'GUNDUA NA LINGANISHA',
    explorePageTitle: 'Gundua Migahawa',
    sortBy: 'Panga kwa:',
    sortTopRated: '★ Nyota za Juu',
    sortDistance: '📍 Umbali',
    sortPrice: '💰 Bei',

    // Custom Meal Screen
    customPageBadge: '♨ OMBI LA MLO MAALUM',
    customPageHeading: 'Hujaona unachotaka kwenye menyu?',
    customPageSub: 'Eleza mlo unaotamani. Wapishi na migahawa ya karibu jijini Dar es Salaam watakutumia ofa zao bora mara moja.',
    submitRequestTitle: 'Tuma Ombi la Mlo Wako',
    cravingLabel: 'Ni chakula gani unachotamani leo?',
    cravingPlaceholder: 'mfano: Samaki wa Kupaka Nazi na wali wa ngano, pilipili kidogo',
    budgetLabel: 'Bajeti Yako (TZS)',
    servingsLabel: 'Idadi ya Watu (Walaji)',
    broadcastBtn: 'Tuma Ombi kwa Wapishi wa Karibu →',
    broadcastSuccessTitle: 'Ombi Limetumwa!',
    broadcastSuccessText: 'Ombi lako la mlo maalum limetumwa kwa migahawa iliyothibitishwa Dar es Salaam.',
    incomingOfferTag: 'Mfano wa Ofa Kutoka kwa Mpishi',
    submitAnotherBtn: 'Tuma Ombi Jingine',

    // Bookings Screen
    bookingsEyebrow: 'NAFASI ZA MEZA',
    bookingsTitle: 'Nafasi Zako',
    upcomingBookingsHeading: 'Meza Zilizothibitishwa Zinazokuja',
    bookNearbyHeading: 'Weka Nafasi kwenye Migahawa ya Karibu',
    bookTableBtn: 'Weka Meza',
    confirmedStatus: 'Imethibitishwa',
    partyLabel: 'Idadi',
    timeLabel: 'Muda',

    // Profile & Customer Menu Editor
    profileRole: 'Mtafiti wa Vyakula Dar es Salaam',
    savedPlacesStat: 'Sehemu Zilizohifadhiwa',
    customMealsStat: 'Milo Maalum',
    bookingsStat: 'Nafasi za Meza',
    customerOrdersEyebrow: 'MFUMO WA MAAGIZO YA MTEJA',
    customerOrdersTitle: '♨ Milo na Menyu Zako Maalum',
    newRequestBtn: '+ Ombi Jipya',
    customerOrdersDesc: 'Unaweza kuhariri vyakula, viungo maalum, idadi na bajeti wakati wowote kabla ya mgahawa kuthibitisha agizo.',
    pendingStatus: '⏳ INASUBIRI UTHIBITISHO',
    confirmedChefStatus: '🔒 IMETHIBITISHWA NA MPISHI',
    editMenuBtn: '✏️ Hariri Menyu / Viungo',
    cancelBtn: '✕ Ghairi',
    menuLockedNotice: '🔒 Menyu Imefungwa (Mapishi Yameanza)',
    simulateChefAccept: 'Jaribu Uthibitisho wa Mpishi',
    resetToPending: 'Rudisha Inasubiri',
    noOrdersTitle: 'Hakuna Maagizo ya Milo Maalum',
    noOrdersSub: 'Una hamu ya chakula kisichopo kwenye menyu ya kawaida? Tuma ombi lako kwa wapishi wa karibu!',
    createFirstRequestBtn: 'Tengeneza Ombi la Mlo Maalum →',

    // Edit Modal
    editModalBadge: 'UNAHARIRI OMBI LINALOSUBIRI',
    editModalTitle: 'Hariri Mlo na Menyu Maalum',
    dishNameLabel: 'Jina la Chakula / Mlo',
    instructionsLabel: 'Maelekezo Maalum ya Mapishi na Viungo',
    instructionsPlaceholder: 'Bainisha viungo, kiasi cha pilipili, vitu vya kuongeza au kuondoa...',
    quickTagsLabel: 'Ongeza Haraka Lebo:',
    diningMethodLabel: 'Aina ya Ulaji / Ufikishaji',
    deliveryOpt: '🛵 Letewa (Delivery)',
    dineInOpt: '🪑 Kula Mgahawani',
    takeawayOpt: '🛍️ Kifurushi (Takeaway)',
    editNoticeText: 'ℹ️ Mabadiliko yanaanza kutumika mara moja kwa wapishi wanaotathmini ombi lako. Yakithibitishwa, yatafungwa kiotomatiki.',
    discardBtn: 'Ghairi Mabadiliko',
    saveMenuBtn: 'Hifadhi na Sasisha Menyu →',
    orderLockedAlertTitle: 'Agizo Limefungwa',
    orderLockedAlertMsg: 'Agizo hili limeshathibitishwa na mpishi. Mabadiliko yamefungwa ili kuhakikisha uandaaji sahihi jikoni.',

    // Preferences
    preferencesTitle: 'Mipangilio na Mapendeleo',
    prefNeighborhood: '📍 Mtaa wa Kula na Kuletewa Chakula',
    prefAlerts: '🔔 Taarifa za Meza kupitia SMS & WhatsApp',
    prefLanguage: '🌐 Lugha / Language',
    prefOnboarding: '📱 Utangulizi wa MloHub (Walkthrough)',
    alertsEnabled: 'Imewezeshwa',

    // Modals General
    selectAreaTitle: 'Chagua Eneo Lako',
    selectAreaSub: 'Gundua sehemu za chakula karibu jijini Dar es Salaam',
    tableReservationTitle: 'Weka Nafasi ya Meza',
    instantReservationSub: 'Nafasi ya papo hapo katika',
    numGuestsLabel: 'Idadi ya Wageni',
    dateLabel: 'Tarehe',
    timeSlotLabel: 'Muda wa Kufika',
    confirmBookingBtn: 'Thibitisha Nafasi ya Meza',
    bookingSuccessTitle: 'Nafasi Imethibitishwa!',
    bookingSuccessMsg: 'Meza yako imehifadhiwa kikamilifu.',
    doneBtn: 'Nimemaliza',

    // Notifications
    notifTitle: 'Taarifa',
    notifMarkAllRead: 'Soma zote',
    notifTabAll: 'Zote',
    notifTabReservations: 'Nafasi',
    notifTabOrders: 'Milo',
    notifTabPayments: 'Malipo',
    notifTabOffers: 'Ofa',
    notifEmptyTitle: 'Hakuna taarifa bado',
    notifEmptySub: 'Taarifa za nafasi za meza, maombi ya chakula, malipo na ofa zitaonekana hapa.',
    notifSettingsTitle: 'Mipangilio ya Taarifa',
    notifSettingsSub: 'Dhibiti taarifa na ujumbe unaopokea kutoka MloHub',
    notifActionViewReservation: 'Tazama Nafasi',
    notifActionViewOrder: 'Tazama Maelezo ya Mlo',
    notifActionViewReceipt: 'Tazama Risiti',
    notifActionRate: 'Tathmini Mgahawa',
    notifActionGetDirections: 'Pata Maelekezo ya Eneo',
    notifActionFindAnother: 'Tafuta Mgahawa Mwingine',
    notifActionRetryPayment: 'Jaribu Kulipa Tena',
    notifSimulateIncoming: '⚡ Jaribu Kupokea Taarifa Mpya',

    // Exact 3-Slide User Onboarding Walkthrough
    onboardingSkip: 'Ruka',
    onboardingBack: 'Rudi',
    onboardingNext: 'Endelea',
    onboardingGetStarted: 'Anza Sasa',
    onboardingStartExploring: 'Anza Kugundua',
    onboardingSlide1Title: 'Gundua\nVyakula Bora\nKaribu Nawe',
    onboardingSlide1Sub: 'Tafuta migahawa, linganisha bei,\nna gundua maeneo bora karibu nawe.',
    onboardingSlide2Title: 'Hifadhi Meza\nkwa Sekunde',
    onboardingSlide2Sub: 'Weka meza kirahisi, dhibiti mipango yako,\nna pokea taarifa za papo hapo.',
    onboardingSlide3Title: 'Agiza Chakula\nkwa Ladha Yako',
    onboardingSlide3Sub: 'Tuma maombi ya chakula maalum, linganisha\nofa, na furahia uzoefu wa kipekee.',

    // One-Screen Welcome Sheet
    welcomeTagline: 'Chakula bora karibu nawe',
    welcomeStartBtn: 'Anza',
    welcomeUseLocationBtn: 'Tumia eneo langu',
    welcomeChooseAreaBtn: 'Chagua eneo badala yake',
    welcomeLanguageLabel: 'Lugha',
    welcomeLocationUnavailable: 'Hatuwezi kupata eneo lako. Chagua eneo lako hapa chini.',
    welcomeCurrentArea: 'Eneo la uwasilishaji:',
    welcomeCloseBtn: 'Funga',

    // Dish Card & Trust System
    trustBadgeVerifiedToday: 'Imethibitishwa Leo',
    trustBadgeConfirmedRecently: 'Imethibitishwa Hivi Karibuni',
    trustBadgeAging: 'Ilikaguliwa Siku 3+ Zilizopita',
    trustBadgeNeedsVerification: 'Inahitaji Uhakiki',
    trustBadgeUnverified: 'Bei Haijathibitishwa',
    trustBadgeUnderReview: 'Bei Inakaguliwa',
    trustBadgeDisputed: 'Bei Inayobishaniwa',

    trustDescVerifiedToday: 'Bei imethibitishwa kuwa sahihi ndani ya saa 24 zilizopita',
    trustDescConfirmedRecently: 'Imethibitishwa kuwa sahihi ndani ya siku 3 zilizopita',
    trustDescAging: 'Ilikaguliwa mara ya mwisho kati ya siku 3 na 7 zilizopita',
    trustDescNeedsVerification: 'Bei haijathibitishwa kwa zaidi ya wiki moja',
    trustDescUnverified: 'Orodha iliwekwa bila ukaguzi wa bei',
    trustDescUnderReview: 'Mteja aliripoti tofauti ya bei hivi karibuni',
    trustDescDisputed: 'Wateja waliripoti tofauti ya bei inayochunguzwa',

    trustIndicatorLabel: 'Kielelezo cha uaminifu',
    trustTapForDetails: 'Gusa kwa maelezo ya uhakiki',

    availableBadge: 'Inapatikana',
    lowStockBadge: 'Imebaki Chache',
    soldOutBadge: 'Imeisha',
    newDishBadge: 'Mpya',

    compareAction: 'Linganisha',
    compareActionActive: 'Linganisha',
    compareActionAccessibility: 'Linganisha',
    addOrderAction: '+ Ongeza',
    addOrderActionAccessibility: 'Weka kwenye agizo',
    mlohubDishPlaceholder: 'Chakula cha MloHub',
    cardAccessibilityAt: 'katika',
    cardAccessibilityAway: 'umbali wa',

    // Restaurant Page & Decision Facts
    factsOpenNow: 'Imefunguliwa',
    factsOpensAt: 'Inafungua saa',
    factsClosed: 'Imefungwa',
    factsNotTakingOrders: 'Haipokei oda kwa sasa',
    factsDeliveryFrom: 'Uwasilishaji kuanzia',
    factsFinalFeeAtCheckout: 'Ada kamili itaonekana wakati wa kulipia',
    factsDeliveryNotAvailable: 'Uwasilishaji haupatikani hapa, chagua Kuchukua',
    factsEstTime: '~Dak {min}',
    factsMinOrder: 'Kiwango cha chini {amount}',
    factsNoMinOrder: 'Bila kima cha chini',
    factsServiceDelivery: 'Uwasilishaji',
    factsServiceTakeaway: 'Kuchukua',
    factsServiceDineIn: 'Kula Ndani',
    factsServiceReservations: 'Kuweka Meza',
    restaurantLoading: 'Inapakia taarifa za mkahawa...',
    restaurantLoadError: 'Hatuwezi kupakia taarifa za mkahawa',
    restaurantRetry: 'Jaribu Tena',
    reserveTableBtn: 'Weka Meza',
    menuAllCategories: 'Zote',
    itemsCount: 'vyakula',
    itemSingularCount: 'chakula',
    mamaNtilie: 'Mama Ntilie',

    // Image Upload & Media
    imageUploadTooLarge: 'Picha inazidi kiwango cha 500 KB baada ya kupunguza ukubwa. Tafadhali chagua picha ndogo.',
    imageUploadFailed: 'Imeshindwa kupakia picha. Tafadhali jaribu tena.',
    imageGalleryPermissionDenied: 'Ruhusa ya kufungua picha haijatolewa.',
    imageCameraPermissionDenied: 'Ruhusa ya kufungua kamera haijatolewa.',

    // Platform Fee Rules
    feeRulesTitle: 'Sheria za Ada za Mfumo',
    feeRulesSubtitle: 'Weka ada ya huduma ya mteja, viwango vya kamisheni kwa aina ya agizo, na siku za msamaha wa mwanzo.',
    feeRulesServiceFeeBps: 'Ada ya Huduma ya Mteja (%)',
    feeRulesServiceFeeBpsHint: 'Asilimia ya jumla ya chakula kwa maagizo ya kuletewa (0-100%, desimali 2)',
    feeRulesServiceFeeMin: 'Kiwango cha Chini cha Ada ya Huduma (TZS)',
    feeRulesServiceFeeMinHint: 'Kiwango cha chini cha ada ya huduma ya kuletewa',
    feeRulesServiceFeeMax: 'Kiwango cha Juu cha Ada ya Huduma (TZS)',
    feeRulesServiceFeeMaxHint: 'Kikomo cha juu cha ada ya huduma ya kuletewa',
    feeRulesDeliveryMinOrder: 'Kiwango cha Chini cha Agizo la Kuletewa (TZS)',
    feeRulesDeliveryMinOrderHint: 'Kiwango cha chini cha chakula kwa maagizo ya kuletewa',
    feeRulesMinOrderTakeaway: 'Kiwango cha Chini cha Agizo (Kuchukua/Kula Hapo) (TZS)',
    feeRulesMinOrderTakeawayHint: 'Kiwango cha chini kwa maagizo yasiyo ya kuletewa',
    feeRulesCommDelivery: 'Kamisheni ya Kuletewa (%)',
    feeRulesCommDeliveryHint: 'Kiwango cha kamisheni kwa maagizo ya kuletewa',
    feeRulesCommTakeaway: 'Kamisheni ya Kuchukua (%)',
    feeRulesCommTakeawayHint: 'Kiwango cha kamisheni kwa maagizo ya kuchukua mwenyewe',
    feeRulesCommDineIn: 'Kamisheni ya Kula Hapo (%)',
    feeRulesCommDineInHint: 'Kiwango cha kamisheni kwa maagizo ya kula hapo mkahawani',
    feeRulesFreeDays: 'Siku za Msamaha kwa Mgahawa Mpya (Siku)',
    feeRulesFreeDaysHint: 'Muda wa bila kamisheni (0%) baada ya mgahawa kuanza',
    feeRulesReasonLabel: 'Sababu ya Mabadiliko (Ukaguzi)',
    feeRulesReasonPlaceholder: 'mfano: Marekebisho yaliyoidhinishwa ya ada',
    feeRulesSaveBtn: 'Hakiki Matokeo na Hifadhi Mabadiliko',
    feeRulesSaving: 'Inahifadhi...',
    feeRulesLiveExampleTitle: 'Mfano Halisi wa Ada na Malipo',
    feeRulesExampleSubtotal: 'Jumla ya Chakula',
    feeRulesExampleServiceFee: 'Ada ya Huduma ya Mteja',
    feeRulesExampleCommission: 'Kamisheni ya Mfumo',
    feeRulesExamplePayout: 'Restaurant food payout',
    feeRulesInvalidPercent: 'Asilimia lazima iwe kati ya 0 na 100 yenye desimali zisizozidi mbili.',
    feeRulesInvalidNumber: 'Tafadhali ingiza nambari sahihi chanya.',
    feeRulesReasonRequired: 'Tafadhali toa sababu ya maelezo yenye herufi zisizopungua 4.',
    feeRulesUpdatedSuccess: 'Sheria za ada zimehifadhiwa kikamilifu.',
    feeRulesUpdateError: 'Imeshindwa kusasisha sheria za ada.',
    feeRulesConfirmTitle: 'Thibitisha Mabadiliko ya Sheria za Ada',
    feeRulesConfirmDesc: 'Mabadiliko haya yatasasisha kamisheni ya mfumo na ada ya huduma mara moja kwa oda zote mpya.',
    feeRulesConfirmCancel: 'Ghairi',
    feeRulesConfirmSubmit: 'Thibitisha & Tumia Sheria',

    // Cart & Checkout Resilience
    itemCountSingular: 'kitu {count}',
    itemCountPlural: 'vitu {count}',
    cartUpdatedNotice: 'Baadhi ya vitu kwenye kikapu chako vimesasishwa kulingana na upatikanaji na bei mpya.',
    deliveryFromX: 'Uwasilishaji: kuanzia {amount}, jumla kamili wakati wa malipo',
    deliveryFeeAtCheckout: 'Gharama ya uwasilishaji huhesabiwa wakati wa malipo',
    estimatedTotal: 'Kadirio la Jumla',
    deliveryMinimumNudge: 'Ongeza {amount} zaidi ili uletewe',
    deliveryMinimumDesc: 'Kiwango cha chini cha kuletewa ni {min} • Sasa: {current}',
    backToMenu: 'Rudi kwenye Menyu',
    switchToTakeaway: 'Badili iwe ya Kuchukua',
    branchRequired: 'Tafadhali chagua tawi la mgahawa kabla ya kulipa.',
    deliveryAddressRequired: 'Tafadhali weka anwani ya kuletewa agizo lako.',
    deliveryRangeExceeded: 'Eneo la kuletewa liko nje ya eneo la huduma la tawi hili. Tafadhali chagua Kuchukua.',
    phoneRequired: 'Tafadhali weka namba ya simu kwa ajili ya malipo ya simu.',
    orderFailed: 'Imeshindwa kuweka agizo. Tafadhali jaribu tena.',
    deliveryMinimumNotMet: 'Kiwango cha chini cha agizo la kuletewa hakijafikiwa.',
    paymentIncomplete: 'Malipo hayakukamilika. Agizo lako limesajiliwa kama LINASUBIRI na unaweza kulipia wakati wowote.',
    signInToCheckout: 'Ingia ili Kukamilisha Agizo',
    signInSubtitle: 'Ingia au fungua akaunti kwa sekunde chache. Kikapu chako kitabaki salama.',
    tabSignIn: 'Ingia',
    tabQuickSignUp: 'Jisajili Haraka',
    emailOrPhoneLabel: 'Barua pepe au Namba ya Simu',
    passwordLabel: 'Nenosiri',
    fullNameLabel: 'Jina Kamili',
    phoneLabel: 'Namba ya Simu',
    signInBtn: 'Ingia & Endelea',
    signUpBtn: 'Fungua Akaunti & Endelea',
    termsAgree: 'Ninakubali Vigezo na Sera ya Faragha',
    forgotPasswordLink: 'Umesahau nenosiri?',
  },
};

export const TRUST_BADGE_LABELS: Record<Language, Record<DishTrustBadgeCode, string>> = {
  en: {
    VERIFIED_TODAY: 'Verified Today',
    CONFIRMED_RECENTLY: 'Confirmed Recently',
    AGING: 'Audited 3+ Days Ago',
    NEEDS_VERIFICATION: 'Needs Verification',
    UNVERIFIED: 'Unverified Price',
    UNDER_REVIEW: 'Price Under Review',
    DISPUTED: 'Disputed Price',
  },
  sw: {
    VERIFIED_TODAY: 'Imethibitishwa Leo',
    CONFIRMED_RECENTLY: 'Imethibitishwa Hivi Karibuni',
    AGING: 'Ilikaguliwa Siku 3+ Zilizopita',
    NEEDS_VERIFICATION: 'Inahitaji Uhakiki',
    UNVERIFIED: 'Bei Haijathibitishwa',
    UNDER_REVIEW: 'Bei Inakaguliwa',
    DISPUTED: 'Bei Inayobishaniwa',
  },
};

export const TRUST_BADGE_EXPLANATIONS: Record<Language, Record<DishTrustBadgeCode, string>> = {
  en: {
    VERIFIED_TODAY: 'Price confirmed accurate within the last 24 hours',
    CONFIRMED_RECENTLY: 'Verified accurate within the last 3 days',
    AGING: 'Last verified between 3 and 7 days ago',
    NEEDS_VERIFICATION: 'Price has not been confirmed in over a week',
    UNVERIFIED: 'Listing imported without manual price audit',
    UNDER_REVIEW: 'A customer recently reported a price difference',
    DISPUTED: 'Customers reported a price mismatch under review',
  },
  sw: {
    VERIFIED_TODAY: 'Bei imethibitishwa kuwa sahihi ndani ya saa 24 zilizopita',
    CONFIRMED_RECENTLY: 'Imethibitishwa kuwa sahihi ndani ya siku 3 zilizopita',
    AGING: 'Ilikaguliwa mara ya mwisho kati ya siku 3 na 7 zilizopita',
    NEEDS_VERIFICATION: 'Bei haijathibitishwa kwa zaidi ya wiki moja',
    UNVERIFIED: 'Orodha iliwekwa bila ukaguzi wa bei',
    UNDER_REVIEW: 'Mteja aliripoti tofauti ya bei hivi karibuni',
    DISPUTED: 'Wateja waliripoti tofauti ya bei inayochunguzwa',
  },
};

export function getTrustBadgeLabel(
  code?: DishTrustBadgeCode | string | null,
  language: Language = 'en'
): string {
  if (!code) return '';
  const key = code as DishTrustBadgeCode;
  return TRUST_BADGE_LABELS[language]?.[key] || TRUST_BADGE_LABELS.en[key] || String(code);
}

export function getTrustBadgeExplanation(
  code?: DishTrustBadgeCode | string | null,
  language: Language = 'en'
): string {
  if (!code) return '';
  const key = code as DishTrustBadgeCode;
  return TRUST_BADGE_EXPLANATIONS[language]?.[key] || TRUST_BADGE_EXPLANATIONS.en[key] || '';
}

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: keyof Translations) => string;
  getTrustBadgeLabel: (code?: DishTrustBadgeCode | string | null) => string;
  getTrustBadgeExplanation: (code?: DishTrustBadgeCode | string | null) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'sw' : 'en'));
  };

  const t = (key: keyof Translations): string => {
    return TRANSLATIONS[language][key] || TRANSLATIONS['en'][key] || String(key);
  };

  const boundGetTrustBadgeLabel = (code?: DishTrustBadgeCode | string | null): string => {
    return getTrustBadgeLabel(code, language);
  };

  const boundGetTrustBadgeExplanation = (code?: DishTrustBadgeCode | string | null): string => {
    return getTrustBadgeExplanation(code, language);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        getTrustBadgeLabel: boundGetTrustBadgeLabel,
        getTrustBadgeExplanation: boundGetTrustBadgeExplanation,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function formatItemCount(count: number, language: Language): string {
  if (language === 'sw') {
    return count === 1 ? 'kitu 1' : `vitu ${count}`;
  }
  return count === 1 ? '1 item' : `${count} items`;
}

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
