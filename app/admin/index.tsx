import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
  UserRole,
  hasAdminAccess,
  RestaurantEntity,
  UserEntity,
  AuditLogEntity,
  NotificationEntity,
  PaymentTransactionEntity,
  PaymentMethodCode,
  PaymentGatewayProvider,
  PaymentType,
} from '../../db/types';
import { RealtimeEventEngine } from '../../db/realtime/eventEngine';
import { RealtimeService } from '../../services/RealtimeService';
import {
  ApplicationRepository,
  RestaurantRepository,
  OrderRepository,
  PaymentRepository,
  AuditLogRepository,
  NotificationRepository,
  DataReportsRepository,
  ProfileAdminRepository,
  RefundsRepository,
  SettlementsRepository,
  AdminGovernanceRepository,
  AdminAttentionSummary,
} from '../../repositories';
import {
  RestaurantApplication,
  Restaurant,
  Order,
  Payment,
  DataReport,
  AuditLog,
  Notification,
  RefundRequest,
  MerchantSettlement,
} from '../../types/domain';
import { runtimeConfig } from '../../lib/runtimeConfig';
import { useTheme } from '../../context/ThemeContext';
import { AdminSystemHealthService, PlatformHealthStatus } from '../../services/AdminSystemHealthService';

import {
  AdminHeader,
  AdminSidebar,
  AdminMobileNav,
  AdminTabId,
  AdminOverview,
  AttentionItem,
  ApplicationsQueue,
  RestaurantsManager,
  VerificationCenter,
  CustomerReportsAdmin,
  OrdersMonitor,
  PaymentsMonitor,
  UsersManager,
  AdminUsersManager,
  NotificationsCenter,
  AuditLogViewer,
  PlatformAnalytics,
  SystemHealth,
  AdminSettings,
  RefundsDisputesCenter,
  SettlementsPayoutsCenter,
} from '../../components/admin';

export default function AdminPortalScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user, switchWorkspace, logout, loading: isAuthLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 840;
  const { colors, isDark } = useTheme();

  const activeUser = user;
  const isAuthorized = hasAdminAccess(activeUser);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<AdminTabId>('OVERVIEW');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Authoritative Entity states from Supabase repositories
  const [applications, setApplications] = useState<RestaurantApplication[]>([]);
  const [reports, setReports] = useState<DataReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntity[]>([]);
  const [allUsers, setAllUsers] = useState<UserEntity[]>([]);
  const [notifications, setNotifications] = useState<NotificationEntity[]>([]);
  const [rawPayments, setRawPayments] = useState<Payment[]>([]);
  const [paymentsList, setPaymentsList] = useState<PaymentTransactionEntity[]>([]);
  const [standardOrders, setStandardOrders] = useState<Order[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantEntity[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [settlements, setSettlements] = useState<MerchantSettlement[]>([]);
  const [systemHealth, setSystemHealth] = useState<PlatformHealthStatus | null>(null);
  const [attentionSummary, setAttentionSummary] = useState<AdminAttentionSummary | null>(null);

  // Newly onboarded vendor credential display modal
  const [createdVendorModal, setCreatedVendorModal] = useState<{
    businessName: string;
    ownerName: string;
    ownerPhone: string;
    ownerEmail?: string;
    restaurantId: string;
    activationDispatched: boolean;
  } | null>(null);

  // Load all platform data strictly from PostgreSQL repositories
  const loadPlatformData = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const [apps, dataReps, logs, profileUsers, notifs, payments, orders, rests, refundList, settleList, healthReport, attSummary] = await Promise.all([
        ApplicationRepository.listAll().then((apps) => { setApplications(apps); return apps; }),
        DataReportsRepository.listAll(),
        AuditLogRepository.listAll(),
        ProfileAdminRepository.listAll(),
        NotificationRepository.listAll(),
        PaymentRepository.listAll(),
        OrderRepository.listAll(),
        RestaurantRepository.list({ includeArchived: true }),
        RefundsRepository.listAll().catch(() => [] as RefundRequest[]),
        SettlementsRepository.listAll().catch(() => [] as MerchantSettlement[]),
        AdminSystemHealthService.getHealth().catch(() => null),
        AdminGovernanceRepository.getAttentionSummary().catch(() => null),
      ]);

      setApplications(apps);
      setReports(dataReps);
      setRefunds(refundList || []);
      setSettlements(settleList || []);
      setSystemHealth(healthReport);
      if (attSummary) setAttentionSummary(attSummary);

      // Map audit logs to presentation entity
      setAuditLogs(
        logs.map((l) => ({
          id: l.id,
          adminUserId: l.actorUserId,
          adminName: l.adminName,
          action: l.action,
          targetType: l.entityType,
          targetId: l.entityId,
          details: l.metadata || {},
          ipAddress: l.ipAddress,
          timestamp: l.createdAt,
          createdAt: l.createdAt,
        }))
      );

      setAllUsers(profileUsers);

      // Map notifications to presentation entity
      setNotifications(
        notifs.map((n) => ({
          id: n.id,
          userId: n.userId,
          type: n.type as any,
          titleEn: n.titleEn,
          titleSw: n.titleSw,
          messageEn: n.messageEn,
          messageSw: n.messageSw,
          timeAgoEn: 'Just now',
          timeAgoSw: 'Hivi punde',
          isRead: n.isRead,
          createdAt: n.createdAt,
        }))
      );

      setRawPayments(payments);

      // Build a restaurant name lookup from the already-loaded restaurant list
      const restaurantNameMap: Record<string, string> = {};
      (rests || []).forEach((r: any) => {
        if (r.id) restaurantNameMap[r.id] = r.name || r.businessName || '';
      });

      // Map payments to presentation entity cleanly without unsafe casts
      setPaymentsList(
        payments.map((p) => {
          let mappedStatus: PaymentTransactionEntity['status'] = 'PENDING';
          if (p.status === 'SUCCESS' || (p.status as string) === 'CAPTURED' || (p.status as string) === 'PAID') {
            mappedStatus = 'PAID';
          } else if (p.status === 'FAILED') {
            mappedStatus = 'FAILED';
          } else if (p.status === 'CANCELLED') {
            mappedStatus = 'CANCELLED';
          } else if (p.status === 'REFUNDED') {
            mappedStatus = 'REFUNDED';
          } else if (p.status === 'PROCESSING') {
            mappedStatus = 'PROCESSING';
          }

          let methodCode: PaymentMethodCode = 'MPESA';
          const lowerMethod = (p.paymentMethod || '').toLowerCase();
          if (lowerMethod.includes('airtel')) methodCode = 'AIRTEL_MONEY';
          else if (lowerMethod.includes('yas') || lowerMethod.includes('tigo')) methodCode = 'MIXX_BY_YAS';
          else if (lowerMethod.includes('halo')) methodCode = 'HALOPESA';
          else if (lowerMethod.includes('card')) methodCode = 'CARD';
          else if (lowerMethod.includes('cash')) methodCode = 'CASH_ON_DELIVERY';

          let provider: PaymentGatewayProvider = 'CLICKPESA';
          const lowerProv = (p.provider || '').toLowerCase();
          if (lowerProv.includes('selcom')) provider = 'SELCOM';
          else if (lowerProv.includes('pesapal')) provider = 'PESAPAL';

          const paymentType: PaymentType = p.reservationId ? 'RESERVATION_FULL_100' : 'ORDER_FULL';

          return {
            id: p.id,
            userId: p.customerId,
            orderId: p.orderId,
            reservationId: p.reservationId,
            restaurantId: p.restaurantId,
            // Resolve restaurant name from the loaded restaurant index
            restaurantName: (p.restaurantId && restaurantNameMap[p.restaurantId]) || p.restaurantId || '',
            provider,
            providerReference: p.externalReference || p.id,
            amountTzs: p.amountTzs,
            currency: 'TZS',
            paymentMethod: p.paymentMethod || 'Mobile Money',
            methodCode,
            status: mappedStatus,
            paymentType,
            payerPhone: p.phoneNumber,
            paidAt: p.paidAt,
            refundedAt: p.refundedAt,
            createdAt: p.createdAt,
          };
        })
      );

      setStandardOrders(orders);

      const enrichedRests = (rests || []).map((r: any) => {
        const matchedApp = (apps || []).find(
          (a: any) =>
            (a.restaurantId && a.restaurantId === r.id) ||
            (a.businessName && r.name && a.businessName.trim().toLowerCase() === r.name.trim().toLowerCase()) ||
            (a.applicantUserId && r.ownerId && a.applicantUserId === r.ownerId)
        );
        const matchedOwner = (profileUsers || []).find((u: any) => r.ownerId && u.id === r.ownerId);
        const isSuspended = r.verificationStatus === 'SUSPENDED' || r.isSuspended === true;

        return {
          ...r,
          ownerName: r.ownerName || matchedApp?.ownerName || matchedOwner?.fullName || (matchedOwner as any)?.name || undefined,
          ownerPhone: r.ownerPhone || r.phone || matchedApp?.ownerPhone || matchedOwner?.phone || r.payoutPhoneNumber || undefined,
          ownerEmail: r.ownerEmail || matchedApp?.ownerEmail || matchedOwner?.email || undefined,
          isSuspended,
          suspensionReason: r.suspensionReason || r.archivedReason || undefined,
        };
      });

      setRestaurants(enrichedRests as any);

    } catch (err: any) {
      console.error('Error loading admin platform data:', err);
      setLoadError(err?.message || 'Failed to load authoritative platform data.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      loadPlatformData();

      // Realtime subscriptions re-fetch Supabase repositories (no local cache hydration)
      const unsubOrders = RealtimeEventEngine.subscribe('orders:*', () => {
        loadPlatformData();
      });
      const unsubRestaurants = RealtimeService.subscribe('admin:applications', () => {
        ApplicationRepository.listAll().then(setApplications).catch((error) => setLoadError(error.message));
      }, { table: 'restaurant_applications' });
      const unsubAdminOrders = RealtimeService.subscribe('orders:admin', () => {
        loadPlatformData();
      });
      const unsubReports = RealtimeService.subscribe('reports:updates', () => {
        loadPlatformData();
      });
      const unsubResync = RealtimeService.registerResyncCallback('admin_portal', () => {
        loadPlatformData();
      });

      return () => {
        unsubOrders();
        unsubRestaurants();
        unsubAdminOrders();
        unsubReports();
        unsubResync();
      };
    }
  }, [isAuthorized, loadPlatformData]);

  // Auth loading state
  if (isAuthLoading) {
    return (
      <SafeAreaView style={styles.unauthContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  // If unauthenticated or customer-only role, render strict access block
  if (!isAuthorized || !activeUser) {
    return (
      <SafeAreaView style={styles.unauthContainer}>
        <View style={styles.unauthCard}>
          <View style={styles.unauthIcon}>
            <Ionicons name="shield-outline" size={48} color="#ef4444" />
          </View>
          <Text style={styles.unauthTitle}>
            {language === 'sw' ? 'Huna Ruhusa ya Usimamizi' : 'Admin Access Required'}
          </Text>
          <Text style={styles.unauthSubtitle}>
            {language === 'sw'
              ? 'Eneo hili limetengwa kwa ajili ya wasimamizi wa mfumo (Admin & Super Admin) pekee.'
              : 'This portal requires authenticated Administrator or Super Administrator platform credentials.'}
          </Text>

          <View style={styles.unauthActions}>
            <TouchableOpacity
              style={styles.unauthPrimaryBtn}
              onPress={() => router.push('/auth/login')}
            >
              <Text style={styles.unauthPrimaryBtnText}>Log In as Admin</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.unauthSecondaryBtn}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.unauthSecondaryBtnText}>Back to Customer App</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- GOVERNANCE ACTIONS (SERVER-AUTHORITATIVE) ---

  // 1. Approve Application via server RPC
  const handleApproveApp = async (appId: string) => {
    if (!activeUser?.id) {
      throw new Error('Authenticated administrator is required.');
    }
    const updated = await ApplicationRepository.updateStatus(appId, 'APPROVED', activeUser.id);
    setCreatedVendorModal({
      businessName: updated.businessName,
      ownerName: updated.ownerName,
      ownerPhone: updated.ownerPhone,
      ownerEmail: updated.ownerEmail,
      // Use the server-returned restaurant ID, not the application ID
      restaurantId: updated.restaurantId || updated.id,
      activationDispatched: false, // Truthful: delivery is pending server dispatch
    });
    await loadPlatformData();
  };

  // 2. Reject Application via server RPC
  const handleRejectApp = async (appId: string, reason: string) => {
    if (!activeUser?.id) {
      throw new Error('Authenticated administrator is required.');
    }
    await ApplicationRepository.updateStatus(appId, 'REJECTED', activeUser.id, reason);
    await loadPlatformData();
  };

  // 3. Request Changes on Application
  const handleRequestAppChanges = async (appId: string, note: string) => {
    if (!activeUser?.id) {
      throw new Error('Authenticated administrator is required.');
    }
    await ApplicationRepository.updateStatus(appId, 'PENDING', activeUser.id, note);
    await loadPlatformData();
  };

  // 4. Suspend Restaurant via server RPC
  const handleSuspendRestaurant = async (restaurantId: string, reason: string) => {
    if (!activeUser?.id) {
      throw new Error('Authenticated administrator is required.');
    }
    await RestaurantRepository.suspendRestaurant(restaurantId, reason);
    RealtimeEventEngine.publish('restaurants:updated', { restaurantId, action: 'SUSPENDED' });
    await loadPlatformData();
  };

  // 5. Reactivate Restaurant via server RPC
  const handleReactivateRestaurant = async (restaurantId: string) => {
    if (!activeUser?.id) {
      throw new Error('Authenticated administrator is required.');
    }
    await RestaurantRepository.reactivateRestaurant(restaurantId);
    RealtimeEventEngine.publish('restaurants:updated', { restaurantId, action: 'VERIFIED' });
    await loadPlatformData();
  };

  // 5b. Delete Restaurant
  const handleDeleteRestaurant = async (restaurantId: string) => {
    // 1. Instantly remove from local React state (0ms UI latency)
    setRestaurants((prev) => prev.filter((r) => r.id !== restaurantId));
    // 2. Perform authoritative backend deletion & persistence
    await RestaurantRepository.deleteRestaurant(restaurantId);
    RealtimeEventEngine.publish('restaurants:updated', { restaurantId, action: 'ARCHIVED' });
    // 3. Reload authoritative data
    await loadPlatformData();
  };

  // 5c. Archive Restaurant (non-destructive soft delete)
  const handleArchiveRestaurant = async (restaurantId: string, reason: string) => {
    await RestaurantRepository.archiveRestaurant(restaurantId, reason);
    RealtimeEventEngine.publish('restaurants:updated', { restaurantId, action: 'ARCHIVED' });
    await loadPlatformData();
  };

  // 5d. Unarchive Restaurant
  const handleUnarchiveRestaurant = async (restaurantId: string) => {
    await RestaurantRepository.unarchiveRestaurant(restaurantId);
    RealtimeEventEngine.publish('restaurants:updated', { restaurantId, action: 'VERIFIED' });
    await loadPlatformData();
  };

  // 6. Upgrade to Verified via verify_restaurant_secure RPC
  const handleUpgradeToVerified = async (
    restaurantId: string,
    docs: { tinNumber: string; businessLicenseNumber: string }
  ) => {
    if (!activeUser?.id) {
      throw new Error('Authenticated administrator is required.');
    }
    await RestaurantRepository.verifyRestaurant(
      restaurantId,
      docs.tinNumber,
      docs.businessLicenseNumber,
      'Administrative document verification'
    );
    RealtimeEventEngine.publish('restaurants:updated', { restaurantId, action: 'VERIFIED' });
    await loadPlatformData();
  };

  // 7. Resolve Customer Report via resolve_data_report_secure RPC
  const handleResolveReport = async (
    reportId: string,
    status: 'RESOLVED' | 'REJECTED' | 'INVESTIGATING',
    resolutionNotes?: string
  ) => {
    if (!activeUser?.id) {
      throw new Error('Authenticated administrator is required.');
    }
    await DataReportsRepository.resolveReport(
      reportId,
      activeUser.id,
      status,
      resolutionNotes
    );
    await loadPlatformData();
  };

  // 8. Trigger Freshness Reverification
  const handleTriggerReverification = async (restaurantId: string) => {
    const rest = restaurants.find((r) => r.id === restaurantId);
    if (!rest || !rest.ownerId) return;

    await NotificationRepository.createNotification({
      userId: rest.ownerId,
      type: 'general',
      titleEn: 'Menu Price & Availability Confirmation Required',
      titleSw: 'Uthibitisho wa Bei na Upatikanaji wa Chakula Unahitajika',
      messageEn: `Please review and confirm active menu prices for "${rest.name}" to maintain discovery ranking.`,
      messageSw: `Tafadhali kagua na thibitisha bei za menyu yako ya "${rest.name}" ili mgahawa wako uendelee kuonekana kileleni.`,
      restaurantId,
      actionType: 'VERIFY_PRICES',
    });
  };

  // 9. Grant Admin
  const handleGrantAdmin = async (
    email: string,
    fullName: string,
    role: UserRole.ADMIN | UserRole.SUPER_ADMIN
  ) => {
    if (!activeUser?.id) {
      throw new Error('Authenticated administrator is required.');
    }
    const target = allUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!target) {
      if (!runtimeConfig.isDemo) {
        Alert.alert(
          'Secure Governance Required',
          'Administrator role management requires the secure server governance workflow.'
        );
        return;
      }
    } else {
      await ProfileAdminRepository.changeRole(
        target.id,
        role,
        role === UserRole.SUPER_ADMIN ? 'SUPER_ADMIN' : 'ADMIN'
      );
    }

    await loadPlatformData();
  };

  // 10. Revoke Admin
  const handleRevokeAdmin = async (userId: string) => {
    if (!activeUser?.id) {
      throw new Error('Authenticated administrator is required.');
    }
    if (userId === activeUser.id) {
      Alert.alert('Protection', 'You cannot revoke your own administrator credentials.');
      return;
    }

    await ProfileAdminRepository.changeRole(userId, UserRole.CUSTOMER, 'CUSTOMER');
    await loadPlatformData();
  };



  // 11. Toggle User Profile Suspension via suspend_user_profile_secure RPC
  const handleToggleSuspendUser = async (
    userId: string,
    shouldSuspend: boolean,
    reason?: string
  ) => {
    if (!activeUser?.id) {
      throw new Error('Authenticated administrator is required.');
    }
    const { supabase: sbClient, isSupabaseConfigured } = await import('../../lib/supabase');
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await sbClient.rpc('suspend_user_profile_secure', {
      p_user_id: userId,
      p_should_suspend: shouldSuspend,
      p_reason: reason || (shouldSuspend ? 'Administrative suspension' : 'Reinstatement'),
    });
    if (error) {
      console.error('handleToggleSuspendUser error:', error.message);
      throw new Error(error.message);
    }
    await loadPlatformData();
  };

  // --- STATS & ATTENTION CENTER COMPUTATION (AUTHORITATIVE) ---

  const pendingAppsCount = attentionSummary ? attentionSummary.pendingApplications : applications.filter((a) => a.status === 'PENDING').length;
  const openReportsCount = attentionSummary ? attentionSummary.openDataReports : reports.filter((r) => r.status === 'OPEN').length;
  const suspendedCount = restaurants.filter(
    (r) => r.isSuspended || r.verificationStatus === 'SUSPENDED'
  ).length;
  const pendingRefundsCount = attentionSummary ? attentionSummary.pendingRefundsCount : refunds.filter((r) => r.status === 'REQUESTED').length;
  const pendingSettlementsCount = settlements.filter((s) => s.status === 'CALCULATED').length;
  const stalePaymentsCount = attentionSummary ? attentionSummary.stalePayments : 0;
  const failedOutboxCount = attentionSummary ? attentionSummary.failedOutbox : 0;
  const unsettledLedgerCount = attentionSummary ? attentionSummary.unsettledLedgerCount : 0;

  // Stale spots: calculated only if menu verification data exists, otherwise truthful empty
  const staleSpots = restaurants.filter((r) => {
    if (!r.updatedAt) return false;
    // We only consider stale if verification status indicates needs review
    return r.verificationStatus === 'PENDING_VERIFICATION';
  });

  // Attention Items
  const attentionItems: AttentionItem[] = [];

  if (stalePaymentsCount > 0) {
    attentionItems.push({
      id: 'att-stale-payments',
      severity: 'CRITICAL',
      title: `${stalePaymentsCount} Stale Payment(s) Pending Gateway Capture`,
      description: 'Payments pending gateway capture reconciliation.',
      targetTab: 'PAYMENTS',
      count: stalePaymentsCount,
    });
  }

  if (failedOutboxCount > 0) {
    attentionItems.push({
      id: 'att-failed-outbox',
      severity: 'CRITICAL',
      title: `${failedOutboxCount} Dead-Letter / Failed Outbox Notification(s)`,
      description: 'Outbox messages exceeded retry limit. Review communication channels.',
      targetTab: 'NOTIFICATIONS',
      count: failedOutboxCount,
    });
  }

  if (suspendedCount > 0) {
    attentionItems.push({
      id: 'att-suspended',
      severity: 'CRITICAL',
      title: `${suspendedCount} Suspended Restaurant(s)`,
      description: 'Review compliance status and determine reinstatement or permanent delisting.',
      targetTab: 'RESTAURANTS',
      count: suspendedCount,
    });
  }

  if (pendingAppsCount > 0) {
    attentionItems.push({
      id: 'att-apps',
      severity: 'HIGH',
      title: `${pendingAppsCount} Vendor Application(s) Pending`,
      description: 'Review submitted TIN credentials, phone numbers, and approve for launch.',
      targetTab: 'APPLICATIONS',
      count: pendingAppsCount,
    });
  }

  if (pendingRefundsCount > 0) {
    attentionItems.push({
      id: 'att-refunds',
      severity: 'HIGH',
      title: `${pendingRefundsCount} Refund Request(s) Pending`,
      description: 'Customer or operator requested transaction reversals awaiting approval.',
      targetTab: 'REFUNDS',
      count: pendingRefundsCount,
    });
  }

  if (pendingSettlementsCount > 0 || unsettledLedgerCount > 0) {
    const sCount = pendingSettlementsCount > 0 ? pendingSettlementsCount : unsettledLedgerCount;
    attentionItems.push({
      id: 'att-settlements',
      severity: 'MEDIUM',
      title: `${sCount} Merchant Settlement / Ledger Entry(s) Pending`,
      description: 'Merchant ledger balances awaiting batch calculation and payout generation.',
      targetTab: 'SETTLEMENTS',
      count: sCount,
    });
  }

  if (staleSpots.length > 0) {
    attentionItems.push({
      id: 'att-stale',
      severity: 'HIGH',
      title: `${staleSpots.length} Restaurant(s) With Stale Menus`,
      description: 'Prices have not been confirmed in > 30 days. Send reverification reminders.',
      targetTab: 'VERIFICATION',
      count: staleSpots.length,
    });
  }

  if (openReportsCount > 0) {
    attentionItems.push({
      id: 'att-reports',
      severity: 'MEDIUM',
      title: `${openReportsCount} Open Customer Discrepancy Report(s)`,
      description: 'Customers flagged wrong prices or out-of-stock items in the catalog.',
      targetTab: 'REPORTS',
      count: openReportsCount,
    });
  }

  // Financial KPIs calculated STRICTLY from real public.payments (SUCCESS only)
  const successfulPayments = rawPayments.filter((p) => p.status === 'SUCCESS');
  const grossVolumeTzs = successfulPayments.reduce((acc, p) => acc + (p.amountTzs || 0), 0);
  const platformRevenueTzs = successfulPayments.reduce(
    (acc, p) => acc + (p.platformCommissionTzs || 0),
    0
  );

  // Order Metrics calculated STRICTLY from real public.orders
  const totalOrders = standardOrders.length;
  const completedOrdersCount = standardOrders.filter((o) => o.status === 'COMPLETED').length;

  const verifiedCount = restaurants.filter(
    (r) => (r.sellerTier === 'VERIFIED_RESTAURANT' || r.sellerTier === 'VERIFIED_SELLER') && !r.isSuspended
  ).length;
  const basicCount = restaurants.filter((r) => r.sellerTier === 'BASIC_SELLER' && !r.isSuspended).length;

  // Freshness score: do NOT fabricate 100% when restaurants array is empty
  const freshnessPct =
    restaurants.length > 0
      ? Math.round(((restaurants.length - staleSpots.length) / restaurants.length) * 100)
      : 0;

  const adminUsersList = allUsers.filter(
    (u) =>
      u.role === UserRole.ADMIN ||
      u.role === UserRole.SUPER_ADMIN ||
      u.roles?.includes(UserRole.ADMIN) ||
      u.roles?.includes(UserRole.SUPER_ADMIN)
  );

  return (
    <SafeAreaView style={[styles.screenContainer, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* 1. Header */}
      <AdminHeader
        userName={activeUser?.fullName || 'Operator'}
        userRole={activeUser?.role || UserRole.CUSTOMER}
        isRefreshing={isRefreshing}
        onRefresh={loadPlatformData}
        onLogout={async () => {
          await logout();
          router.replace('/auth/login');
        }}
      />

      {/* 2. Mobile Nav when on small screens */}
      {!isLargeScreen && (
        <AdminMobileNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          userRole={activeUser?.role}
          language={language}
          badges={{
            pendingApplications: pendingAppsCount,
            openReports: openReportsCount,
            staleMenus: staleSpots.length,
            criticalAttention: attentionItems.filter((a) => a.severity === 'CRITICAL').length,
            pendingRefunds: pendingRefundsCount,
            pendingSettlements: pendingSettlementsCount,
          }}
        />
      )}

      {/* 3. Main Body */}
      <View style={styles.mainLayout}>
        {/* Left Sidebar on Large Screens */}
        {isLargeScreen && (
          <AdminSidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            userRole={activeUser?.role}
            language={language}
            badges={{
              pendingApplications: pendingAppsCount,
              openReports: openReportsCount,
              staleMenus: staleSpots.length,
              criticalAttention: attentionItems.filter((a) => a.severity === 'CRITICAL').length,
              pendingRefunds: pendingRefundsCount,
              pendingSettlements: pendingSettlementsCount,
            }}
          />
        )}

        {/* Right Active Content Panel */}
        <View style={[styles.contentPanel, { backgroundColor: isDark ? colors.background : '#f8fafc' }]}>
          {loadError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color="#b91c1c" />
              <Text style={styles.errorText}>{loadError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadPlatformData}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'OVERVIEW' && (
            <AdminOverview
              stats={{
                totalRestaurants: restaurants.length,
                basicSellers: basicCount,
                verifiedSellers: verifiedCount,
                suspendedRestaurants: suspendedCount,
                pendingApplications: pendingAppsCount,
                openReports: openReportsCount,
                totalOrders,
                completedOrders: completedOrdersCount,
                grossVolumeTzs,
                platformRevenueTzs,
                freshnessScorePct: freshnessPct,
              }}
              attentionItems={attentionItems}
              systemHealth={systemHealth}
              onNavigateTab={setActiveTab}
              language={language}
            />
          )}

          {activeTab === 'APPLICATIONS' && (
            <ApplicationsQueue
              applications={applications as any}
              onApprove={handleApproveApp}
              onReject={handleRejectApp}
              onRequestChanges={handleRequestAppChanges}
              language={language}
            />
          )}

          {activeTab === 'RESTAURANTS' && (
            <RestaurantsManager
              restaurants={restaurants}
              onSuspend={handleSuspendRestaurant}
              onReactivate={handleReactivateRestaurant}
              onUpgradeToVerified={handleUpgradeToVerified}
              onDelete={handleDeleteRestaurant}
              onArchive={handleArchiveRestaurant}
              onUnarchive={handleUnarchiveRestaurant}
              language={language}
            />
          )}

          {activeTab === 'VERIFICATION' && (
            <VerificationCenter
              restaurants={restaurants}
              onTriggerReverification={handleTriggerReverification}
              language={language}
            />
          )}

          {activeTab === 'REPORTS' && (
            <CustomerReportsAdmin
              reports={reports}
              onResolveReport={handleResolveReport}
              language={language}
            />
          )}

          {activeTab === 'ORDERS' && (
            <OrdersMonitor
              orders={standardOrders}
              language={language}
            />
          )}

          {activeTab === 'PAYMENTS' && (
            <PaymentsMonitor
              payments={paymentsList}
              language={language}
            />
          )}

          {activeTab === 'REFUNDS' && (
            <RefundsDisputesCenter
              language={language}
            />
          )}

          {activeTab === 'SETTLEMENTS' && (
            <SettlementsPayoutsCenter
              language={language}
            />
          )}

          {activeTab === 'USERS' && (
            <UsersManager
              users={allUsers}
              onToggleSuspendUser={handleToggleSuspendUser}
              language={language}
            />
          )}

          {activeTab === 'ADMIN_USERS' && (
            <AdminUsersManager
              currentUserId={activeUser?.id}
              currentUserRole={activeUser?.role}
              adminUsers={adminUsersList}
              onGrantAdmin={handleGrantAdmin}
              onRevokeAdmin={handleRevokeAdmin}
              language={language}
            />
          )}

          {activeTab === 'NOTIFICATIONS' && (
            <NotificationsCenter
              notifications={notifications}
              language={language}
            />
          )}

          {activeTab === 'AUDIT_LOGS' && (
            <AuditLogViewer
              logs={auditLogs}
              language={language}
            />
          )}

          {activeTab === 'ANALYTICS' && (
            <PlatformAnalytics
              language={language}
            />
          )}

          {activeTab === 'HEALTH' && (
            <SystemHealth
              language={language}
            />
          )}

          {activeTab === 'SETTINGS' && (
            <AdminSettings
              language={language}
            />
          )}
        </View>
      </View>

      {/* Newly Created Vendor Credentials Modal */}
      {createdVendorModal && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.credCard}>
              <View style={styles.credHeader}>
                <Ionicons name="checkmark-circle" size={40} color="#16a34a" />
                <Text style={styles.credTitle}>Restaurant Application Approved</Text>
                <Text style={styles.credSubtitle}>
                  "{createdVendorModal.businessName}" has been approved.
                </Text>
              </View>

              <View style={styles.credBox}>
                <Text style={styles.credLabel}>Owner Full Name:</Text>
                <Text style={styles.credValue}>{createdVendorModal.ownerName}</Text>

                <Text style={styles.credLabel}>Login Email / Username:</Text>
                <Text style={styles.credValue}>{createdVendorModal.ownerEmail || 'Registered via application'}</Text>

                <Text style={styles.credLabel}>Login Phone Number:</Text>
                <Text style={styles.credValue}>{createdVendorModal.ownerPhone}</Text>

                <Text style={styles.credLabel}>Application / Restaurant ID:</Text>
                <Text style={styles.credValue}>{createdVendorModal.restaurantId}</Text>

                <Text style={styles.credLabel}>Portal Access & Login:</Text>
                <Text style={[styles.credValue, { color: '#0f766e', fontSize: 12.5 }]}>
                  Owner can sign in at /auth/login (Kitchen Portal) or activate via /auth/activate-restaurant
                </Text>

                <Text style={styles.credLabel}>Status & Visibility:</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Ionicons
                    name="information-circle"
                    size={16}
                    color="#0284c7"
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: '#0284c7',
                    }}
                  >
                    Approved (Unpublished until setup is completed)
                  </Text>
                </View>
              </View>

              <Text style={styles.credNote}>
                SMS dispatch notice: An SMS notification with activation instructions has been queued for {createdVendorModal.ownerPhone}. The restaurant workspace is approved and remains unpublished until initial branch and menu setup is completed.
              </Text>

              <TouchableOpacity
                style={styles.credDoneBtn}
                onPress={() => setCreatedVendorModal(null)}
              >
                <Text style={styles.credDoneText}>Done & Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentPanel: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    margin: Spacing.md,
    borderRadius: Radii.md,
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#991b1b',
    fontWeight: '500',
  },
  retryBtn: {
    backgroundColor: '#b91c1c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  unauthContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  unauthCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: Spacing.md,
    ...Shadows.md,
  },
  unauthIcon: {
    width: 64,
    height: 64,
    borderRadius: Radii.full,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unauthTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  unauthSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  unauthActions: {
    width: '100%',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  unauthPrimaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  unauthPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  unauthSecondaryBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  unauthSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  credCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    maxWidth: 460,
    width: '100%',
    gap: Spacing.md,
    ...Shadows.lg,
  },
  credHeader: {
    alignItems: 'center',
    gap: 6,
  },
  credTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  credSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  credBox: {
    backgroundColor: '#f8fafc',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  credLabel: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  credValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  pinValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 2,
    marginTop: 2,
  },
  credNote: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  credDoneBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  credDoneText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
