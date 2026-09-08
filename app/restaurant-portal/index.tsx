import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useMloHubDB } from '../../context/DbContext';
import { useAuth } from '../../context/AuthContext';
import { OrderPipelineService } from '../../services/OrderPipelineService';

type PortalNavTab = 'dashboard' | 'incoming' | 'kitchen' | 'menu' | 'earnings' | 'reviews' | 'settings';

interface IncomingOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  tableOrAddress: string;
  items: string;
  time: string;
  totalTzs: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

interface KitchenOrderItem {
  id: string;
  orderNumber: string;
  items: string;
  time: string;
  status: 'QUEUED' | 'PREPARING' | 'READY' | 'COMPLETED';
  timerSeconds?: number;
}

interface LowStockItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  threshold: number;
  emoji: string;
}

export default function RestaurantPortalScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { logout } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 900;
  const isTablet = width > 600 && width <= 900;

  const {
    user,
    restaurants,
    customOrders,
  } = useMloHubDB();

  // Active Restaurant
  const activeRestaurant =
    restaurants.find((r) => r.id === user?.activeRestaurantId) ||
    restaurants.find((r) => r.id === 'mama-amina-biryani') ||
    restaurants[0] || {
      id: 'bahari-kitchen',
      name: 'Bahari Kitchen',
      ownerName: 'Bahari Admin',
    };

  // State
  const [activeTab, setActiveTab] = useState<PortalNavTab>('dashboard');
  const [isOpen, setIsOpen] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Dynamic KPI Counts
  const [newOrdersCount, setNewOrdersCount] = useState(12);
  const [preparingCount, setPreparingCount] = useState(8);
  const [readyCount, setReadyCount] = useState(5);
  const [todayEarnings, setTodayEarnings] = useState(1245600);
  const [completedOrdersCount, setCompletedOrdersCount] = useState(124);

  // 1. Incoming Orders Data
  const [incomingOrders, setIncomingOrders] = useState<IncomingOrderRow[]>([
    {
      id: 'ord-1058',
      orderNumber: '#1058',
      customerName: 'Neema M.',
      tableOrAddress: 'Table 7',
      items: '2x Pilau\n1x Chicken Curry',
      time: '09:15 AM',
      totalTzs: 28000,
      status: 'PENDING',
    },
    {
      id: 'ord-1057',
      orderNumber: '#1057',
      customerName: 'Delivery',
      tableOrAddress: 'Sinza, Block B',
      items: '1x Beef Stew\n1x Ugali',
      time: '09:08 AM',
      totalTzs: 19500,
      status: 'PENDING',
    },
    {
      id: 'ord-1056',
      orderNumber: '#1056',
      customerName: 'Juma K.',
      tableOrAddress: 'Table 3',
      items: '1x Tilapia\n1x Chips',
      time: '09:02 AM',
      totalTzs: 16000,
      status: 'PENDING',
    },
  ]);

  // 2. Kitchen Orders Kanban Columns Data
  const [kitchenOrders, setKitchenOrders] = useState<KitchenOrderItem[]>([
    { id: 'k-1057', orderNumber: '#1057', items: '1x Beef Stew\n1x Ugali', time: '09:08 AM', status: 'QUEUED' },
    { id: 'k-1058', orderNumber: '#1058', items: '2x Pilau\n1x Chicken Curry', time: '09:15 AM', status: 'QUEUED' },
    { id: 'k-1060', orderNumber: '#1060', items: '1x Veg Rice\n1x Bean Stew', time: '09:18 AM', status: 'QUEUED' },
    { id: 'k-1056', orderNumber: '#1056', items: '1x Tilapia\n1x Chips', time: '09:02 AM', status: 'PREPARING', timerSeconds: 384 },
    { id: 'k-1055', orderNumber: '#1055', items: '1x Chicken Curry\n1x Rice', time: '08:55 AM', status: 'PREPARING', timerSeconds: 221 },
    { id: 'k-1054', orderNumber: '#1054', items: '1x Beef Stew\n1x Ugali', time: '08:40 AM', status: 'READY' },
    { id: 'k-1052', orderNumber: '#1052', items: '2x Chips Masala\n1x Soda', time: '08:25 AM', status: 'READY' },
  ]);

  // 3. Low Stock Items
  const [lowStockList, setLowStockList] = useState<LowStockItem[]>([
    { id: 'ls-1', name: 'Pilau', category: 'Main Course', stock: 3, threshold: 10, emoji: '🍛' },
    { id: 'ls-2', name: 'Chips', category: 'Sides', stock: 5, threshold: 15, emoji: '🍟' },
  ]);

  // Live Timer Effect for Preparing Items
  useEffect(() => {
    const interval = setInterval(() => {
      setKitchenOrders((prev) =>
        prev.map((item) => {
          if (item.status === 'PREPARING' && item.timerSeconds && item.timerSeconds > 0) {
            return { ...item, timerSeconds: item.timerSeconds - 1 };
          }
          return item;
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const formatTimer = (totalSec: number = 0) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Handlers
  const handleAcceptIncomingOrder = (orderId: string) => {
    const target = incomingOrders.find((o) => o.id === orderId);
    if (!target) return;

    // Move to Kitchen Queued
    setKitchenOrders((prev) => [
      {
        id: `k-${target.orderNumber.replace('#', '')}`,
        orderNumber: target.orderNumber,
        items: target.items,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'QUEUED',
      },
      ...prev,
    ]);

    // Remove from incoming table
    setIncomingOrders((prev) => prev.filter((o) => o.id !== orderId));
    setNewOrdersCount((prev) => Math.max(0, prev - 1));
    showToast(`✓ Order ${target.orderNumber} accepted & added to kitchen queue!`);
  };

  const handleRejectIncomingOrder = (orderId: string) => {
    const target = incomingOrders.find((o) => o.id === orderId);
    setIncomingOrders((prev) => prev.filter((o) => o.id !== orderId));
    setNewOrdersCount((prev) => Math.max(0, prev - 1));
    showToast(`Order ${target?.orderNumber || ''} rejected.`);
  };

  const handleStartPreparing = (kitchenId: string) => {
    setKitchenOrders((prev) =>
      prev.map((item) =>
        item.id === kitchenId
          ? { ...item, status: 'PREPARING', timerSeconds: 420 }
          : item
      )
    );
    setPreparingCount((prev) => prev + 1);
    showToast('🍳 Kitchen started preparation (timer active)!');
  };

  const handleMarkReady = (kitchenId: string) => {
    setKitchenOrders((prev) =>
      prev.map((item) =>
        item.id === kitchenId ? { ...item, status: 'READY' } : item
      )
    );
    setPreparingCount((prev) => Math.max(0, prev - 1));
    setReadyCount((prev) => prev + 1);
    showToast('✓ Dish is ready for pickup / table serving!');
  };

  const handleOrderHandoverReady = (kitchenId: string) => {
    setKitchenOrders((prev) => prev.filter((item) => item.id !== kitchenId));
    setReadyCount((prev) => Math.max(0, prev - 1));
    setCompletedOrdersCount((prev) => prev + 1);
    setTodayEarnings((prev) => prev + 18500);
    showToast('🎉 Order completed & handed over to customer!');
  };

  const handleRestockItem = (itemId: string) => {
    setLowStockList((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, stock: item.threshold + 15 } : item
      )
    );
    showToast('✓ Stock replenished successfully!');
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      router.replace('/auth');
    } catch (e) {
      router.replace('/auth');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Filter Kitchen Columns
  const queuedKitchenItems = kitchenOrders.filter((k) => k.status === 'QUEUED');
  const preparingKitchenItems = kitchenOrders.filter((k) => k.status === 'PREPARING');
  const readyKitchenItems = kitchenOrders.filter((k) => k.status === 'READY');

  // Weekly Revenue Chart Bars Data
  const weeklyEarnings = [
    { day: 'Mon', amount: 700000, label: 'TZS 700K', heightPct: 46 },
    { day: 'Tue', amount: 920000, label: 'TZS 920K', heightPct: 61 },
    { day: 'Wed', amount: 1100000, label: 'TZS 1.10M', heightPct: 73 },
    { day: 'Thu', amount: 1250000, label: 'TZS 1.25M', heightPct: 83 },
    { day: 'Fri', amount: 1050000, label: 'TZS 1.05M', heightPct: 70 },
    { day: 'Sat', amount: 1350000, label: 'TZS 1.35M', heightPct: 90 },
    { day: 'Sun', amount: 890000, label: 'TZS 890K', heightPct: 59 },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.appContainer}>
        {/* =========================================================================
            1. LEFT SIDEBAR NAVIGATION (Dark Teal #0b1e24)
        ========================================================================= */}
        {(isLargeScreen || isTablet) && (
          <View style={styles.sidebar}>
            {/* Logo */}
            <View style={styles.sidebarLogoWrap}>
              <Text style={styles.sidebarLogoMain}>MloHub</Text>
              <Text style={styles.sidebarLogoSub}>Restaurant Portal</Text>
            </View>

            {/* Navigation Menu Links */}
            <View style={styles.sidebarNav}>
              {[
                { id: 'dashboard' as const, label: 'Dashboard', icon: 'home' },
                { id: 'incoming' as const, label: 'Incoming Orders', icon: 'bag-handle-outline' },
                { id: 'kitchen' as const, label: 'Kitchen Orders', icon: 'restaurant-outline' },
                { id: 'menu' as const, label: 'Menu', icon: 'book-outline' },
                { id: 'earnings' as const, label: 'Earnings', icon: 'stats-chart-outline' },
                { id: 'reviews' as const, label: 'Reviews', icon: 'star-outline' },
                { id: 'settings' as const, label: 'Settings', icon: 'settings-outline' },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.sidebarNavItem, isActive && styles.sidebarNavItemActive]}
                    onPress={() => setActiveTab(tab.id)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={tab.icon as any}
                      size={18}
                      color={isActive ? '#ffffff' : '#94a3b8'}
                    />
                    <Text style={[styles.sidebarNavText, isActive && styles.sidebarNavTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bottom Profile Bar in Sidebar */}
            <View style={styles.sidebarBottomProfile}>
              <View style={styles.sidebarUserThumb}>
                <Ionicons name="storefront" size={16} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sidebarUserName} numberOfLines={1}>
                  {activeRestaurant.name || 'Bahari Kitchen'}
                </Text>
                <Text style={styles.sidebarUserRole}>Restaurant Owner</Text>
              </View>
              <TouchableOpacity onPress={handleLogout} style={styles.sidebarLogoutBtn}>
                <Ionicons name="log-out-outline" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* =========================================================================
            2. MAIN CONTENT AREA
        ========================================================================= */}
        <View style={styles.mainContent}>
          {/* Top Header Bar */}
          <View style={styles.topHeaderBar}>
            {/* Left: Store Selector */}
            <TouchableOpacity style={styles.storeSelectorPill} activeOpacity={0.8}>
              <View style={styles.storeSelectorIcon}>
                <Ionicons name="storefront" size={14} color="#0f766e" />
              </View>
              <Text style={styles.storeSelectorText}>
                {activeRestaurant.name || 'Bahari Kitchen'}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#64748b" />
            </TouchableOpacity>

            {/* Right: Operating Status + Notif + User Icon */}
            <View style={styles.topHeaderRight}>
              {/* Operating Status Toggle */}
              <View style={styles.operatingStatusWrap}>
                <Text style={styles.operatingStatusLabel}>Operating Status</Text>
                <View style={[styles.statusTogglePill, isOpen ? styles.statusTogglePillOpen : styles.statusTogglePillClosed]}>
                  <Text style={[styles.statusToggleText, isOpen ? styles.statusToggleTextOpen : styles.statusToggleTextClosed]}>
                    {isOpen ? 'Open' : 'Closed'}
                  </Text>
                  <Switch
                    value={isOpen}
                    onValueChange={(val) => {
                      setIsOpen(val);
                      showToast(val ? 'Restaurant is now OPEN for orders' : 'Restaurant is now CLOSED');
                    }}
                    trackColor={{ false: '#cbd5e1', true: '#10b981' }}
                    thumbColor="#ffffff"
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                </View>
              </View>

              {/* Notification Bell */}
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.8} onPress={() => router.push('/notifications')}>
                <Ionicons name="notifications-outline" size={20} color="#1e293b" />
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>3</Text>
                </View>
              </TouchableOpacity>

              {/* User Avatar Circle */}
              <TouchableOpacity
                style={styles.profileAvatarPill}
                onPress={() => router.replace('/(tabs)')}
                activeOpacity={0.85}
              >
                <View style={styles.profileAvatarCircle}>
                  <Text style={styles.profileAvatarInitials}>
                    {(activeRestaurant.name || 'Bahari').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.profileAvatarName}>
                  {(activeRestaurant.name || 'Bahari').split(' ')[0]}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Toast Notification */}
          {toastMessage && (
            <View style={styles.toastBanner}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          )}

          {/* Scrollable Dashboard Body */}
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Greeting Header */}
            <View style={styles.greetingHeader}>
              <Text style={styles.greetingTitle}>
                Good morning, {activeRestaurant.name || 'Bahari Kitchen'}
              </Text>
              <Text style={styles.greetingSubtitle}>Here's what's happening today.</Text>
            </View>

            {/* =========================================================================
                3. FOUR TOP KPI METRIC CARDS
            ========================================================================= */}
            <View style={styles.kpiGrid}>
              {/* Card 1: New Orders */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiIconWrapTeal}>
                  <Ionicons name="bag-handle-outline" size={22} color="#0d9488" />
                </View>
                <View style={styles.kpiInfo}>
                  <Text style={styles.kpiLabel}>New Orders</Text>
                  <Text style={styles.kpiValue}>{newOrdersCount}</Text>
                  <Text style={styles.kpiTrendPositive}>+3 from yesterday</Text>
                </View>
              </View>

              {/* Card 2: Preparing */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiIconWrapOrange}>
                  <Ionicons name="flame-outline" size={22} color="#ea580c" />
                </View>
                <View style={styles.kpiInfo}>
                  <Text style={styles.kpiLabel}>Preparing</Text>
                  <Text style={styles.kpiValue}>{preparingCount}</Text>
                  <Text style={styles.kpiTrendOrange}>In progress</Text>
                </View>
              </View>

              {/* Card 3: Ready */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiIconWrapGreen}>
                  <Ionicons name="restaurant-outline" size={22} color="#16a34a" />
                </View>
                <View style={styles.kpiInfo}>
                  <Text style={styles.kpiLabel}>Ready</Text>
                  <Text style={styles.kpiValue}>{readyCount}</Text>
                  <Text style={styles.kpiTrendGreen}>Awaiting pickup</Text>
                </View>
              </View>

              {/* Card 4: Today's Earnings */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiIconWrapTeal}>
                  <Ionicons name="wallet-outline" size={22} color="#0d9488" />
                </View>
                <View style={styles.kpiInfo}>
                  <Text style={styles.kpiLabel}>Today's Earnings</Text>
                  <Text style={styles.kpiValue}>TZS {todayEarnings.toLocaleString()}</Text>
                  <Text style={styles.kpiTrendPositive}>+12% from yesterday</Text>
                </View>
              </View>
            </View>

            {/* =========================================================================
                4. MAIN 2x2 GRID
            ========================================================================= */}
            <View style={[styles.mainGrid, isLargeScreen && styles.mainGridRow]}>
              {/* -------------------------------------------------------------
                  LEFT COLUMN: INCOMING ORDERS + MENU OVERVIEW
              ------------------------------------------------------------- */}
              <View style={styles.gridColumn}>
                {/* INCOMING ORDERS TABLE CARD */}
                <View style={styles.cardPanel}>
                  <View style={styles.panelHeaderRow}>
                    <Text style={styles.panelTitle}>Incoming Orders</Text>
                    <TouchableOpacity onPress={() => setActiveTab('incoming')}>
                      <Text style={styles.panelLink}>View all orders →</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Table Header */}
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeadCol, { width: 55 }]}>Order #</Text>
                    <Text style={[styles.tableHeadCol, { flex: 1.3 }]}>Customer / Table</Text>
                    <Text style={[styles.tableHeadCol, { flex: 1.5 }]}>Items</Text>
                    <Text style={[styles.tableHeadCol, { width: 65 }]}>Time</Text>
                    <Text style={[styles.tableHeadCol, { width: 85 }]}>Total (TZS)</Text>
                    <Text style={[styles.tableHeadCol, { width: 105, textAlign: 'center' }]}>Action</Text>
                  </View>

                  {/* Table Rows */}
                  {incomingOrders.length > 0 ? (
                    incomingOrders.map((order) => (
                      <View key={order.id} style={styles.tableRow}>
                        <Text style={styles.orderNumCell}>{order.orderNumber}</Text>

                        <View style={{ flex: 1.3 }}>
                          <Text style={styles.customerNameCell}>{order.customerName}</Text>
                          <Text style={styles.tableSubCell}>{order.tableOrAddress}</Text>
                        </View>

                        <Text style={[styles.itemsCell, { flex: 1.5 }]}>{order.items}</Text>

                        <Text style={[styles.timeCell, { width: 65 }]}>{order.time}</Text>

                        <Text style={[styles.priceCell, { width: 85 }]}>
                          TZS {order.totalTzs.toLocaleString()}
                        </Text>

                        <View style={styles.actionButtonsCol}>
                          <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={() => handleAcceptIncomingOrder(order.id)}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.acceptBtnText}>Accept</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.rejectBtn}
                            onPress={() => handleRejectIncomingOrder(order.id)}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.rejectBtnText}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyTableRow}>
                      <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                      <Text style={styles.emptyTableText}>All incoming orders processed!</Text>
                    </View>
                  )}
                </View>

                {/* MENU OVERVIEW CARD */}
                <View style={styles.cardPanel}>
                  <Text style={styles.panelTitle}>Menu</Text>

                  {/* 3 Metric Pills */}
                  <View style={styles.menuMetricsRow}>
                    <View style={styles.menuMetricPill}>
                      <Ionicons name="restaurant" size={16} color="#0d9488" />
                      <View>
                        <Text style={styles.menuMetricSub}>Available Items</Text>
                        <Text style={styles.menuMetricVal}>86</Text>
                      </View>
                    </View>

                    <View style={[styles.menuMetricPill, { backgroundColor: '#fef2f2' }]}>
                      <Ionicons name="warning" size={16} color="#ef4444" />
                      <View>
                        <Text style={styles.menuMetricSub}>Out of Stock</Text>
                        <Text style={[styles.menuMetricVal, { color: '#ef4444' }]}>8</Text>
                      </View>
                    </View>

                    <View style={styles.menuMetricPill}>
                      <Ionicons name="grid" size={16} color="#0d9488" />
                      <View>
                        <Text style={styles.menuMetricSub}>Categories</Text>
                        <Text style={styles.menuMetricVal}>12</Text>
                      </View>
                    </View>
                  </View>

                  {/* Low Stock Items Section */}
                  <Text style={styles.lowStockHeader}>Low Stock Items</Text>

                  {lowStockList.map((item) => (
                    <View key={item.id} style={styles.lowStockRow}>
                      <View style={styles.lowStockThumb}>
                        <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.lowStockName}>{item.name}</Text>
                        <Text style={styles.lowStockCat}>{item.category}</Text>
                      </View>
                      <View style={styles.lowStockCountWrap}>
                        <Text style={styles.lowStockAlertText}>Stock: {item.stock}</Text>
                        <Text style={styles.lowStockThreshold}>Threshold: {item.threshold}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.restockBtn}
                        onPress={() => handleRestockItem(item.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.restockBtnText}>Restock</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Full Width Manage Menu Button */}
                  <TouchableOpacity
                    style={styles.fullManageMenuBtn}
                    onPress={() => setActiveTab('menu')}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="restaurant-outline" size={16} color="#ffffff" />
                    <Text style={styles.fullManageMenuBtnText}>Manage Menu</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* -------------------------------------------------------------
                  RIGHT COLUMN: KITCHEN KANBAN + EARNINGS & CHART
              ------------------------------------------------------------- */}
              <View style={styles.gridColumn}>
                {/* KITCHEN ORDERS CARD (3 KANBAN COLUMNS) */}
                <View style={styles.cardPanel}>
                  <Text style={styles.panelTitle}>Kitchen Orders</Text>

                  <View style={styles.kanbanColumnsWrap}>
                    {/* COLUMN 1: QUEUED */}
                    <View style={styles.kanbanCol}>
                      <View style={styles.kanbanColHeader}>
                        <Text style={styles.kanbanColTitle}>Queued</Text>
                        <View style={styles.kanbanCountBadge}>
                          <Text style={styles.kanbanCountText}>{queuedKitchenItems.length}</Text>
                        </View>
                      </View>

                      <ScrollView style={styles.kanbanListScroll} showsVerticalScrollIndicator={false}>
                        {queuedKitchenItems.map((item) => (
                          <View key={item.id} style={styles.kanbanCard}>
                            <View style={styles.kanbanCardTop}>
                              <Text style={styles.kanbanOrderNum}>{item.orderNumber}</Text>
                              <Text style={styles.kanbanTime}>{item.time}</Text>
                            </View>
                            <Text style={styles.kanbanItemsText}>{item.items}</Text>
                            <View style={styles.kanbanBadgeRow}>
                              <View style={styles.queuedStatusPill}>
                                <Text style={styles.queuedStatusText}>Queued</Text>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={styles.startPrepBtn}
                              onPress={() => handleStartPreparing(item.id)}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.startPrepBtnText}>▶ Start Preparing</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    </View>

                    {/* COLUMN 2: PREPARING */}
                    <View style={styles.kanbanCol}>
                      <View style={styles.kanbanColHeader}>
                        <Text style={[styles.kanbanColTitle, { color: '#ea580c' }]}>Preparing</Text>
                        <View style={[styles.kanbanCountBadge, { backgroundColor: '#ffedd5' }]}>
                          <Text style={[styles.kanbanCountText, { color: '#ea580c' }]}>
                            {preparingKitchenItems.length}
                          </Text>
                        </View>
                      </View>

                      <ScrollView style={styles.kanbanListScroll} showsVerticalScrollIndicator={false}>
                        {preparingKitchenItems.map((item) => (
                          <View key={item.id} style={[styles.kanbanCard, { borderColor: '#fed7aa' }]}>
                            <View style={styles.kanbanCardTop}>
                              <Text style={styles.kanbanOrderNum}>{item.orderNumber}</Text>
                              <Text style={styles.kanbanTime}>{item.time}</Text>
                            </View>
                            <Text style={styles.kanbanItemsText}>{item.items}</Text>
                            <View style={styles.kanbanBadgeRow}>
                              <View style={styles.preparingStatusPill}>
                                <Text style={styles.preparingStatusText}>Preparing</Text>
                              </View>
                            </View>
                            <View style={styles.timerRow}>
                              <Ionicons name="time-outline" size={14} color="#ea580c" />
                              <Text style={styles.timerText}>{formatTimer(item.timerSeconds)}</Text>
                            </View>
                            <TouchableOpacity
                              style={styles.markReadyBtn}
                              onPress={() => handleMarkReady(item.id)}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.markReadyBtnText}>✓ Mark Ready</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    </View>

                    {/* COLUMN 3: READY */}
                    <View style={styles.kanbanCol}>
                      <View style={styles.kanbanColHeader}>
                        <Text style={[styles.kanbanColTitle, { color: '#16a34a' }]}>Ready</Text>
                        <View style={[styles.kanbanCountBadge, { backgroundColor: '#dcfce7' }]}>
                          <Text style={[styles.kanbanCountText, { color: '#16a34a' }]}>
                            {readyKitchenItems.length}
                          </Text>
                        </View>
                      </View>

                      <ScrollView style={styles.kanbanListScroll} showsVerticalScrollIndicator={false}>
                        {readyKitchenItems.map((item) => (
                          <View key={item.id} style={[styles.kanbanCard, { borderColor: '#bbf7d0' }]}>
                            <View style={styles.kanbanCardTop}>
                              <Text style={styles.kanbanOrderNum}>{item.orderNumber}</Text>
                              <Text style={styles.kanbanTime}>{item.time}</Text>
                            </View>
                            <Text style={styles.kanbanItemsText}>{item.items}</Text>
                            <View style={styles.kanbanBadgeRow}>
                              <View style={styles.readyStatusPill}>
                                <Text style={styles.readyStatusText}>Ready</Text>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={styles.orderReadyBtn}
                              onPress={() => handleOrderHandoverReady(item.id)}
                              activeOpacity={0.85}
                            >
                              <Ionicons name="bag-check" size={13} color="#ffffff" />
                              <Text style={styles.orderReadyBtnText}>Order Ready</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </View>

                {/* EARNINGS & WEEKLY BAR CHART CARD */}
                <View style={styles.cardPanel}>
                  <Text style={styles.panelTitle}>Earnings</Text>

                  {/* 3 Stats Row */}
                  <View style={styles.earningsKpiRow}>
                    <View style={styles.earningsKpiCol}>
                      <Text style={styles.earningsKpiLabel}>Today's Earnings</Text>
                      <Text style={styles.earningsKpiVal}>TZS {todayEarnings.toLocaleString()}</Text>
                    </View>

                    <View style={styles.earningsKpiCol}>
                      <Text style={styles.earningsKpiLabel}>Completed Orders</Text>
                      <Text style={styles.earningsKpiVal}>{completedOrdersCount}</Text>
                    </View>

                    <View style={styles.earningsKpiCol}>
                      <Text style={styles.earningsKpiLabel}>Average Order</Text>
                      <Text style={styles.earningsKpiVal}>TZS 10,045</Text>
                    </View>
                  </View>

                  {/* Vertical Revenue Bar Chart */}
                  <View style={styles.chartContainer}>
                    {/* Y-Axis Labels */}
                    <View style={styles.chartYAxis}>
                      <Text style={styles.chartAxisText}>TZS 1.5M</Text>
                      <Text style={styles.chartAxisText}>TZS 1.0M</Text>
                      <Text style={styles.chartAxisText}>TZS 500K</Text>
                      <Text style={styles.chartAxisText}>TZS 0</Text>
                    </View>

                    {/* Chart Bars Area */}
                    <View style={styles.chartBarsArea}>
                      {weeklyEarnings.map((bar) => (
                        <View key={bar.day} style={styles.chartBarCol}>
                          <Text style={styles.barTopLabel}>{bar.label}</Text>
                          <View style={styles.barTrack}>
                            <View style={[styles.barFill, { height: `${bar.heightPct}%` }]} />
                          </View>
                          <Text style={styles.barDayText}>{bar.day}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* View Earnings Full Button */}
                  <TouchableOpacity
                    style={styles.viewEarningsBtn}
                    onPress={() => setActiveTab('earnings')}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.viewEarningsBtnText}>View Earnings</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  appContainer: {
    flex: 1,
    flexDirection: 'row',
  },

  // 1. SIDEBAR STYLES (Dark Teal #0b1e24)
  sidebar: {
    width: 220,
    backgroundColor: '#0b1e24',
    paddingVertical: 20,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
    borderRightWidth: 1,
    borderRightColor: '#16333c',
  },
  sidebarLogoWrap: {
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  sidebarLogoMain: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  sidebarLogoSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2dd4bf',
    marginTop: 2,
  },
  sidebarNav: {
    gap: 6,
    flex: 1,
  },
  sidebarNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radii.lg,
  },
  sidebarNavItemActive: {
    backgroundColor: '#0f766e',
  },
  sidebarNavText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  sidebarNavTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  sidebarBottomProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#16333c',
  },
  sidebarUserThumb: {
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    backgroundColor: '#0f766e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarUserName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  sidebarUserRole: {
    fontSize: 10,
    color: '#94a3b8',
  },
  sidebarLogoutBtn: {
    padding: 6,
  },

  // 2. MAIN CONTENT STYLES
  mainContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  storeSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.full,
  },
  storeSelectorIcon: {
    width: 22,
    height: 22,
    borderRadius: Radii.full,
    backgroundColor: '#ccfbf1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeSelectorText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  operatingStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  operatingStatusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  statusTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  statusTogglePillOpen: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  statusTogglePillClosed: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  statusToggleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusToggleTextOpen: {
    color: '#059669',
  },
  statusToggleTextClosed: {
    color: '#64748b',
  },
  bellBtn: {
    position: 'relative',
    padding: 6,
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    width: 15,
    height: 15,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ffffff',
  },
  profileAvatarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    backgroundColor: '#0f766e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarInitials: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },
  profileAvatarName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },

  toastBanner: {
    backgroundColor: '#0f766e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: Spacing.xl,
    marginTop: 8,
    borderRadius: Radii.md,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  scrollBody: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: 16,
    paddingBottom: 40,
  },
  greetingHeader: {
    gap: 2,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  greetingSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },

  // 3. KPI CARDS
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#ffffff',
    borderRadius: Radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...Shadows.sm,
  },
  kpiIconWrapTeal: {
    width: 48,
    height: 48,
    borderRadius: Radii.xl,
    backgroundColor: '#ccfbf1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiIconWrapOrange: {
    width: 48,
    height: 48,
    borderRadius: Radii.xl,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiIconWrapGreen: {
    width: 48,
    height: 48,
    borderRadius: Radii.xl,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiInfo: {
    flex: 1,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  kpiTrendPositive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
    marginTop: 2,
  },
  kpiTrendOrange: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ea580c',
    marginTop: 2,
  },
  kpiTrendGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
    marginTop: 2,
  },

  // 4. MAIN GRID 2x2
  mainGrid: {
    gap: 14,
  },
  mainGridRow: {
    flexDirection: 'row',
  },
  gridColumn: {
    flex: 1,
    gap: 14,
  },
  cardPanel: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    ...Shadows.sm,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  panelLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f766e',
  },

  // Table
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
    alignItems: 'center',
  },
  tableHeadCol: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  orderNumCell: {
    width: 55,
    fontSize: 12,
    fontWeight: '900',
    color: '#0f766e',
  },
  customerNameCell: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  tableSubCell: {
    fontSize: 10.5,
    color: '#64748b',
  },
  itemsCell: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 15,
  },
  timeCell: {
    fontSize: 11,
    color: '#64748b',
  },
  priceCell: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  actionButtonsCol: {
    width: 105,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-end',
  },
  acceptBtn: {
    backgroundColor: '#0f766e',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: Radii.md,
  },
  acceptBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  rejectBtn: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fff1f2',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radii.md,
  },
  rejectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e11d48',
  },
  emptyTableRow: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyTableText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },

  // Menu Overview
  menuMetricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  menuMetricPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  menuMetricSub: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  menuMetricVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  lowStockHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  lowStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  lowStockThumb: {
    width: 36,
    height: 36,
    borderRadius: Radii.md,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lowStockName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  lowStockCat: {
    fontSize: 10.5,
    color: '#64748b',
  },
  lowStockCountWrap: {
    alignItems: 'flex-end',
  },
  lowStockAlertText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ef4444',
  },
  lowStockThreshold: {
    fontSize: 9.5,
    color: '#94a3b8',
  },
  restockBtn: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fff1f2',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radii.md,
  },
  restockBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#e11d48',
  },
  fullManageMenuBtn: {
    backgroundColor: '#0f766e',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radii.lg,
    marginTop: 6,
  },
  fullManageMenuBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Kitchen Kanban Columns
  kanbanColumnsWrap: {
    flexDirection: 'row',
    gap: 10,
  },
  kanbanCol: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: Radii.lg,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 260,
  },
  kanbanColHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  kanbanColTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  kanbanCountBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  kanbanCountText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#475569',
  },
  kanbanListScroll: {
    maxHeight: 280,
  },
  kanbanCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.md,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    gap: 4,
    ...Shadows.sm,
  },
  kanbanCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kanbanOrderNum: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0f172a',
  },
  kanbanTime: {
    fontSize: 9.5,
    color: '#94a3b8',
  },
  kanbanItemsText: {
    fontSize: 10.5,
    color: '#334155',
    lineHeight: 14,
  },
  kanbanBadgeRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  queuedStatusPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  queuedStatusText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
  },
  preparingStatusPill: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  preparingStatusText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#ea580c',
  },
  readyStatusPill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  readyStatusText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#16a34a',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: 2,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ea580c',
  },
  startPrepBtn: {
    backgroundColor: '#0f766e',
    paddingVertical: 5,
    borderRadius: Radii.sm,
    alignItems: 'center',
    marginTop: 2,
  },
  startPrepBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  markReadyBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ea580c',
    paddingVertical: 4,
    borderRadius: Radii.sm,
    alignItems: 'center',
    marginTop: 2,
  },
  markReadyBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ea580c',
  },
  orderReadyBtn: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    borderRadius: Radii.sm,
    marginTop: 2,
  },
  orderReadyBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Earnings & Chart
  earningsKpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  earningsKpiCol: {
    flex: 1,
    alignItems: 'center',
  },
  earningsKpiLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600',
  },
  earningsKpiVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  chartContainer: {
    flexDirection: 'row',
    height: 150,
    marginTop: 10,
  },
  chartYAxis: {
    width: 60,
    justifyContent: 'space-between',
    paddingBottom: 18,
  },
  chartAxisText: {
    fontSize: 9.5,
    color: '#94a3b8',
    fontWeight: '600',
  },
  chartBarsArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 4,
  },
  chartBarCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 4,
  },
  barTopLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748b',
  },
  barTrack: {
    width: 22,
    height: 100,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#0f766e',
    borderRadius: 4,
  },
  barDayText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  viewEarningsBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderRadius: Radii.lg,
    alignItems: 'center',
    marginTop: 4,
  },
  viewEarningsBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f766e',
  },
});
