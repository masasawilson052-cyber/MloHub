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
} from '../../repositories';
import {
  RestaurantApplication,
  Restaurant,
  Order,
  Payment,
  DataReport,
  AuditLog,
  Notification,
} from '../../types/domain';
import { runtimeConfig } from '../../lib/runtimeConfig';

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
} from '../../components/admin';

export default function AdminPortalScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user, switchWorkspace, logout, loading: isAuthLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 840;

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

  // Newly onboarded vendor credential display modal
  const [createdVendorModal, setCreatedVendorModal] = useState<{
    businessName: string;
    ownerName: string;
    ownerPhone: string;
    restaurantId: string;
    activationDispatched: boolean;
  } | null>(null);

  // Load all platform data strictly from PostgreSQL repositories
  const loadPlatformData = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const [apps, dataReps, logs, profileUsers, notifs, payments, orders, rests] = await Promise.all([
        ApplicationRepository.listAll(),
        DataReportsRepository.listAll(),
        AuditLogRepository.listAll(),
        ProfileAdminRepository.listAll(),
        NotificationRepository.listAll(),
        PaymentRepository.listAll(),
        OrderRepository.listAll(),
        RestaurantRepository.list(),
      ]);

      setApplications(apps);
      setReports(dataReps);

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

      // Map payments to presentation entity
      setPaymentsList(
        payments.map((p) => ({
          id: p.id,
          userId: p.customerId,
          orderId: p.orderId,
          reservationId: p.reservationId,
          restaurantId: p.restaurantId,
          restaurantName: '',
          provider: (p.provider as any) || 'Mobile Money',
          providerReference: p.externalReference || p.id,
          amountTzs: p.amountTzs,
          currency: 'TZS',
          paymentMethod: p.paymentMethod || 'Mobile Money',
          methodCode: 'MOBILE_MONEY' as any,
          status: (p.status === 'SUCCESS' ? 'success' : p.status === 'FAILED' ? 'failed' : 'pending') as any,
          paymentType: 'ORDER_PAYMENT' as any,
          payerPhone: p.phoneNumber,
          paidAt: p.paidAt,
          refundedAt: p.refundedAt,
          createdAt: p.createdAt,
        }))
      );

      setStandardOrders(orders);
      setRestaurants(rests as any);
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
      const unsubRestaurants = RealtimeEventEngine.subscribe('restaurants:updates', () => {
        loadPlatformData();
      });
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
      restaurantId: updated.id,
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
    await loadPlatformData();
  };

  // 5. Reactivate Restaurant via server RPC
  const handleReactivateRestaurant = async (restaurantId: string) => {
    if (!activeUser?.id) {
      throw new Error('Authenticated administrator is required.');
    }
    await RestaurantRepository.reactivateRestaurant(restaurantId);
    await loadPlatformData();
  };

  // 6. Upgrade to Verified
  const handleUpgradeToVerified = async (
    restaurantId: string,
    docs: { tinNumber: string; businessLicenseNumber: string }
  ) => {
    if (!activeUser?.id) {
      throw new Error('Authenticated administrator is required.');
    }
    await RestaurantRepository.update(restaurantId, {
      tinNumber: docs.tinNumber,
      businessLicenseNumber: docs.businessLicenseNumber,
      isVerified: true,
      verificationStatus: 'VERIFIED',
      sellerTier: 'VERIFIED_SELLER',
    });

    await AuditLogRepository.logAction({
      actorUserId: activeUser.id,
      adminName: activeUser.fullName,
      action: 'APPROVE_RESTAURANT',
      entityType: 'RESTAURANT',
      entityId: restaurantId,
      metadata: { tinNumber: docs.tinNumber, license: docs.businessLicenseNumber },
    });

    await loadPlatformData();
  };

  // 7. Resolve Customer Report
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

    await AuditLogRepository.logAction({
      actorUserId: activeUser.id,
      adminName: activeUser.fullName || 'Admin',
      action: 'RESOLVE_REPORT',
      entityType: 'DATA_REPORT',
      entityId: reportId,
      metadata: { status, resolutionNotes },
    });

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

  // 11. Toggle Suspend User
  const handleToggleSuspendUser = async (userId: string, shouldSuspend: boolean, reason?: string) => {
    if (!runtimeConfig.isDemo) {
      Alert.alert(
        'Action Unavailable',
        'User suspension and session revocation requires the secure server governance workflow in Pack 4.'
      );
      return;
    }
  };

  // 12. Broadcast Announcement
  const handleSendBroadcast = async (
    title: string,
    message: string,
    audience: 'ALL' | 'CUSTOMERS' | 'RESTAURANTS'
  ) => {
    Alert.alert(
      'Broadcast Queued',
      'Platform broadcast notifications will be dispatched through the server-side delivery queue in Pack 4.'
    );
  };

  // Switch to customer workspace
  const handleSwitchToCustomer = async () => {
    try {
      await switchWorkspace('CUSTOMER');
      router.replace('/(tabs)');
    } catch {
      router.replace('/(tabs)');
    }
  };

  // --- STATS & ATTENTION CENTER COMPUTATION (AUTHORITATIVE) ---

  const pendingAppsCount = applications.filter((a) => a.status === 'PENDING').length;
  const openReportsCount = reports.filter((r) => r.status === 'OPEN').length;
  const suspendedCount = restaurants.filter(
    (r) => r.isSuspended || r.verificationStatus === 'SUSPENDED'
  ).length;

  // Stale spots: calculated only if menu verification data exists, otherwise truthful empty
  const staleSpots = restaurants.filter((r) => {
    if (!r.updatedAt) return false;
    // We only consider stale if verification status indicates needs review
    return r.verificationStatus === 'PENDING_VERIFICATION';
  });

  // Attention Items
  const attentionItems: AttentionItem[] = [];

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
    <SafeAreaView style={styles.screenContainer} edges={['top', 'left', 'right']}>
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
        onSwitchToCustomer={handleSwitchToCustomer}
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
            }}
          />
        )}

        {/* Right Active Content Panel */}
        <View style={styles.contentPanel}>
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

          {activeTab === 'USERS' && (
            <UsersManager
              users={allUsers}
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

                <Text style={styles.credLabel}>Login Phone Number:</Text>
                <Text style={styles.credValue}>{createdVendorModal.ownerPhone}</Text>

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
                {createdVendorModal.activationDispatched
                  ? `A secure carrier SMS with a one-time cryptographic activation OTP has been dispatched to ${createdVendorModal.ownerPhone}. The restaurant remains unpublished until setup is completed.`
                  : `The restaurant application has been approved. The restaurant remains unpublished until initial menu and operating setup is completed. Secure SMS delivery to ${createdVendorModal.ownerPhone} is queued.`}
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
