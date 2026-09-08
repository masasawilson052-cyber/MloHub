import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { LocationModal } from '../../components/LocationModal';
import { LanguageModal } from '../../components/LanguageModal';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useNotifications } from '../../context/NotificationContext';
import { useMloHubDB } from '../../context/DbContext';
import { useAuth } from '../../context/AuthContext';
import { CustomMealRequestEntity, UserRole, hasAdminAccess } from '../../db';

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, activeWorkspace, authorizedWorkspaces, switchWorkspace, switchUser: authSwitchUser } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { t, language, setLanguage } = useLanguage();
  const { unreadCount } = useNotifications();
  const {
    user,
    users,
    updateUser,
    customOrders,
    restaurants,
    reservations,
    notifications,
    favorites,
    switchUser,
    updateCustomOrder,
    deleteCustomOrder,
    resetDatabase,
    refreshState,
  } = useMloHubDB();

  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isSwitchWorkspaceModalOpen, setIsSwitchWorkspaceModalOpen] = useState(false);

  // Profile Edit Form State
  const [editFullName, setEditFullName] = useState(user?.fullName || 'Frank Mlaki');
  const [editEmail, setEditEmail] = useState(user?.email || 'frank.mlaki@mlohub.tz');
  const [editPhone, setEditPhone] = useState(user?.phone || '+255 754 123 456');
  const [editLocation, setEditLocation] = useState(user?.location || 'Mikocheni B, Dar es Salaam');
  const [editPin, setEditPin] = useState(user?.securityPin || '1234');
  const [editCompany, setEditCompany] = useState(user?.companyOrGroup || 'Dar Tech Labs (10 Staff)');
  const [editDietary, setEditDietary] = useState(user?.dietaryPreferences?.join(', ') || 'High Protein, Low Oil');

  // Meal Editing State
  const [editingOrder, setEditingOrder] = useState<CustomMealRequestEntity | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Edit Meal Form Fields
  const [editDishName, setEditDishName] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editServings, setEditServings] = useState('2');
  const [editDiningOption, setEditDiningOption] = useState<'Delivery' | 'Dine-In' | 'Takeaway'>('Delivery');

  const presetTags = language === 'sw'
    ? ['Pilipili Kidogo', 'Mchuzi Zaidi', 'Bila Vitunguu', 'Bila Gluten', 'Mafuta Kidogo', 'Iive Vizuri']
    : ['Less Spicy', 'Extra Sauce', 'No Onions', 'Gluten-Free', 'Less Oil', 'Well Done'];

  const favoriteRestaurants = restaurants.filter((r) => favorites.includes(r.id));
  const activeRestaurant = restaurants.find((r) => r.id === user?.activeRestaurantId) || restaurants[0];

  // RBAC Admin Access Flag (Strict: roles.includes('ADMIN') || roles.includes('SUPER_ADMIN'))
  const isAdminUser = hasAdminAccess(user);

  // Open Profile Edit Modal
  const handleOpenProfileEdit = () => {
    setEditFullName(user?.fullName || '');
    setEditEmail(user?.email || '');
    setEditPhone(user?.phone || '');
    setEditLocation(user?.location || '');
    setEditPin(user?.securityPin || '1234');
    setEditCompany(user?.companyOrGroup || '');
    setEditDietary(user?.dietaryPreferences?.join(', ') || '');
    setIsProfileEditOpen(true);
  };

  // Save Profile Credentials
  const handleSaveProfile = async () => {
    if (!editFullName.trim() || !editPhone.trim()) {
      const err = language === 'sw' ? 'Tafadhali jaza jina na namba ya simu.' : 'Please enter your full name and phone number.';
      Platform.OS === 'web' ? window.alert(err) : Alert.alert('Required Fields', err);
      return;
    }

    const dietaryArr = editDietary
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    await updateUser({
      fullName: editFullName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      location: editLocation.trim(),
      securityPin: editPin.trim(),
      companyOrGroup: editCompany.trim(),
      dietaryPreferences: dietaryArr,
    });

    setIsProfileEditOpen(false);
    const toast = language === 'sw'
      ? '✓ Wasifu na taarifa za kuingia zimesasishwa!'
      : '✓ Profile and login credentials updated!';
    setSuccessToast(toast);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Switch Workspace Handler (Authorized only)
  const handleSwitchWorkspace = async (ws: { type: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN'; restaurantId?: string; name: string }) => {
    try {
      await switchWorkspace(ws.type, ws.restaurantId);
      setIsSwitchWorkspaceModalOpen(false);
      const toast = language === 'sw'
        ? `✓ Mazingira ya kazi: ${ws.name}`
        : `✓ Switched to workspace: ${ws.name}`;
      setSuccessToast(toast);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (e: any) {
      Alert.alert('Permission Denied', e?.message || 'Cannot switch to this workspace.');
    }
  };

  // Open Edit Platform Modal
  const handleOpenEdit = (order: CustomMealRequestEntity) => {
    if (order.status === 'Confirmed') {
      const msg = t('orderLockedAlertMsg');
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert(t('orderLockedAlertTitle'), msg);
      }
      return;
    }

    setEditingOrder(order);
    setEditDishName(order.dishName);
    setEditInstructions(order.specialInstructions);
    setEditBudget(order.budgetTzs.toString());
    setEditServings(order.servingsCount);
    setEditDiningOption(order.diningOption);
  };

  // Save Customer Menu Edits into Database
  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    if (!editDishName.trim()) {
      const err = language === 'sw' ? 'Tafadhali weka jina la chakula.' : 'Please enter a meal title.';
      Platform.OS === 'web' ? window.alert(err) : Alert.alert('Missing Field', err);
      return;
    }

    await updateCustomOrder(editingOrder.id, {
      dishName: editDishName.trim(),
      specialInstructions: editInstructions.trim(),
      budgetTzs: Number(editBudget) || editingOrder.budgetTzs,
      servingsCount: editServings,
      diningOption: editDiningOption,
      statusMessageEn: 'Menu updated by you • Awaiting restaurant confirmation',
      statusMessageSw: 'Menyu imesasishwa na wewe • Inasubiri uthibitisho wa mgahawa',
    });

    const toastMsg = language === 'sw'
      ? `✓ Menyu ya agizo ${editingOrder.orderNumber} imesasishwa kwenye Database!`
      : `✓ Menu updated for order ${editingOrder.orderNumber} in Database!`;
    setSuccessToast(toastMsg);
    setEditingOrder(null);

    setTimeout(() => {
      setSuccessToast(null);
    }, 4500);
  };

  // Toggle Order Status in DB for Simulation
  const handleToggleStatus = async (order: CustomMealRequestEntity) => {
    const nextStatus = order.status === 'Pending Confirmation' ? 'Confirmed' : 'Pending Confirmation';
    await updateCustomOrder(order.id, {
      status: nextStatus,
    });
  };

  // Cancel Unconfirmed Order from DB
  const handleCancelOrder = (id: string) => {
    const doCancel = async () => {
      await deleteCustomOrder(id);
      setSuccessToast(language === 'sw' ? '✓ Ombi la mlo maalum limefutwa kwenye database.' : '✓ Custom meal request was cancelled from database.');
      setTimeout(() => setSuccessToast(null), 3500);
    };

    const confirmMsg = language === 'sw'
      ? 'Je, una uhakika unataka kughairi ombi hili la mlo maalum?'
      : 'Are you sure you want to cancel this custom meal request?';

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        doCancel();
      }
    } else {
      Alert.alert(
        language === 'sw' ? 'Ghairi Ombi' : 'Cancel Request',
        confirmMsg,
        [
          { text: language === 'sw' ? 'Baki Nalo' : 'Keep Order', style: 'cancel' },
          { text: language === 'sw' ? 'Ghairi' : 'Cancel Order', style: 'destructive', onPress: doCancel },
        ]
      );
    }
  };

  const handleAddPresetTag = (tag: string) => {
    setEditInstructions((prev) => (prev ? `${prev}, ${tag}` : tag));
  };

  const handleResetDB = async () => {
    const confirmReset = () => {
      resetDatabase();
      setSuccessToast(language === 'sw' ? '✓ MloHub Database imewekwa upya!' : '✓ MloHub Database reset to default seed!');
      setTimeout(() => setSuccessToast(null), 3500);
      setIsDbModalOpen(false);
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Reset MloHub database and re-seed with fresh Dar es Salaam data?')) {
        confirmReset();
      }
    } else {
      Alert.alert(
        'Reset Database',
        'Reset MloHub database and re-seed with fresh Dar es Salaam data?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: confirmReset },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Toast Notification */}
      {successToast && (
        <View style={styles.toastCard}>
          <Text style={styles.toastText}>{successToast}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* =========================================================================
            1. ONE UNIFIED PROFILE & LOGIN CREDENTIALS CARD
        ========================================================================= */}
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarIcon}>{user?.avatarEmoji || '👤'}</Text>
            </View>

            <View style={styles.profileInfoWrap}>
              <View style={styles.nameBadgeRow}>
                <Text style={styles.userName}>{user?.fullName || 'Frank Mlaki'}</Text>
                <View style={[
                  styles.roleBadge,
                  activeWorkspace === 'MLOHUB_ADMIN' && { backgroundColor: '#e0f2fe' },
                  activeWorkspace === 'RESTAURANT_OWNER' && { backgroundColor: '#fef3c7' }
                ]}>
                  <Text style={[
                    styles.roleBadgeText,
                    activeWorkspace === 'MLOHUB_ADMIN' && { color: '#0369a1' },
                    activeWorkspace === 'RESTAURANT_OWNER' && { color: '#92400e' }
                  ]}>
                    {activeWorkspace === 'MLOHUB_ADMIN'
                      ? '🛡️ MLOHUB ADMIN'
                      : activeWorkspace === 'RESTAURANT_OWNER'
                      ? '👑 RESTAURANT OWNER'
                      : '👤 CUSTOMER (DINER)'}
                  </Text>
                </View>
              </View>

              <Text style={styles.userEmail}>{user?.email || 'frank.mlaki@mlohub.tz'}</Text>
              <Text style={styles.userPhone}>📱 {user?.phone || '+255 754 123 456'}</Text>
            </View>
          </View>

          {/* Quick Credential Chips */}
          <View style={styles.credentialsGrid}>
            <View style={styles.credBox}>
              <Text style={styles.credLabel}>📍 {language === 'sw' ? 'Mtaa / Eneo:' : 'Delivery Area:'}</Text>
              <Text style={styles.credVal}>{user?.location || 'Mikocheni B, Dar es Salaam'}</Text>
            </View>
            <View style={styles.credBox}>
              <Text style={styles.credLabel}>🏢 {language === 'sw' ? 'Kikundi / Ofisi:' : 'Group / Persona:'}</Text>
              <Text style={styles.credVal}>{user?.companyOrGroup || 'Corporate Lunch (10 Staff)'}</Text>
            </View>
            <View style={styles.credBox}>
              <Text style={styles.credLabel}>🔒 {language === 'sw' ? 'PIN ya Usalama:' : 'Security PIN:'}</Text>
              <Text style={styles.credVal}>•••• (PIN {user?.securityPin || '1234'})</Text>
            </View>
            <View style={styles.credBox}>
              <Text style={styles.credLabel}>🥗 {language === 'sw' ? 'Mapishi ya Afya:' : 'Dietary Goals:'}</Text>
              <Text style={styles.credVal}>
                {user?.dietaryPreferences?.slice(0, 2).join(', ') || 'High Protein'}
              </Text>
            </View>
          </View>

          {/* Action Buttons: Edit Credentials & Switch Workspace */}
          <View style={styles.profileActionsRow}>
            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={handleOpenProfileEdit}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={15} color="#113a26" />
              <Text style={styles.editProfileBtnText}>
                {language === 'sw' ? 'Hariri Wasifu' : 'Edit Profile'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchUserBtn}
              onPress={() => setIsSwitchWorkspaceModalOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="briefcase-outline" size={15} color="#ffffff" />
              <Text style={styles.switchUserBtnText}>
                {language === 'sw' ? 'Badili Mazingira (Workspace)' : 'Switch Workspace'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* =========================================================================
            2. WORKSPACE 1: CUSTOMER WORKSPACE VIEW
        ========================================================================= */}
        {activeWorkspace === 'CUSTOMER' && (
          <>
            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{favoriteRestaurants.length}</Text>
                <Text style={styles.statLabel}>{t('savedPlacesStat')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{customOrders.length}</Text>
                <Text style={styles.statLabel}>{t('customMealsStat')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{reservations.length}</Text>
                <Text style={styles.statLabel}>{t('bookingsStat')}</Text>
              </View>
            </View>

            {/* Quick Notifications Center Shortcut */}
            <TouchableOpacity
              style={styles.notifShortcutCard}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.8}
            >
              <View style={styles.notifShortcutLeft}>
                <View style={styles.notifIconWrap}>
                  <Ionicons name="notifications" size={20} color={Colors.primary} />
                  {unreadCount > 0 && (
                    <View style={styles.notifDotWrap}>
                      <Text style={styles.notifDotText}>{unreadCount}</Text>
                    </View>
                  )}
                </View>
                <View>
                  <Text style={styles.notifShortcutTitle}>{t('notifTitle')}</Text>
                  <Text style={styles.notifShortcutSub}>
                    {unreadCount > 0
                      ? language === 'sw' ? `Una taarifa ${unreadCount} mpya` : `You have ${unreadCount} new alerts`
                      : language === 'sw' ? 'Tazama historia ya taarifa' : 'View notification history'}
                  </Text>
                </View>
              </View>
              <Text style={styles.chevronText}>›</Text>
            </TouchableOpacity>

            {/* CUSTOM MEAL EDITING PLATFORM SECTION */}
            <View style={styles.sectionHeaderWrap}>
              <View>
                <Text style={styles.sectionEyebrow}>{t('customerOrdersEyebrow')}</Text>
                <Text style={styles.sectionTitle}>{t('customerOrdersTitle')}</Text>
              </View>
              <TouchableOpacity
                style={styles.newRequestBtn}
                onPress={() => router.push('/(tabs)/custom')}
              >
                <Text style={styles.newRequestBtnText}>{t('newRequestBtn')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionDescription}>
              {t('customerOrdersDesc')}
            </Text>

            {/* CUSTOM ORDERS LIST */}
            {customOrders.length > 0 ? (
              customOrders.map((order) => {
                const isPending = order.status === 'Pending Confirmation';
                const statusMsg = language === 'sw' ? order.statusMessageSw : order.statusMessageEn;

                return (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderCardHeader}>
                      <View style={styles.orderTitleBox}>
                        <Text style={styles.orderNumberText}>{order.orderNumber}</Text>
                        <Text style={styles.dishNameText}>{order.dishName}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: isPending ? '#fef3c7' : '#eaf4ed',
                            borderColor: isPending ? '#d97706' : '#113a26',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: isPending ? '#92400e' : '#113a26' },
                          ]}
                        >
                          {isPending ? (language === 'sw' ? 'Inasubiri' : 'Pending Confirmation') : (language === 'sw' ? 'Imethibitishwa' : 'Confirmed')}
                        </Text>
                      </View>
                    </View>

                    {order.specialInstructions ? (
                      <View style={styles.instructionsBox}>
                        <Text style={styles.instructionsLabel}>
                          {language === 'sw' ? 'Viungo Maalum & Maelekezo:' : 'Custom Ingredients & Cooking Notes:'}
                        </Text>
                        <Text style={styles.instructionsText}>{order.specialInstructions}</Text>
                      </View>
                    ) : null}

                    <View style={styles.orderMetricsRow}>
                      <Text style={styles.metricItem}>
                        💰 TZS {order.budgetTzs.toLocaleString()}
                      </Text>
                      <Text style={styles.metricItem}>
                        👥 {order.servingsCount} {language === 'sw' ? 'Watu' : 'Servings'}
                      </Text>
                      <Text style={styles.metricItem}>
                        🛵 {order.diningOption}
                      </Text>
                    </View>

                    <View style={styles.statusNoticeBox}>
                      <Text style={styles.statusNoticeText}>{statusMsg}</Text>
                    </View>

                    <View style={styles.orderActionsRow}>
                      {isPending ? (
                        <TouchableOpacity
                          style={styles.editMenuBtn}
                          onPress={() => handleOpenEdit(order)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.editMenuBtnText}>{t('editMenuBtn')}</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.lockedNoticeBtn}>
                          <Text style={styles.lockedNoticeText}>{t('menuLockedNotice')}</Text>
                        </View>
                      )}

                      {isPending && (
                        <TouchableOpacity
                          style={styles.cancelOrderBtn}
                          onPress={() => handleCancelOrder(order.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.cancelOrderBtnText}>{t('cancelBtn')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyOrdersBox}>
                <Text style={styles.emptyIcon}>🍽️</Text>
                <Text style={styles.emptyTitle}>{t('noOrdersTitle')}</Text>
                <Text style={styles.emptySub}>{t('noOrdersSub')}</Text>
                <TouchableOpacity
                  style={styles.emptyCtaBtn}
                  onPress={() => router.push('/(tabs)/custom')}
                >
                  <Text style={styles.emptyCtaBtnText}>
                    {language === 'sw' ? 'Weka Ombi la Kwanza la Mlo' : 'Create Your First Custom Meal'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* =========================================================================
            3. WORKSPACE 2: RESTAURANT OWNER WORKSPACE VIEW
        ========================================================================= */}
        {activeWorkspace === 'RESTAURANT_OWNER' && (
          <>
            {/* RESTAURANT & SPECIALIST CHEF PORTAL GATEWAY */}
            <TouchableOpacity
              style={styles.chefPortalBanner}
              onPress={() => router.push('/restaurant-portal')}
              activeOpacity={0.85}
            >
              <View style={styles.chefBannerLeft}>
                <View style={styles.chefCrownIcon}>
                  <Text style={{ fontSize: 22 }}>👑</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.chefBadgeRow}>
                    <Text style={styles.chefBannerTitle}>
                      {language === 'sw' ? 'Jukwaa la Mgahawa & Mpishi' : 'Restaurant & Chef Portal'}
                    </Text>
                    <View style={styles.proTag}>
                      <Text style={styles.proTagText}>PRO</Text>
                    </View>
                  </View>
                  <Text style={styles.chefBannerSub}>
                    {language === 'sw'
                      ? 'Dhibiti maagizo yanayoingia, foleni ya jikoni, menyu ya chakula, na mapato ya leo.'
                      : 'Manage incoming orders, kitchen kanban queue, dish availability, and daily revenue.'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#e8c468" />
            </TouchableOpacity>

            {/* Quick Kitchen Shortcuts Grid */}
            <View style={styles.restaurantShortcutsGrid}>
              <TouchableOpacity
                style={styles.shortcutCard}
                onPress={() => router.push('/restaurant-portal')}
              >
                <Ionicons name="bag-handle" size={20} color="#0d9488" />
                <Text style={styles.shortcutTitle}>Incoming Orders</Text>
                <Text style={styles.shortcutSub}>Accept or reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shortcutCard}
                onPress={() => router.push('/restaurant-portal')}
              >
                <Ionicons name="flame" size={20} color="#ea580c" />
                <Text style={styles.shortcutTitle}>Kitchen Queue</Text>
                <Text style={styles.shortcutSub}>Timer & Prep</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shortcutCard}
                onPress={() => router.push('/restaurant-portal')}
              >
                <Ionicons name="restaurant" size={20} color="#16a34a" />
                <Text style={styles.shortcutTitle}>Menu & Stock</Text>
                <Text style={styles.shortcutSub}>Manage items</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shortcutCard}
                onPress={() => router.push('/restaurant-portal')}
              >
                <Ionicons name="wallet" size={20} color="#0f766e" />
                <Text style={styles.shortcutTitle}>Earnings</Text>
                <Text style={styles.shortcutSub}>Daily payouts</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* =========================================================================
            4. WORKSPACE 3: MLOHUB ADMIN WORKSPACE VIEW (Strict Admin Only)
        ========================================================================= */}
        {activeWorkspace === 'MLOHUB_ADMIN' && isAdminUser && (
          <>
            {/* ADMIN PORTAL: ONBOARD VENDORS & VERIFICATION */}
            <TouchableOpacity
              style={[styles.chefPortalBanner, { backgroundColor: '#0f172a', borderColor: '#334155' }]}
              onPress={() => router.push('/admin' as any)}
              activeOpacity={0.85}
            >
              <View style={styles.chefBannerLeft}>
                <View style={[styles.chefCrownIcon, { backgroundColor: '#1e293b' }]}>
                  <Text style={{ fontSize: 22 }}>🛡️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.chefBadgeRow}>
                    <Text style={[styles.chefBannerTitle, { color: '#f8fafc' }]}>
                      {language === 'sw' ? 'Admin: Sajili Biashara & Mama Lishe' : 'Admin: Food Vendor Onboarding'}
                    </Text>
                    <View style={[styles.proTag, { backgroundColor: '#38bdf8' }]}>
                      <Text style={[styles.proTagText, { color: '#0f172a' }]}>SUPER ADMIN</Text>
                    </View>
                  </View>
                  <Text style={[styles.chefBannerSub, { color: '#94a3b8' }]}>
                    {language === 'sw'
                      ? 'Sajili Mama Lishe kwa vigezo 6 rahisi, tuma SMS za PIN, na thibitisha migahawa.'
                      : 'Onboard informal food vendors with 6-point checklist, send SMS PIN invitations & verify restaurants.'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#38bdf8" />
            </TouchableOpacity>

            {/* Admin Controls Grid */}
            <View style={styles.restaurantShortcutsGrid}>
              <TouchableOpacity style={styles.shortcutCard} onPress={() => router.push('/admin' as any)}>
                <Ionicons name="add-circle" size={20} color="#0284c7" />
                <Text style={styles.shortcutTitle}>Onboard Vendor</Text>
                <Text style={styles.shortcutSub}>6-point checklist</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shortcutCard} onPress={() => router.push('/admin' as any)}>
                <Ionicons name="ribbon" size={20} color="#d97706" />
                <Text style={styles.shortcutTitle}>2-Tier Upgrades</Text>
                <Text style={styles.shortcutSub}>TIN & BRELA</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shortcutCard} onPress={() => router.push('/admin' as any)}>
                <Ionicons name="shield-checkmark" size={20} color="#059669" />
                <Text style={styles.shortcutTitle}>Audit Logs</Text>
                <Text style={styles.shortcutSub}>Security trail</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shortcutCard} onPress={() => router.push('/admin' as any)}>
                <Ionicons name="card" size={20} color="#6366f1" />
                <Text style={styles.shortcutTitle}>Commissions</Text>
                <Text style={styles.shortcutSub}>10% Platform fee</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* =========================================================================
            5. GENERAL SETTINGS & DATABASE CONTROLS
        ========================================================================= */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>
            {language === 'sw' ? 'Mipangilio ya Akaunti' : 'Account & App Settings'}
          </Text>

          {/* Location Setting */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setIsLocationModalOpen(true)}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="location-outline" size={18} color={Colors.text} />
              <Text style={styles.settingLabel}>
                {language === 'sw' ? 'Anuani ya Kufikishiwa' : 'Delivery Address'}
              </Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValueText}>{user?.location || 'Dar es Salaam'}</Text>
              <Text style={styles.chevronText}>›</Text>
            </View>
          </TouchableOpacity>

          {/* Language Setting */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setIsLanguageModalOpen(true)}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="globe-outline" size={18} color={Colors.text} />
              <Text style={styles.settingLabel}>
                {language === 'sw' ? 'Lugha ya MloHub' : 'App Language'}
              </Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValueText}>
                {language === 'sw' ? '🇹🇿 Kiswahili' : '🇬🇧 English'}
              </Text>
              <Text style={styles.chevronText}>›</Text>
            </View>
          </TouchableOpacity>

          {/* Database Reset */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleResetDB}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="refresh-circle-outline" size={18} color={Colors.text} />
              <Text style={styles.settingLabel}>
                {language === 'sw' ? 'Weka Upya Database (Reset DB)' : 'Reset Demo Database'}
              </Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValueText, { color: Colors.muted }]}>MloHub v2</Text>
              <Text style={styles.chevronText}>›</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* =========================================================================
          MODAL 1: SWITCH WORKSPACE (AUTHORIZED WORKSPACES ONLY)
      ========================================================================= */}
      <Modal
        visible={isSwitchWorkspaceModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSwitchWorkspaceModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalBadge}>
                  {language === 'sw' ? 'UDHIBITI WA MAZINGIRA YA KAZI' : 'AUTHORIZED WORKSPACES'}
                </Text>
                <Text style={styles.modalTitle}>
                  {language === 'sw' ? 'Badili Mazingira ya Kazi' : 'Switch Workspace'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsSwitchWorkspaceModalOpen(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalIntroText}>
              {language === 'sw'
                ? 'Chagua mazingira ya kazi yaliyothibitishwa kwa akaunti yako:'
                : 'Select an authorized workspace associated with your account:'}
            </Text>

            <ScrollView style={styles.modalScroll}>
              <Text style={[styles.modalInputLabel, { marginTop: 4, marginBottom: 6 }]}>
                {language === 'sw' ? 'Mazingira Yako (Workspaces):' : 'Your Workspaces:'}
              </Text>
              {authorizedWorkspaces.map((ws) => {
                const isCurrent = activeWorkspace === ws.type;
                return (
                  <TouchableOpacity
                    key={`${ws.type}-${ws.restaurantId || 'main'}`}
                    style={[styles.userOptionCard, isCurrent && styles.userOptionCardActive]}
                    onPress={() => handleSwitchWorkspace(ws)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.wsIconCircle}>
                      <Ionicons name={ws.icon as any} size={20} color="#113a26" />
                    </View>
                    <View style={styles.userOptionInfo}>
                      <View style={styles.userOptionNameRow}>
                        <Text style={styles.userOptionName}>{ws.name}</Text>
                        {isCurrent && (
                          <View style={styles.activeTag}>
                            <Text style={styles.activeTagText}>Active</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.userOptionRole}>{ws.subtitle}</Text>
                    </View>
                    <Ionicons
                      name={isCurrent ? 'checkmark-circle' : 'chevron-forward'}
                      size={18}
                      color={isCurrent ? '#113a26' : '#94a3b8'}
                    />
                  </TouchableOpacity>
                );
              })}

              <Text style={[styles.modalInputLabel, { marginTop: 16, marginBottom: 6 }]}>
                {language === 'sw' ? 'Badili Mtumiaji (Switch Demo Account):' : 'Switch Demo Account / Persona:'}
              </Text>
              {users.map((u) => {
                const isCurrent = user?.id === u.id;
                const isAdmin = hasAdminAccess(u);
                const isOwner = (u.roles || [u.role]).includes(UserRole.RESTAURANT_OWNER);
                return (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.userOptionCard, isCurrent && styles.userOptionCardActive]}
                    onPress={async () => {
                      await authSwitchUser(u.id);
                      await switchUser(u.id);
                      const defaultWs = isAdmin
                        ? 'MLOHUB_ADMIN'
                        : isOwner
                        ? 'RESTAURANT_OWNER'
                        : 'CUSTOMER';
                      await switchWorkspace(defaultWs, u.activeRestaurantId);
                      refreshState();
                      setIsSwitchWorkspaceModalOpen(false);
                      setSuccessToast(
                        language === 'sw'
                          ? `✓ Umeingia kama: ${u.fullName}`
                          : `✓ Logged in as: ${u.fullName}`
                      );
                      setTimeout(() => setSuccessToast(null), 4000);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 24 }}>{u.avatarEmoji || '👤'}</Text>
                    <View style={styles.userOptionInfo}>
                      <View style={styles.userOptionNameRow}>
                        <Text style={styles.userOptionName}>{u.fullName}</Text>
                        {isCurrent && (
                          <View style={styles.activeTag}>
                            <Text style={styles.activeTagText}>Active</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.userOptionRole}>
                        {isAdmin
                          ? '🛡️ Super Admin'
                          : isOwner
                          ? '👑 Restaurant Owner'
                          : '👤 Customer (Diner)'}
                      </Text>
                    </View>
                    <Ionicons
                      name={isCurrent ? 'checkmark-circle' : 'chevron-forward'}
                      size={18}
                      color={isCurrent ? '#113a26' : '#94a3b8'}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          MODAL 2: PROFILE EDIT MODAL
      ========================================================================= */}
      <Modal
        visible={isProfileEditOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsProfileEditOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalBadge}>WASIFU & TAARIFA ZA KUINGIA</Text>
                <Text style={styles.modalTitle}>
                  {language === 'sw' ? 'Hariri Wasifu wa MloHub' : 'Edit MloHub Profile'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsProfileEditOpen(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalInputLabel}>Jina Kamili (Full Name): *</Text>
              <TextInput style={styles.modalInput} value={editFullName} onChangeText={setEditFullName} placeholder="Frank Mlaki" />

              <Text style={styles.modalInputLabel}>Barua Pepe (Email):</Text>
              <TextInput style={styles.modalInput} value={editEmail} onChangeText={setEditEmail} placeholder="frank@mlohub.tz" keyboardType="email-address" />

              <Text style={styles.modalInputLabel}>Nambari ya Simu (Phone): *</Text>
              <TextInput style={styles.modalInput} value={editPhone} onChangeText={setEditPhone} placeholder="+255 754 123 456" keyboardType="phone-pad" />

              <Text style={styles.modalInputLabel}>Eneo / Mtaa wa Kufikishiwa (Delivery Location):</Text>
              <TextInput style={styles.modalInput} value={editLocation} onChangeText={setEditLocation} placeholder="Mikocheni B, Dar es Salaam" />

              <Text style={styles.modalInputLabel}>PIN ya Kuingia Haraka (Quick Login PIN):</Text>
              <TextInput style={styles.modalInput} value={editPin} onChangeText={setEditPin} placeholder="1234" secureTextEntry maxLength={6} keyboardType="numeric" />

              <TouchableOpacity style={styles.saveProfileBtn} onPress={handleSaveProfile} activeOpacity={0.85}>
                <Text style={styles.saveProfileBtnText}>Hifadhi Mabadiliko (Save Changes)</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          MODAL 3: CUSTOMER MEAL EDITING MODAL
      ========================================================================= */}
      <Modal
        visible={!!editingOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalBadge}>{t('editModalBadge')}</Text>
                <Text style={styles.modalTitle}>{t('editModalTitle')}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingOrder(null)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalInputLabel}>{t('dishNameLabel')}</Text>
              <TextInput style={styles.modalInput} value={editDishName} onChangeText={setEditDishName} placeholder="e.g. Traditional Swahili Fish Curry" />

              <Text style={styles.modalInputLabel}>{t('instructionsLabel')}</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={editInstructions}
                onChangeText={setEditInstructions}
                multiline
                numberOfLines={3}
                placeholder={t('instructionsPlaceholder')}
              />

              <Text style={styles.modalSubLabel}>{t('quickTagsLabel')}</Text>
              <View style={styles.tagsRow}>
                {presetTags.map((tag) => (
                  <TouchableOpacity key={tag} style={styles.tagPill} onPress={() => handleAddPresetTag(tag)}>
                    <Text style={styles.tagPillText}>+ {tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.twoColRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.modalInputLabel}>{t('budgetLabel')}</Text>
                  <TextInput style={styles.modalInput} value={editBudget} onChangeText={setEditBudget} keyboardType="numeric" />
                </View>
                <View style={styles.colHalf}>
                  <Text style={styles.modalInputLabel}>{t('servingsLabel')}</Text>
                  <TextInput style={styles.modalInput} value={editServings} onChangeText={setEditServings} keyboardType="numeric" />
                </View>
              </View>

              <TouchableOpacity style={styles.saveMenuBtn} onPress={handleSaveEdit} activeOpacity={0.85}>
                <Text style={styles.saveMenuBtnText}>{t('saveMenuBtn')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Location Modal */}
      <LocationModal
        visible={isLocationModalOpen}
        selectedLocation={user?.location || 'Dar es Salaam'}
        onSelect={(loc) => {
          updateUser({ location: loc });
          setIsLocationModalOpen(false);
        }}
        onClose={() => setIsLocationModalOpen(false)}
      />

      {/* Language Modal */}
      <LanguageModal
        visible={isLanguageModalOpen}
        currentLanguage={language}
        onSelectLanguage={(lang) => {
          setLanguage(lang);
          setIsLanguageModalOpen(false);
        }}
        onClose={() => setIsLanguageModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: 16,
    paddingBottom: 40,
  },
  largeScreenContainer: {
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
  },
  toastCard: {
    backgroundColor: '#113a26',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: Spacing.lg,
    marginTop: 8,
    borderRadius: Radii.lg,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: Colors.card,
    borderRadius: Radii.xxl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
    ...Shadows.sm,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: Radii.full,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarIcon: {
    fontSize: 30,
  },
  profileInfoWrap: {
    flex: 1,
    gap: 2,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  roleBadge: {
    backgroundColor: '#eaf4ed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#113a26',
  },
  userEmail: {
    fontSize: 12,
    color: Colors.muted,
  },
  userPhone: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  credentialsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: Radii.lg,
  },
  credBox: {
    flex: 1,
    minWidth: 140,
  },
  credLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.muted,
  },
  credVal: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 1,
  },
  profileActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editProfileBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 9,
    borderRadius: Radii.lg,
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#113a26',
  },
  switchUserBtn: {
    flex: 1.2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#113a26',
    paddingVertical: 9,
    borderRadius: Radii.lg,
  },
  switchUserBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  statNum: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: '700',
    marginTop: 2,
  },
  chefPortalBanner: {
    backgroundColor: '#113a26',
    borderRadius: Radii.xxl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#e8c468',
    ...Shadows.md,
  },
  chefBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  chefCrownIcon: {
    width: 44,
    height: 44,
    borderRadius: Radii.xl,
    backgroundColor: 'rgba(232, 196, 104, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chefBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chefBannerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ffffff',
  },
  proTag: {
    backgroundColor: '#e8c468',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  proTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#113a26',
  },
  chefBannerSub: {
    fontSize: 11.5,
    color: '#e2e8f0',
    marginTop: 2,
    lineHeight: 16,
  },
  restaurantShortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shortcutCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: Colors.card,
    borderRadius: Radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
    ...Shadows.sm,
  },
  shortcutTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 4,
  },
  shortcutSub: {
    fontSize: 10.5,
    color: Colors.muted,
  },
  notifShortcutCard: {
    backgroundColor: Colors.card,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  notifShortcutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notifIconWrap: {
    position: 'relative',
    padding: 4,
  },
  notifDotWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifDotText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  notifShortcutTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  notifShortcutSub: {
    fontSize: 11,
    color: Colors.muted,
  },
  chevronText: {
    fontSize: 18,
    color: Colors.muted,
  },
  sectionHeaderWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.text,
  },
  newRequestBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.full,
  },
  newRequestBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  sectionDescription: {
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 16,
  },
  orderCard: {
    backgroundColor: Colors.card,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    ...Shadows.sm,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderTitleBox: {
    flex: 1,
  },
  orderNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  dishNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  instructionsBox: {
    backgroundColor: Colors.background,
    padding: 8,
    borderRadius: Radii.md,
  },
  instructionsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.muted,
  },
  instructionsText: {
    fontSize: 11.5,
    color: Colors.text,
    marginTop: 2,
  },
  orderMetricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricItem: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  statusNoticeBox: {
    backgroundColor: '#f8fafc',
    padding: 6,
    borderRadius: Radii.sm,
  },
  statusNoticeText: {
    fontSize: 11,
    color: Colors.muted,
  },
  orderActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  editMenuBtn: {
    backgroundColor: '#eaf4ed',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.md,
  },
  editMenuBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#113a26',
  },
  lockedNoticeBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.md,
  },
  lockedNoticeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
  },
  cancelOrderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  cancelOrderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e11d48',
  },
  emptyOrdersBox: {
    backgroundColor: Colors.card,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  emptySub: {
    fontSize: 11.5,
    color: Colors.muted,
    textAlign: 'center',
  },
  emptyCtaBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radii.full,
    marginTop: 6,
  },
  emptyCtaBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  settingsSection: {
    backgroundColor: Colors.card,
    borderRadius: Radii.xxl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    ...Shadows.sm,
  },
  settingsSectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.text,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingValueText: {
    fontSize: 12,
    color: Colors.muted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalBox: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: Colors.card,
    borderRadius: Radii.xxl,
    padding: Spacing.xl,
    maxHeight: '85%',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 10,
  },
  modalBadge: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#113a26',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
  },
  closeModalText: {
    fontSize: 16,
    color: Colors.muted,
  },
  modalIntroText: {
    fontSize: 12,
    color: Colors.muted,
    marginVertical: 8,
  },
  modalScroll: {
    marginTop: 8,
  },
  userOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: Radii.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  userOptionCardActive: {
    borderColor: '#113a26',
    backgroundColor: '#f5faf6',
  },
  wsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: Radii.lg,
    backgroundColor: '#eaf4ed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userOptionInfo: {
    flex: 1,
  },
  userOptionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userOptionName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  activeTag: {
    backgroundColor: '#113a26',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  activeTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  userOptionRole: {
    fontSize: 11,
    color: Colors.muted,
  },
  modalInputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    padding: 10,
    fontSize: 13,
    color: Colors.text,
    marginTop: 4,
  },
  modalTextArea: {
    height: 60,
  },
  modalSubLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.muted,
    marginTop: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 6,
  },
  tagPill: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radii.md,
  },
  tagPillText: {
    fontSize: 10.5,
    color: Colors.text,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colHalf: {
    flex: 1,
  },
  saveProfileBtn: {
    backgroundColor: '#113a26',
    paddingVertical: 12,
    borderRadius: Radii.lg,
    alignItems: 'center',
    marginTop: 16,
  },
  saveProfileBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  saveMenuBtn: {
    backgroundColor: '#113a26',
    paddingVertical: 12,
    borderRadius: Radii.lg,
    alignItems: 'center',
    marginTop: 14,
  },
  saveMenuBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
