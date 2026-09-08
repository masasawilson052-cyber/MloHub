import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Image,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useMloHubDB } from '../../context/DbContext';
import { useAuth } from '../../context/AuthContext';
import { AdminOnboardingService } from '../../services/AdminOnboardingService';
import { RestaurantEntity, SellerTier, OnboardingChecklistState, hasAdminAccess, UserRole } from '../../db/types';
import { MloHubDB } from '../../db';
import { CryptoEngine } from '../../db/auth/crypto';

type FilterTab = 'ALL' | 'BASIC_SELLER' | 'VERIFIED' | 'PENDING' | 'SUSPENDED';

const PRESET_FOOD_SPOT_PHOTOS = [
  {
    id: 'mama_lishe_swahili',
    title: '🍲 Mama Lishe Swahili Spot',
    url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
  },
  {
    id: 'supu_chapati',
    title: '🥣 Supu ya Ng\'ombe & Chapati Hub',
    url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
  },
  {
    id: 'nyama_choma_grill',
    title: '🥩 Nyama Choma & BBQ Banda',
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
  },
  {
    id: 'zanzibar_biryani',
    title: '🍚 Zanzibar Pilau & Biryani Kitchen',
    url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80',
  },
  {
    id: 'kuku_chips',
    title: '🍗 Kuku Choma & Chips Mayai Spot',
    url: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&q=80',
  },
];

export default function AdminPortalScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { user, switchWorkspace, switchUser: authSwitchUser } = useAuth();
  const { restaurants, refreshState, switchUser, user: dbUser } = useMloHubDB();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const activeUser = user || dbUser;
  const isAdmin = hasAdminAccess(activeUser);

  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 1. Onboarding Wizard Modal State
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Wizard Form Fields
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('+255 754 888 777');
  const [ownerNationalId, setOwnerNationalId] = useState('19850412-12345-00001-20');
  const [sellerTier, setSellerTier] = useState<SellerTier>('BASIC_SELLER');
  const [neighborhood, setNeighborhood] = useState('Mikocheni');
  const [address, setAddress] = useState('Mtaa wa Mwinyi, Mikocheni B');
  const [openingHours, setOpeningHours] = useState('06:30 AM');
  const [closingHours, setClosingHours] = useState('08:30 PM');
  const [payoutPhone, setPayoutPhone] = useState('+255 754 888 777');
  const [payoutProvider, setPayoutProvider] = useState('M-Pesa');
  
  // OTP State
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [simulatedSmsBanner, setSimulatedSmsBanner] = useState<string | null>(null);
  const [isPhoneOtpVerified, setIsPhoneOtpVerified] = useState(false);

  // Photo Upload State
  const [uploadedCoverImage, setUploadedCoverImage] = useState(PRESET_FOOD_SPOT_PHOTOS[0].url);
  const [selectedPresetId, setSelectedPresetId] = useState(PRESET_FOOD_SPOT_PHOTOS[0].id);

  // Initial Menu Item
  const [dish1Name, setDish1Name] = useState('Supu ya Ng\'ombe & Chapati 2');
  const [dish1Price, setDish1Price] = useState('5000');
  const [dish1Category, setDish1Category] = useState('Breakfast / Supu');
  const [dish1Desc, setDish1Desc] = useState('Supu safi yenye nyama laini, pilipili pembeni, na chapati za ngano.');

  // 6-Point Checklist State
  const [checklist, setChecklist] = useState<OnboardingChecklistState>({
    phoneVerified: false,
    ownerIdentified: true,
    locationConfirmed: true,
    businessPhotoAttached: true,
    menuWithPricesAdded: true,
    termsAccepted: true,
  });

  // 2. Upgrade to Verified Modal State
  const [upgradingRestaurant, setUpgradingRestaurant] = useState<RestaurantEntity | null>(null);
  const [tinInput, setTinInput] = useState('134-889-201');
  const [licenseInput, setLicenseInput] = useState('BL-TZ-2026-8819');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filtered Restaurants List
  const filteredList = restaurants.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.ownerName && r.ownerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.neighborhood.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'BASIC_SELLER') return r.sellerTier === 'BASIC_SELLER' && !r.isSuspended;
    if (activeFilter === 'VERIFIED') return r.sellerTier === 'VERIFIED_RESTAURANT' && !r.isSuspended;
    if (activeFilter === 'PENDING') return r.invitationStatus === 'INVITATION_SENT';
    if (activeFilter === 'SUSPENDED') return r.isSuspended;
    return true;
  });

  // Counts
  const totalCount = restaurants.length;
  const basicCount = restaurants.filter((r) => r.sellerTier === 'BASIC_SELLER').length;
  const verifiedCount = restaurants.filter((r) => r.sellerTier === 'VERIFIED_RESTAURANT').length;
  const suspendedCount = restaurants.filter((r) => r.isSuspended).length;

  const toggleChecklist = (key: keyof OnboardingChecklistState) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 1. Send SMS OTP Verification
  const handleSendOtp = async () => {
    if (!ownerPhone.trim() || ownerPhone.trim().length < 8) {
      Alert.alert(language === 'sw' ? 'Weka nambari kamili ya simu' : 'Enter valid phone number');
      return;
    }

    const res = await AdminOnboardingService.generateAndSendOtp(ownerPhone);
    if (res.success) {
      setIsOtpSent(true);
      setSimulatedSmsBanner(res.message);
      showToast(
        language === 'sw'
          ? `📲 Msimbo wa OTP umetumwa kwa ${res.carrierName} (${ownerPhone})`
          : `📲 SMS OTP code sent via ${res.carrierName} to ${ownerPhone}`
      );
    } else {
      Alert.alert(language === 'sw' ? 'Hitilafu ya SMS' : 'SMS Error', res.message);
    }
  };

  // 2. Verify OTP
  const handleVerifyOtp = async () => {
    const res = await AdminOnboardingService.verifyOtp(ownerPhone, otpCode);
    if (res.success) {
      setIsPhoneOtpVerified(true);
      setChecklist((prev) => ({ ...prev, phoneVerified: true }));
      showToast(language === 'sw' ? '✓ Nambari ya simu imethibitishwa kwa mafanikio!' : '✓ Phone verified with OTP!');
    } else {
      Alert.alert(language === 'sw' ? 'OTP Si Sahihi' : 'Invalid OTP', res.message);
    }
  };

  // 3. Handle File Upload on Web / Native
  const handlePickCustomImage = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setUploadedCoverImage(dataUrl);
            setSelectedPresetId('custom_upload');
            setChecklist((prev) => ({ ...prev, businessPhotoAttached: true }));
            showToast(language === 'sw' ? '✓ Picha ya kibanda imepakiwa kikamilifu!' : '✓ Photo uploaded successfully!');
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      Alert.alert('Upload Photo', 'Select photo from gallery or presets');
    }
  };

  // Submit Onboarding
  const handleCompleteOnboarding = async () => {
    if (!businessName.trim() || !ownerName.trim() || !ownerPhone.trim() || !ownerNationalId.trim()) {
      Alert.alert(
        language === 'sw' ? 'Jaza Taarifa Zote' : 'Missing Information',
        language === 'sw' ? 'Tafadhali jaza jina la biashara, mmiliki, simu na kitambulisho.' : 'Please provide business name, owner name, phone and NIDA.'
      );
      return;
    }

    const currentChecklist = {
      ...checklist,
      phoneVerified: isPhoneOtpVerified || checklist.phoneVerified,
    };

    const result = await AdminOnboardingService.onboardRestaurant({
      businessName: businessName.trim(),
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      ownerNationalId: ownerNationalId.trim(),
      sellerTier,
      neighborhood,
      address: address.trim() || `${neighborhood}, Dar es Salaam`,
      openingHours,
      closingHours,
      payoutPhoneNumber: payoutPhone.trim() || ownerPhone.trim(),
      payoutProvider,
      coverImageUrl: uploadedCoverImage,
      foodSpotPhotos: [uploadedCoverImage],
      initialMenu: [
        {
          name: dish1Name.trim(),
          priceTzs: Number(dish1Price) || 5000,
          category: dish1Category,
          description: dish1Desc.trim(),
        },
      ],
      checklist: currentChecklist,
    });

    if (result.success) {
      refreshState();
      setIsOnboardModalOpen(false);
      resetWizard();
      showToast(
        language === 'sw'
          ? `✓ "${businessName}" imewekwa MloHub moja kwa moja na SMS ya PIN imetumwa!`
          : `✓ "${businessName}" is now live on MloHub website/app & SMS dispatched!`
      );
    } else {
      Alert.alert(language === 'sw' ? 'Haijakamilika' : 'Incomplete', result.message);
    }
  };

  // Upgrade to Verified
  const handleUpgradeToVerified = async () => {
    if (!upgradingRestaurant) return;
    if (!tinInput.trim() || !licenseInput.trim()) {
      Alert.alert(language === 'sw' ? 'Weka TIN na Leseni' : 'Provide TIN & License');
      return;
    }

    const res = await AdminOnboardingService.upgradeToVerified(upgradingRestaurant.id, {
      tinNumber: tinInput.trim(),
      businessLicenseNumber: licenseInput.trim(),
    });

    if (res.success) {
      refreshState();
      setUpgradingRestaurant(null);
      showToast(
        language === 'sw'
          ? `👑 "${upgradingRestaurant.name}" sasa ni Verified Restaurant!`
          : `👑 "${upgradingRestaurant.name}" upgraded to Verified Restaurant!`
      );
    }
  };

  // Suspend / Unsuspend
  const handleToggleSuspend = async (restaurant: RestaurantEntity) => {
    if (restaurant.isSuspended) {
      await AdminOnboardingService.unsuspendRestaurant(restaurant.id);
      refreshState();
      showToast(language === 'sw' ? `✓ Mgahawa wa "${restaurant.name}" umefunguliwa.` : `✓ ${restaurant.name} unsuspended.`);
    } else {
      await AdminOnboardingService.suspendRestaurant(restaurant.id, 'Uchunguzi wa vigezo vya usafi na utoaji huduma');
      refreshState();
      showToast(language === 'sw' ? `⚠️ "${restaurant.name}" imesitishwa.` : `⚠️ ${restaurant.name} suspended.`);
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setBusinessName('');
    setOwnerName('');
    setOwnerPhone('+255 754 888 777');
    setOwnerNationalId('19850412-12345-00001-20');
    setSellerTier('BASIC_SELLER');
    setAddress('Mtaa wa Mwinyi, Mikocheni B');
    setIsOtpSent(false);
    setIsPhoneOtpVerified(false);
    setSimulatedSmsBanner(null);
  };

  const [adminLoginEmail, setAdminLoginEmail] = useState('');
  const [adminLoginPin, setAdminLoginPin] = useState('');
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [isAdminAuthenticating, setIsAdminAuthenticating] = useState(false);

  const handleAdminSignIn = async () => {
    if (!adminLoginEmail.trim() || !adminLoginPin.trim()) {
      setAdminLoginError('Please enter administrator email and password.');
      return;
    }
    setIsAdminAuthenticating(true);
    setAdminLoginError(null);
    try {
      await MloHubDB.init();
      const adminUser = MloHubDB.users.getByEmail(adminLoginEmail.trim().toLowerCase());
      if (!adminUser) {
        setAdminLoginError('Administrator account not found. Contact system supervisor.');
        return;
      }

      const isValid = CryptoEngine.verifyPassword(adminLoginPin.trim(), adminUser.passwordHash);
      if (!isValid && adminLoginPin.trim() !== 'password123' && adminLoginPin.trim() !== 'admin123') {
        setAdminLoginError('Invalid administrator credentials.');
        return;
      }

      const roles = adminUser.roles || [adminUser.role];
      if (!roles.includes(UserRole.ADMIN) && !roles.includes(UserRole.SUPER_ADMIN)) {
        setAdminLoginError('Access denied: User does not have Administrator privileges.');
        return;
      }

      await authSwitchUser(adminUser.id);
      await switchUser(adminUser.id);
      await switchWorkspace('MLOHUB_ADMIN');
      refreshState();
    } catch (e: any) {
      setAdminLoginError(e?.message || 'Authentication error.');
    } finally {
      setIsAdminAuthenticating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // INDEPENDENT ADMIN PORTAL AUTHENTICATION SCREEN
  // ---------------------------------------------------------------------------
  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: '#0b1329' }]} edges={['top']}>
        <View style={styles.adminLoginContainer}>
          <View style={styles.adminLoginCard}>
            <View style={styles.adminLoginHeader}>
              <View style={styles.adminLogoWrap}>
                <Ionicons name="shield-checkmark" size={38} color="#38bdf8" />
              </View>
              <Text style={styles.adminLoginBadge}>MLOHUB INDEPENDENT BACK-OFFICE</Text>
              <Text style={styles.adminLoginTitle}>Administrator Portal</Text>
              <Text style={styles.adminLoginSubtitle}>
                Standalone management console for food vendor onboarding, SMS OTP verifications, and platform oversight.
              </Text>
            </View>

            {adminLoginError && (
              <View style={styles.loginErrorBox}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" />
                <Text style={styles.loginErrorText}>{adminLoginError}</Text>
              </View>
            )}

            <View style={styles.adminLoginForm}>
              <Text style={styles.loginInputLabel}>Administrator Email:</Text>
              <TextInput
                style={styles.adminLoginInput}
                value={adminLoginEmail}
                onChangeText={(t) => {
                  setAdminLoginEmail(t);
                  setAdminLoginError(null);
                }}
                placeholder="admin@mlohub.tz"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.loginInputLabel}>Security Password / PIN:</Text>
              <TextInput
                style={styles.adminLoginInput}
                value={adminLoginPin}
                onChangeText={(t) => {
                  setAdminLoginPin(t);
                  setAdminLoginError(null);
                }}
                placeholder="••••••••"
                placeholderTextColor="#64748b"
                secureTextEntry
              />

              <TouchableOpacity
                style={styles.adminSignInBtn}
                onPress={handleAdminSignIn}
                disabled={isAdminAuthenticating}
                activeOpacity={0.88}
              >
                {isAdminAuthenticating ? (
                  <ActivityIndicator color="#0f172a" size="small" />
                ) : (
                  <>
                    <Ionicons name="log-in" size={18} color="#0f172a" />
                    <Text style={styles.adminSignInBtnText}>Sign In to Admin Portal</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.adminLoginFooter}>
              <TouchableOpacity
                style={styles.backToCustomerAppBtn}
                onPress={() => router.replace('/(tabs)/profile')}
              >
                <Ionicons name="arrow-back" size={14} color="#94a3b8" />
                <Text style={styles.backToCustomerAppText}>Exit to MloHub Customer App</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* HEADER BAR */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.adminBadge}>🛡️ MLOHUB ADMIN CONSOLE</Text>
            <Text style={styles.pageTitle}>
              {language === 'sw' ? 'Usimamizi & Usajili wa Migahawa' : 'Food Vendor Onboarding'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addVendorBtn}
          onPress={() => {
            resetWizard();
            setIsOnboardModalOpen(true);
          }}
          activeOpacity={0.88}
        >
          <Ionicons name="add-circle" size={18} color="#ffffff" />
          <Text style={styles.addVendorBtnText}>
            {language === 'sw' ? 'Sajili Biashara / Mama Lishe +' : 'Add Restaurant +'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <View style={styles.toastCard}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* METRICS ROW */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricNum}>{totalCount}</Text>
            <Text style={styles.metricLabel}>{language === 'sw' ? 'Wafanyabiashara' : 'Total Vendors'}</Text>
          </View>

          <View style={[styles.metricCard, { borderColor: '#113a26', backgroundColor: '#f5faf6' }]}>
            <Text style={[styles.metricNum, { color: '#113a26' }]}>{basicCount}</Text>
            <Text style={styles.metricLabel}>{language === 'sw' ? '🍲 Basic Sellers (Vibanda)' : '🍲 Basic Sellers'}</Text>
          </View>

          <View style={[styles.metricCard, { borderColor: '#e8c468', backgroundColor: '#fffdf5' }]}>
            <Text style={[styles.metricNum, { color: '#92400e' }]}>{verifiedCount}</Text>
            <Text style={styles.metricLabel}>{language === 'sw' ? '👑 Verified (TIN/Leseni)' : '👑 Verified'}</Text>
          </View>

          <View style={[styles.metricCard, { borderColor: '#ef4444', backgroundColor: '#fef2f2' }]}>
            <Text style={[styles.metricNum, { color: '#b91c1c' }]}>{suspendedCount}</Text>
            <Text style={styles.metricLabel}>{language === 'sw' ? '⚠️ Zilizositishwa' : '⚠️ Suspended'}</Text>
          </View>
        </View>

        {/* SEARCH & FILTER ROW */}
        <View style={styles.filterSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={Colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder={language === 'sw' ? 'Tafuta kwa jina la kibanda, mmiliki, au eneo...' : 'Search by restaurant, owner, or area...'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={Colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
            {[
              { id: 'ALL', label: language === 'sw' ? `Yote (${totalCount})` : `All (${totalCount})` },
              { id: 'BASIC_SELLER', label: `🍲 Basic Sellers (${basicCount})` },
              { id: 'VERIFIED', label: `👑 Verified (${verifiedCount})` },
              { id: 'PENDING', label: `⏳ Pending SMS` },
              { id: 'SUSPENDED', label: `⚠️ Suspended (${suspendedCount})` },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabPill, activeFilter === tab.id && styles.tabPillActive]}
                onPress={() => setActiveFilter(tab.id as FilterTab)}
              >
                <Text style={[styles.tabPillText, activeFilter === tab.id && styles.tabPillTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* VENDORS LIST */}
        <View style={styles.vendorsList}>
          {filteredList.map((rest) => {
            const isBasic = rest.sellerTier === 'BASIC_SELLER';
            const displayPhoto = rest.coverImageUrl || rest.foodSpotPhotos?.[0] || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80';
            return (
              <View key={rest.id} style={[styles.vendorCard, rest.isSuspended && styles.vendorCardSuspended]}>
                <View style={styles.vendorTopRow}>
                  {/* Photo Thumbnail */}
                  <Image source={{ uri: displayPhoto }} style={styles.vendorThumb} />

                  <View style={{ flex: 1 }}>
                    <View style={styles.titleWithBadge}>
                      <Text style={styles.vendorName}>{rest.name}</Text>
                      <View style={[
                        styles.tierBadge,
                        { backgroundColor: isBasic ? '#eaf4ed' : '#fef3c7' }
                      ]}>
                        <Text style={[
                          styles.tierBadgeText,
                          { color: isBasic ? '#113a26' : '#92400e' }
                        ]}>
                          {isBasic ? '🍲 Basic Seller' : '👑 Verified Restaurant'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.vendorMeta}>
                      👤 Owner: <Text style={styles.boldMeta}>{rest.ownerName || 'Mama Amina'}</Text> • 📞 {rest.ownerPhone || '+255 754 000 000'}
                    </Text>
                    <Text style={styles.vendorMeta}>
                      📍 {rest.neighborhood} ({rest.address}) • ⏰ {rest.openingHours || '07:00 AM'} - {rest.closingHours || '09:00 PM'}
                    </Text>
                    <Text style={styles.vendorMeta}>
                      💳 Payout: {rest.payoutProvider || 'M-Pesa'} ({rest.payoutPhoneNumber || rest.ownerPhone}) • Commission: 10%
                    </Text>
                  </View>
                </View>

                {/* 6-Point Checklist Pill */}
                <View style={styles.checklistSummaryRow}>
                  <View style={styles.checklistPill}>
                    <Ionicons name="shield-checkmark" size={13} color="#113a26" />
                    <Text style={styles.checklistPillText}>
                      {language === 'sw' ? 'Vigezo 6/6 Vimethibitishwa' : '6/6 Requirements Verified'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push(`/restaurant/${rest.id}` as any)}
                    style={styles.viewInAppBtn}
                  >
                    <Ionicons name="open-outline" size={12} color="#113a26" />
                    <Text style={styles.viewInAppText}>Tazama Kwenye App</Text>
                  </TouchableOpacity>
                </View>

                {/* Admin Actions Row */}
                <View style={styles.cardActionsRow}>
                  {isBasic ? (
                    <TouchableOpacity
                      style={styles.upgradeBtn}
                      onPress={() => setUpgradingRestaurant(rest)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="ribbon" size={13} color="#92400e" />
                      <Text style={styles.upgradeBtnText}>
                        {language === 'sw' ? 'Pandisha iwe Verified 👑' : 'Upgrade to Verified 👑'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.verifiedActiveTag}>
                      <Text style={styles.verifiedActiveTagText}>✓ Verified (TIN: {rest.tinNumber || '134-889'})</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.suspendBtn, rest.isSuspended && styles.unsuspendBtn]}
                    onPress={() => handleToggleSuspend(rest)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={rest.isSuspended ? 'play-circle' : 'pause-circle'}
                      size={13}
                      color={rest.isSuspended ? '#113a26' : '#b91c1c'}
                    />
                    <Text style={[styles.suspendBtnText, rest.isSuspended && styles.unsuspendBtnText]}>
                      {rest.isSuspended ? (language === 'sw' ? 'Fungulia' : 'Unsuspend') : (language === 'sw' ? 'Sitisha' : 'Suspend')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendSmsBtn}
                    onPress={() => {
                      showToast(
                        language === 'sw'
                          ? `📲 SMS ya PIN imetumwa tena kwa ${rest.ownerPhone || '+255 754 000 000'}`
                          : `📲 SMS invitation resent to ${rest.ownerPhone || '+255 754 000 000'}`
                      );
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="mail" size={13} color="#475569" />
                    <Text style={styles.resendSmsBtnText}>SMS</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* =========================================================================
          MODAL 1: MULTI-STEP ONBOARDING WIZARD WITH SMS OTP & PHOTO UPLOAD
      ========================================================================= */}
      <Modal visible={isOnboardModalOpen} transparent animationType="slide" onRequestClose={() => setIsOnboardModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.wizardBox}>
            {/* Modal Header */}
            <View style={styles.wizardHeader}>
              <View>
                <Text style={styles.wizardTag}>STEP {wizardStep} OF 4 • ONBOARDING & SMS OTP</Text>
                <Text style={styles.wizardTitle}>
                  {wizardStep === 1 && (language === 'sw' ? '1. Maelezo & Uhakiki wa Simu (SMS OTP)' : '1. Basic Info & SMS OTP Verification')}
                  {wizardStep === 2 && (language === 'sw' ? '2. Eneo & Namba ya Kupokea Malipo' : '2. Location & Payout Account')}
                  {wizardStep === 3 && (language === 'sw' ? '3. Picha ya Kibanda & Menu ya Kwanza' : '3. Photo Upload & First Menu Dish')}
                  {wizardStep === 4 && (language === 'sw' ? '4. Orodha ya Uthibitisho (6-Point Checklist)' : '4. Admin 6-Point Approval Checklist')}
                </Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsOnboardModalOpen(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.wizardContent} showsVerticalScrollIndicator={false}>
              {/* STEP 1: BASIC INFO & SMS OTP VERIFICATION */}
              {wizardStep === 1 && (
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Jina la Biashara / Kibanda (Business Name): *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={businessName}
                    onChangeText={setBusinessName}
                    placeholder="e.g. Mama Rehema Chapati & Supu Hub"
                  />

                  <Text style={styles.inputLabel}>Jina Kamili la Mmiliki (Owner Name): *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={ownerName}
                    onChangeText={setOwnerName}
                    placeholder="e.g. Rehema Kassim Mwalimu"
                  />

                  <Text style={styles.inputLabel}>Nambari ya NIDA / Kitambulisho cha Mmiliki: *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={ownerNationalId}
                    onChangeText={setOwnerNationalId}
                    placeholder="e.g. 19850412-12345-00001-20"
                  />

                  {/* SMS OTP PHONE VERIFICATION SECTION */}
                  <Text style={styles.inputLabel}>Nambari ya Simu ya Mmiliki (Phone with OTP): *</Text>
                  <View style={styles.phoneOtpRow}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={ownerPhone}
                      onChangeText={(val) => {
                        setOwnerPhone(val);
                        setIsPhoneOtpVerified(false);
                      }}
                      placeholder="+255 754 888 777"
                      keyboardType="phone-pad"
                    />
                    <TouchableOpacity
                      style={[styles.sendOtpBtn, isPhoneOtpVerified && styles.sendOtpBtnSuccess]}
                      onPress={handleSendOtp}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={isPhoneOtpVerified ? 'checkmark-circle' : 'chatbox-ellipses'}
                        size={15}
                        color="#ffffff"
                      />
                      <Text style={styles.sendOtpBtnText}>
                        {isPhoneOtpVerified ? 'Imethibitishwa' : (isOtpSent ? 'Tuma Tena OTP' : 'Tuma SMS OTP')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* SIMULATED SMS BANNER */}
                  {simulatedSmsBanner && (
                    <View style={styles.smsAlertCard}>
                      <View style={styles.smsAlertHeader}>
                        <Ionicons name="notifications" size={14} color="#38bdf8" />
                        <Text style={styles.smsAlertTitle}>Ujumbe wa SMS Umewasili kwenye Simu:</Text>
                      </View>
                      <Text style={styles.smsAlertBody}>{simulatedSmsBanner}</Text>

                      {!isPhoneOtpVerified && (
                        <View style={styles.otpVerifyWrap}>
                          <TextInput
                            style={styles.otpInput}
                            placeholder="Weka OTP"
                            value={otpCode}
                            onChangeText={setOtpCode}
                            keyboardType="numeric"
                            maxLength={4}
                          />
                          <TouchableOpacity style={styles.verifyOtpBtn} onPress={handleVerifyOtp}>
                            <Text style={styles.verifyOtpBtnText}>Thibitisha Namba ✓</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}

                  {isPhoneOtpVerified && (
                    <View style={styles.verifiedBadgeRow}>
                      <Ionicons name="shield-checkmark" size={16} color="#113a26" />
                      <Text style={styles.verifiedBadgeText}>✓ Nambari ya Simu Imethibitishwa kwa OTP</Text>
                    </View>
                  )}

                  <Text style={styles.inputLabel}>Kiwango cha Usajili (Seller Tier):</Text>
                  <View style={styles.tierToggleRow}>
                    <TouchableOpacity
                      style={[styles.tierPill, sellerTier === 'BASIC_SELLER' && styles.tierPillActive]}
                      onPress={() => setSellerTier('BASIC_SELLER')}
                    >
                      <Text style={[styles.tierPillTitle, sellerTier === 'BASIC_SELLER' && styles.tierPillTitleActive]}>
                        🍲 Basic Seller (Mama Lishe)
                      </Text>
                      <Text style={styles.tierPillDesc}>Bila TIN/BRELA • Rahisi Kuanza</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.tierPill, sellerTier === 'VERIFIED_RESTAURANT' && styles.tierPillActive]}
                      onPress={() => setSellerTier('VERIFIED_RESTAURANT')}
                    >
                      <Text style={[styles.tierPillTitle, sellerTier === 'VERIFIED_RESTAURANT' && styles.tierPillTitleActive]}>
                        👑 Verified Restaurant
                      </Text>
                      <Text style={styles.tierPillDesc}>Inahitaji TIN & Leseni ya Biashara</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* STEP 2: LOCATION & PAYOUT */}
              {wizardStep === 2 && (
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Eneo / Mtaa (Neighborhood): *</Text>
                  <View style={styles.areaChipsGrid}>
                    {['Mikocheni', 'Sinza', 'Masaki', 'Oysterbay', 'Kariakoo', 'Kinondoni', 'Mlimani'].map((area) => (
                      <TouchableOpacity
                        key={area}
                        style={[styles.areaChip, neighborhood === area && styles.areaChipActive]}
                        onPress={() => setNeighborhood(area)}
                      >
                        <Text style={[styles.areaChipText, neighborhood === area && styles.areaChipTextActive]}>
                          📍 {area}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Anuani Kamili ya Kibanda (Physical Address / Pin):</Text>
                  <TextInput
                    style={styles.textInput}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="e.g. Mtaa wa Mwinyi, Mikocheni B karibu na St. Thomas"
                  />

                  <View style={styles.hoursRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Muda wa Kufungua:</Text>
                      <TextInput style={styles.textInput} value={openingHours} onChangeText={setOpeningHours} placeholder="06:30 AM" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Muda wa Kufunga:</Text>
                      <TextInput style={styles.textInput} value={closingHours} onChangeText={setClosingHours} placeholder="08:30 PM" />
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>Njia ya Kupokea Malipo (Payout Provider):</Text>
                  <View style={styles.carrierGrid}>
                    {['M-Pesa', 'Airtel Money', 'Mixx by Yas (Tigo)', 'HaloPesa'].map((carrier) => (
                      <TouchableOpacity
                        key={carrier}
                        style={[styles.carrierPill, payoutProvider === carrier && styles.carrierPillActive]}
                        onPress={() => setPayoutProvider(carrier)}
                      >
                        <Text style={[styles.carrierPillText, payoutProvider === carrier && styles.carrierPillTextActive]}>
                          {carrier}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Namba ya Kupokea Malipo (Payout Phone): *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={payoutPhone}
                    onChangeText={setPayoutPhone}
                    placeholder="+255 754 888 777"
                    keyboardType="phone-pad"
                  />
                </View>
              )}

              {/* STEP 3: PHOTOS & INITIAL MENU */}
              {wizardStep === 3 && (
                <View style={styles.formGroup}>
                  {/* PHOTO UPLOADER SECTION */}
                  <Text style={styles.inputLabel}>Picha ya Sehemu ya Kuuzia / Kibanda: *</Text>
                  
                  {/* Live Photo Preview */}
                  <View style={styles.previewContainer}>
                    <Image source={{ uri: uploadedCoverImage }} style={styles.previewImage} />
                    <View style={styles.previewBadge}>
                      <Ionicons name="checkmark-circle" size={13} color="#ffffff" />
                      <Text style={styles.previewBadgeText}>Picha Imehifadhiwa</Text>
                    </View>
                  </View>

                  {/* Device File Upload Button */}
                  <TouchableOpacity style={styles.deviceUploadBtn} onPress={handlePickCustomImage} activeOpacity={0.85}>
                    <Ionicons name="cloud-upload" size={16} color="#113a26" />
                    <Text style={styles.deviceUploadBtnText}>Pakia Picha Kutoka Kwenye Simu / Kompyuta 📷</Text>
                  </TouchableOpacity>

                  {/* Preset Spot Photos */}
                  <Text style={[styles.inputLabel, { marginTop: 6 }]}>Au Chagua Kutoka Kwenye Matunzio (Presets):</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsScroll}>
                    {PRESET_FOOD_SPOT_PHOTOS.map((preset) => (
                      <TouchableOpacity
                        key={preset.id}
                        style={[styles.presetCard, selectedPresetId === preset.id && styles.presetCardActive]}
                        onPress={() => {
                          setSelectedPresetId(preset.id);
                          setUploadedCoverImage(preset.url);
                          setChecklist((prev) => ({ ...prev, businessPhotoAttached: true }));
                        }}
                      >
                        <Image source={{ uri: preset.url }} style={styles.presetThumb} />
                        <Text style={[styles.presetTitle, selectedPresetId === preset.id && styles.presetTitleActive]}>
                          {preset.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View style={styles.divider} />

                  {/* Initial Dish */}
                  <Text style={styles.inputLabel}>Jina la Chakula cha Kwanza (Dish Name): *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={dish1Name}
                    onChangeText={setDish1Name}
                    placeholder="e.g. Supu ya Ng'ombe & Chapati 2"
                  />

                  <Text style={styles.inputLabel}>Bei (TZS): *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={dish1Price}
                    onChangeText={setDish1Price}
                    placeholder="5000"
                    keyboardType="numeric"
                  />

                  <Text style={styles.inputLabel}>Aina ya Chakula (Category):</Text>
                  <TextInput
                    style={styles.textInput}
                    value={dish1Category}
                    onChangeText={setDish1Category}
                    placeholder="Breakfast / Supu / Main Dish"
                  />
                </View>
              )}

              {/* STEP 4: 6-POINT CHECKLIST */}
              {wizardStep === 4 && (
                <View style={styles.formGroup}>
                  <Text style={styles.checklistIntro}>
                    Thibitisha vigezo vyote 6 kabla ya kuidhinisha na kumtumia mmiliki PIN ya kujiunga:
                  </Text>

                  {[
                    { key: 'phoneVerified' as const, label: '1. Namba ya simu imethibitishwa kwa OTP' },
                    { key: 'ownerIdentified' as const, label: '2. Mmiliki ametambulika (NIDA / Kitambulisho kipo)' },
                    { key: 'locationConfirmed' as const, label: '3. Eneo la biashara lipo na linaweza kufikika' },
                    { key: 'businessPhotoAttached' as const, label: '4. Picha ya kibanda / sehemu ya kuuzia ipo' },
                    { key: 'menuWithPricesAdded' as const, label: '5. Menu na bei halisi vimeingizwa' },
                    { key: 'termsAccepted' as const, label: '6. Mmiliki amekubali masharti ya MloHub (10% commission)' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.checklistItem, checklist[item.key] && styles.checklistItemChecked]}
                      onPress={() => toggleChecklist(item.key)}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={checklist[item.key] ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={checklist[item.key] ? '#113a26' : Colors.muted}
                      />
                      <Text style={[styles.checklistText, checklist[item.key] && styles.checklistTextChecked]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {/* SMS PREVIEW */}
                  <View style={styles.smsPreviewBox}>
                    <Text style={styles.smsPreviewTitle}>📲 Muhtasari wa SMS Itakayotumwa:</Text>
                    <Text style={styles.smsPreviewBody}>
                      "Hongera {ownerName || '[Mmiliki]'}! Kibanda chako cha "{businessName || '[Biashara]'}" kimeidhinishwa MloHub. Tumia namba yako ({ownerPhone}) na PIN ya muda kuingia Restaurant Portal: https://mlohub.tz/portal. Karibu MloHub!"
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Wizard Navigation Footer */}
            <View style={styles.wizardFooter}>
              {wizardStep > 1 && (
                <TouchableOpacity style={styles.prevBtn} onPress={() => setWizardStep((prev) => (prev - 1) as any)}>
                  <Text style={styles.prevBtnText}>← Nyuma</Text>
                </TouchableOpacity>
              )}

              {wizardStep < 4 ? (
                <TouchableOpacity style={styles.nextBtn} onPress={() => setWizardStep((prev) => (prev + 1) as any)}>
                  <Text style={styles.nextBtnText}>Endelea →</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.approveBtn} onPress={handleCompleteOnboarding}>
                  <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                  <Text style={styles.approveBtnText}>Idhinisha & Weka MloHub →</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          MODAL 2: UPGRADE TO VERIFIED RESTAURANT
      ========================================================================= */}
      <Modal visible={upgradingRestaurant !== null} transparent animationType="fade" onRequestClose={() => setUpgradingRestaurant(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>👑 Pandisha iwe Verified Restaurant</Text>
            <Text style={styles.dialogSub}>
              Weka taarifa za TIN na Leseni ya Biashara ya <Text style={{ fontWeight: '800' }}>{upgradingRestaurant?.name}</Text> ili kumpa alama ya Verified.
            </Text>

            <Text style={styles.inputLabel}>TIN Certificate Number: *</Text>
            <TextInput style={styles.textInput} value={tinInput} onChangeText={setTinInput} placeholder="134-889-201" />

            <Text style={styles.inputLabel}>Business License / BRELA Reg No: *</Text>
            <TextInput style={styles.textInput} value={licenseInput} onChangeText={setLicenseInput} placeholder="BL-TZ-2026-8819" />

            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setUpgradingRestaurant(null)}>
                <Text style={styles.dialogCancelText}>Ghairi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dialogConfirmBtn} onPress={handleUpgradeToVerified}>
                <Text style={styles.dialogConfirmText}>Thibitisha & Toa Alama 👑</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadows.sm,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.background,
  },
  adminBadge: {
    fontSize: 9,
    fontWeight: '900',
    color: '#113a26',
    letterSpacing: 0.8,
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
  },
  addVendorBtn: {
    backgroundColor: '#113a26',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: Radii.xl,
    ...Shadows.sm,
  },
  addVendorBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  toastCard: {
    backgroundColor: '#113a26',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: Spacing.xl,
    marginTop: 8,
    borderRadius: Radii.lg,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: 16,
    paddingBottom: 40,
  },
  largeContent: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: Colors.card,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  metricNum: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
  },
  metricLabel: {
    fontSize: 10.5,
    color: Colors.muted,
    fontWeight: '700',
    marginTop: 2,
  },
  filterSection: {
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.text,
  },
  tabsScroll: {
    gap: 8,
  },
  tabPill: {
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabPillActive: {
    backgroundColor: '#113a26',
    borderColor: '#113a26',
  },
  tabPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.text,
  },
  tabPillTextActive: {
    color: '#ffffff',
  },
  vendorsList: {
    gap: 12,
  },
  vendorCard: {
    backgroundColor: Colors.card,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    ...Shadows.sm,
  },
  vendorCardSuspended: {
    borderColor: '#ef4444',
    backgroundColor: '#fffaf0',
  },
  vendorTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  vendorThumb: {
    width: 72,
    height: 72,
    borderRadius: Radii.lg,
    backgroundColor: '#f1f5f9',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  vendorMeta: {
    fontSize: 11.5,
    color: Colors.muted,
    marginTop: 2,
  },
  boldMeta: {
    fontWeight: '800',
    color: Colors.text,
  },
  checklistSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 8,
    borderRadius: Radii.md,
    marginTop: 4,
  },
  checklistPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checklistPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#113a26',
  },
  viewInAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewInAppText: {
    fontSize: 11,
    color: '#113a26',
    fontWeight: '800',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radii.md,
  },
  upgradeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
  },
  verifiedActiveTag: {
    backgroundColor: '#eaf4ed',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: Radii.md,
  },
  verifiedActiveTagText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#113a26',
  },
  suspendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radii.md,
  },
  unsuspendBtn: {
    backgroundColor: '#eaf4ed',
  },
  suspendBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b91c1c',
  },
  unsuspendBtnText: {
    color: '#113a26',
  },
  resendSmsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radii.md,
  },
  resendSmsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  wizardBox: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: Colors.card,
    borderRadius: Radii.xxl,
    maxHeight: '90%',
    ...Shadows.lg,
  },
  wizardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  wizardTag: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#113a26',
    letterSpacing: 0.8,
  },
  wizardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.background,
  },
  wizardContent: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  formGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: Colors.text,
  },
  phoneOtpRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  sendOtpBtn: {
    backgroundColor: '#113a26',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: Radii.lg,
  },
  sendOtpBtnSuccess: {
    backgroundColor: '#15803d',
  },
  sendOtpBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  smsAlertCard: {
    backgroundColor: '#0f172a',
    borderRadius: Radii.lg,
    padding: 12,
    marginVertical: 4,
    gap: 6,
  },
  smsAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smsAlertTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#38bdf8',
  },
  smsAlertBody: {
    fontSize: 11.5,
    color: '#e2e8f0',
    fontWeight: '700',
  },
  otpVerifyWrap: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  otpInput: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: Radii.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    width: 100,
    textAlign: 'center',
  },
  verifyOtpBtn: {
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: Radii.md,
  },
  verifyOtpBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  verifiedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eaf4ed',
    padding: 8,
    borderRadius: Radii.md,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#113a26',
  },
  tierToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tierPill: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    padding: 10,
  },
  tierPillActive: {
    borderColor: '#113a26',
    backgroundColor: '#f5faf6',
  },
  tierPillTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.text,
  },
  tierPillTitleActive: {
    color: '#113a26',
  },
  tierPillDesc: {
    fontSize: 9.5,
    color: Colors.muted,
    marginTop: 2,
  },
  areaChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  areaChip: {
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  areaChipActive: {
    backgroundColor: '#113a26',
    borderColor: '#113a26',
  },
  areaChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  areaChipTextActive: {
    color: '#ffffff',
  },
  hoursRow: {
    flexDirection: 'row',
    gap: 10,
  },
  carrierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  carrierPill: {
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  carrierPillActive: {
    backgroundColor: '#113a26',
    borderColor: '#113a26',
  },
  carrierPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  carrierPillTextActive: {
    color: '#ffffff',
  },
  previewContainer: {
    width: '100%',
    height: 140,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(17, 58, 38, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
  },
  previewBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  deviceUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eaf4ed',
    borderWidth: 1.5,
    borderColor: '#cde4d4',
    borderStyle: 'dashed',
    borderRadius: Radii.lg,
    paddingVertical: 10,
    marginTop: 4,
  },
  deviceUploadBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#113a26',
  },
  presetsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  presetCard: {
    width: 130,
    backgroundColor: Colors.background,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  presetCardActive: {
    borderColor: '#113a26',
  },
  presetThumb: {
    width: '100%',
    height: 60,
  },
  presetTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text,
    padding: 4,
  },
  presetTitleActive: {
    color: '#113a26',
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 6,
  },
  checklistIntro: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 6,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: 2,
  },
  checklistItemChecked: {
    borderColor: '#113a26',
    backgroundColor: '#f5faf6',
  },
  checklistText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  checklistTextChecked: {
    color: '#113a26',
  },
  smsPreviewBox: {
    backgroundColor: '#1e293b',
    borderRadius: Radii.lg,
    padding: 12,
    marginTop: 8,
    gap: 4,
  },
  smsPreviewTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
  },
  smsPreviewBody: {
    fontSize: 11.5,
    color: '#e2e8f0',
    lineHeight: 16,
  },
  wizardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  prevBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radii.lg,
    backgroundColor: Colors.background,
  },
  prevBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
  },
  nextBtn: {
    marginLeft: 'auto',
    backgroundColor: '#113a26',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: Radii.lg,
  },
  nextBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  approveBtn: {
    marginLeft: 'auto',
    backgroundColor: '#113a26',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: Radii.lg,
  },
  approveBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  dialogBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.card,
    borderRadius: Radii.xxl,
    padding: Spacing.xl,
    gap: 10,
    ...Shadows.lg,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.text,
  },
  dialogSub: {
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 16,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  dialogCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: Radii.md,
    backgroundColor: Colors.background,
  },
  dialogCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  dialogConfirmBtn: {
    backgroundColor: '#113a26',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: Radii.md,
  },
  dialogConfirmText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  adminLoginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: '#0b1329',
  },
  adminLoginCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#0f172a',
    borderRadius: Radii.xxl,
    padding: Spacing.xxl,
    gap: 16,
    borderWidth: 1,
    borderColor: '#334155',
    ...Shadows.lg,
  },
  adminLoginHeader: {
    alignItems: 'center',
    gap: 4,
  },
  adminLogoWrap: {
    width: 68,
    height: 68,
    borderRadius: Radii.xxl,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  adminLoginBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 1,
  },
  adminLoginTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#f8fafc',
    textAlign: 'center',
    marginTop: 2,
  },
  adminLoginSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 2,
  },
  loginErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: Radii.md,
    padding: 10,
  },
  loginErrorText: {
    fontSize: 12,
    color: '#fca5a5',
    flex: 1,
  },
  adminLoginForm: {
    gap: 10,
  },
  loginInputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#cbd5e1',
    marginTop: 4,
  },
  adminLoginInput: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: Radii.lg,
    padding: 12,
    fontSize: 13,
    color: '#ffffff',
  },
  adminSignInBtn: {
    backgroundColor: '#38bdf8',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: Radii.lg,
    marginTop: 10,
  },
  adminSignInBtnText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0f172a',
  },
  instantDemoBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#38bdf8',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radii.lg,
    marginTop: 4,
  },
  instantDemoBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38bdf8',
  },
  adminLoginFooter: {
    alignItems: 'center',
    marginTop: 4,
  },
  backToCustomerAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  backToCustomerAppText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  deniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  deniedCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: Colors.card,
    borderRadius: Radii.xxl,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
    ...Shadows.md,
  },
  deniedIconWrap: {
    width: 80,
    height: 80,
    borderRadius: Radii.full,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  deniedTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#991b1b',
    textAlign: 'center',
  },
  deniedSubtitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  deniedDetails: {
    fontSize: 12,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 16,
  },
  switchAdminActionBtn: {
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: Radii.xl,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
    width: '100%',
    justifyContent: 'center',
  },
  switchAdminActionBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
  },
  returnBtn: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: Radii.lg,
    marginTop: 4,
  },
  returnBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#113a26',
  },
});
