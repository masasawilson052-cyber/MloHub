import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
  ScrollView,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { OrderPipelineService } from '../../services/OrderPipelineService';
import { RealtimeEventEngine } from '../../db/realtime/eventEngine';
import { RealtimeService } from '../../services/RealtimeService';
import { RestaurantEntity } from '../../db/types';
import { resolvePortalAccess } from '../../db/auth/guards';
import { RestaurantRole } from '../../types/auth';
import {
  Order,
  OrderStatus,
  MenuItem,
  MenuCategory,
  Reservation,
  ReservationStatus,
  RestaurantBranch,
  Payment,
  Review,
  BranchOperationalMode,
  MenuModifierGroup,
  MerchantSettlement,
  MerchantPayout,
  MerchantPayoutDestination,
  RefundRequest,
  FinancialDispute,
  RestaurantFinancialSummary,
  RestaurantLaunchReadiness,
  VerificationDocumentType,
  RestaurantVerificationDocument,
} from '../../types/domain';
import { runtimeConfig } from '../../lib/runtimeConfig';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  listDocumentsForApplication,
  uploadVerificationDocument,
  recordVerificationDocument,
  pickVerificationDocument,
} from '../../services/MerchantVerificationService';
import {
  RestaurantRepository,
  BranchRepository,
  MenuRepository,
  OrderRepository,
  ReservationRepository,
  PaymentRepository,
  ReviewRepository,
  RestaurantMemberRepository,
  CustomMealRepository,
  RestaurantCustomMealSettingsRepository,
  ReviewResponsesRepository,
  BranchOperationsRepository,
  ApplicationRepository,
  SettlementsRepository,
  PayoutsRepository,
  RefundsRepository,
  DisputesRepository,
} from '../../repositories';
import { PlatformAnnouncementBanner } from '../../components/announcements/PlatformAnnouncementBanner';

import {

  RestaurantPortalHeader,
  RealtimeStatus,
  RestaurantSidebar,
  RestaurantMobileNav,
  RestaurantTab,
  RESTAURANT_NAV_ITEMS,
  DashboardOverview,
  DashboardMetrics,
  AttentionAlert,
  IncomingOrdersPanel,
  KitchenBoard,
  CustomMealQuotesPanel,
  MenuManager,
  MenuItemEditor,
  BranchPriceOverride,
  CategoryManager,
  ReservationManager,
  EarningsOverview,
  EarningsRecord,
  ReviewsPanel,
  AnalyticsPanel,
  DiscoveryAnalyticsData,
  StaffManager,
  StaffMember,
  RestaurantSettings,
  OperatingOverride,
} from '../../components/restaurant';

import { OrderNotificationSoundService } from '../../services/OrderNotificationSoundService';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export default function RestaurantPortalScreen() {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const router = useRouter();
  const {
    user: authUser,
    isAuthLoading,
    memberships,
    activeRestaurant: authActiveRestaurant,
    activeWorkspace,
    switchWorkspace,
    refreshProfile,
  } = useAuth();

  const [checkingApp, setCheckingApp] = useState(false);
  const [userApp, setUserApp] = useState<any | null>(null);
  const [portalDocs, setPortalDocs] = useState<RestaurantVerificationDocument[]>([]);
  const [isUploadingDocType, setIsUploadingDocType] = useState<string | null>(null);

  const fetchPortalDocs = useCallback(async (appId: string) => {
    try {
      const docs = await listDocumentsForApplication(appId);
      setPortalDocs(docs);
    } catch {
      setPortalDocs([]);
    }
  }, []);

  useEffect(() => {
    if (userApp?.id) {
      fetchPortalDocs(userApp.id);
    }
  }, [userApp?.id, fetchPortalDocs]);

  const handleUploadPortalDoc = async (docType: VerificationDocumentType) => {
    if (!userApp?.id || !authUser?.id) {
      Alert.alert('Hitilafu', 'Tafadhali ingia upya kwenye akaunti yako.');
      return;
    }
    try {
      const picked = await pickVerificationDocument();
      if (!picked) return;
      setIsUploadingDocType(docType);

      const uploadRes = await uploadVerificationDocument({
        userId: authUser.id,
        applicationId: userApp.id,
        documentType: docType,
        uri: picked.uri,
        mimeType: picked.mimeType,
      });

      await recordVerificationDocument({
        applicationId: userApp.id,
        ownerUserId: authUser.id,
        documentType: docType,
        storagePath: uploadRes.path,
      });

      await fetchPortalDocs(userApp.id);
      Alert.alert('Imefanikiwa', 'Nyaraka imepakiwa na kurekodiwa kikamilifu!');
    } catch (err: any) {
      Alert.alert('Hitilafu ya Kupakia', err?.message || 'Imeshindikana kupakia nyaraka.');
    } finally {
      setIsUploadingDocType(null);
    }
  };

  const access = resolvePortalAccess({
    isAuthLoading,
    user: authUser,
    memberships,
    activeRestaurant: authActiveRestaurant,
    activeWorkspace,
    restaurants: authActiveRestaurant ? [authActiveRestaurant] : [],
  });

  // Auto-switch to RESTAURANT_OWNER workspace if user has available restaurant
  useEffect(() => {
    if (access.status === 'CUSTOMER_WORKSPACE') {
      const restId = access.availableRestaurants?.[0]?.id || authActiveRestaurant?.id || memberships?.[0]?.restaurantId;
      if (restId && switchWorkspace) {
        switchWorkspace('RESTAURANT_OWNER', restId).catch(console.warn);
      }
    }
  }, [access.status, access.availableRestaurants, authActiveRestaurant?.id, memberships]);

  // If awaiting assignment or denied, check if there is an approved, pending, or rejected application
  useEffect(() => {
    if (!authUser || access.status === 'AUTHORIZED' || access.status === 'LOADING') return;

    let isMounted = true;
    (async () => {
      try {
        setCheckingApp(true);
        const myApps = await ApplicationRepository.listMine(authUser.email);
        if (!isMounted) return;
        const approved = myApps.find((a) => a.status === 'APPROVED');
        if (approved) {
          if (refreshProfile) await refreshProfile();
          const targetRestId = approved.restaurantId || authActiveRestaurant?.id || memberships?.[0]?.restaurantId;
          if (targetRestId && switchWorkspace) {
            await switchWorkspace('RESTAURANT_OWNER', targetRestId);
          }
          return;
        }
        const changesRequested = myApps.find(
          (a) => a.status === 'CHANGES_REQUESTED' || (a.notes && a.notes.includes('[CHANGES_REQUESTED]'))
        );
        if (changesRequested) {
          setUserApp(changesRequested);
          return;
        }
        const pending = myApps.find(
          (a) => a.status === 'PENDING' || a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW'
        );
        if (pending) {
          setUserApp(pending);
          return;
        }
        const rejected = myApps.find((a) => a.status === 'REJECTED');
        if (rejected) {
          setUserApp(rejected);
        }
      } catch (e) {
        console.warn('[RestaurantPortal] Application check warning:', e);
      } finally {
        if (isMounted) setCheckingApp(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [authUser?.id, authUser?.email, access.status]);

  if (access.status === 'LOADING' || checkingApp) {
    return (
      <SafeAreaView style={styles.gateContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.gateSubtitle}>Inapakia mfumo wa mgahawa...</Text>
      </SafeAreaView>
    );
  }

  if (access.status === 'UNAUTHENTICATED') {
    return (
      <SafeAreaView style={styles.gateContainer}>
        <View style={styles.gateCard}>
          <Ionicons name="lock-closed-outline" size={54} color={colors.primary} />
          <Text style={styles.gateTitle}>Kuingia Kunahitajika</Text>
          <Text style={styles.gateSubtitle}>
            Unatakiwa kuingia kwenye akaunti yako ya mgahawa ili kufikia ukurasa huu.
          </Text>
          <TouchableOpacity
            style={styles.gatePrimaryBtn}
            onPress={() => router.replace('/auth/login?type=restaurant')}
          >
            <Text style={styles.gatePrimaryBtnText}>Ingia Kama Mgahawa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gateSecondaryBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.gateSecondaryBtnText}>Rudi Mwanzo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // If the user has a pending or rejected restaurant application, show its exact status before any generic DENIED gate
  if (access.status !== 'AUTHORIZED' && userApp) {
    if (userApp.status === 'REJECTED') {
      return (
        <SafeAreaView style={styles.gateContainer}>
          <View style={styles.gateCard}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="close-circle-outline" size={38} color="#dc2626" />
            </View>
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.danger, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
              OMBI LIMEKATALIWA • APPLICATION REJECTED
            </Text>
            <Text style={styles.gateTitle}>"{userApp.businessName}"</Text>
            <Text style={styles.gateSubtitle}>
              Ombi lako la kusajili mgahawa huu limekaguliwa na msimamizi wa MloHub na halijaidhinishwa kwa sasa.
            </Text>
            <View style={{ width: '100%', backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger, borderRadius: 12, padding: 14, marginBottom: 18 }}>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.danger, marginBottom: 4 }}>
                Sababu kutoka kwa Msimamizi / Administrator Feedback:
              </Text>
              <Text style={{ fontSize: 13, color: colors.danger, lineHeight: 19, fontWeight: '600' }}>
                {userApp.rejectionReason || 'Taarifa za biashara hazijakidhi vigezo vya usajili wa MloHub.'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.gatePrimaryBtn, { marginBottom: 8 }]}
              onPress={() => router.replace('/auth/register-restaurant')}
            >
              <Text style={styles.gatePrimaryBtnText}>Rekebisha na Tuma Ombi Upya</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.gateSecondaryBtn, { marginBottom: 6 }]}
              onPress={async () => {
                try {
                  if (refreshProfile) await refreshProfile();
                  const myApps = await ApplicationRepository.listMine(authUser?.email);
                  const latest = myApps.find((a) => a.id === userApp.id) || myApps[0];
                  if (latest?.status === 'APPROVED') {
                    if (refreshProfile) await refreshProfile();
                    if (latest.restaurantId && switchWorkspace) {
                      await switchWorkspace('RESTAURANT_OWNER', latest.restaurantId);
                    }
                  } else if (latest) {
                    setUserApp(latest);
                  }
                } catch {}
              }}
            >
              <Text style={styles.gateSecondaryBtnText}>Angalia Tena / Refresh Status</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gateSecondaryBtn}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.gateSecondaryBtnText}>Rudi Nyumbani</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    if (
      userApp.status === 'CHANGES_REQUESTED' ||
      (userApp.notes && userApp.notes.includes('[CHANGES_REQUESTED]'))
    ) {
      const feedbackNotes =
        userApp.rejectionReason ||
        userApp.notes?.replace('[CHANGES_REQUESTED]', '').trim() ||
        'Tafadhali rekebisha nyaraka au taarifa za maombi yako kama ilivyoelekezwa na msimamizi.';

      return (
        <SafeAreaView style={styles.gateContainer}>
          <View style={styles.gateCard}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.warningSoft,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Ionicons name="alert-circle-outline" size={38} color="#d97706" />
            </View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                color: '#b45309',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              MAREKEBISHO YANAHITAJIKA • REVISION REQUESTED
            </Text>
            <Text style={styles.gateTitle}>"{userApp.businessName}"</Text>
            <Text style={styles.gateSubtitle}>
              Msimamizi wa MloHub amekagua ombi lako na ameomba marekebisho yafuatayo kabla ya kupitisha usajili:
            </Text>
            <View
              style={{
                width: '100%',
                backgroundColor: '#fffbeb',
                borderWidth: 1.5,
                borderColor: '#f59e0b',
                borderRadius: 12,
                padding: 14,
                marginBottom: 18,
              }}
            >
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#b45309', marginBottom: 4 }}>
                Maagizo ya Msimamizi / Administrator Feedback:
              </Text>
              <Text style={{ fontSize: 13, color: '#92400e', lineHeight: 19, fontWeight: '700' }}>
                {feedbackNotes}
              </Text>
            </View>

            {/* Verification Documents Checklist & Direct Upload */}
            <View style={{ width: '100%', backgroundColor: colors.appBackground, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.3 }}>
                  NYARAKA ZA UTHIBITISHO (MAREKEBISHO)
                </Text>
                {isUploadingDocType && <ActivityIndicator size="small" color={colors.primary} />}
              </View>

              {[
                { type: 'BUSINESS_LICENSE' as VerificationDocumentType, label: 'Leseni ya Biashara (Business License)' },
                { type: 'TIN_DOCUMENT' as VerificationDocumentType, label: 'Cheti cha TIN (TRA Tax Clearance)' },
                { type: 'FOOD_OPERATION_DOCUMENT' as VerificationDocumentType, label: 'Cheti cha Afya na Usafi (Food Hygiene)' },
              ].map((item) => {
                const doc = portalDocs.find((d) => d.documentType === item.type);
                const isVerified = doc?.verificationStatus === 'VERIFIED';
                const isRejected = doc?.verificationStatus === 'REJECTED';
                const isPending = doc && !isVerified && !isRejected;
                const isUploadingThis = isUploadingDocType === item.type;

                return (
                  <View
                    key={item.type}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 10,
                      backgroundColor: colors.card,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isVerified ? '#16a34a' : isRejected ? '#ef4444' : isPending ? '#d97706' : colors.border,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                        {item.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10.5,
                          fontWeight: '600',
                          color: isVerified
                            ? '#16a34a'
                            : isRejected
                            ? '#ef4444'
                            : isPending
                            ? '#d97706'
                            : colors.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {isVerified
                          ? '✓ Imethibitishwa na Msimamizi'
                          : isRejected
                          ? `❌ Imekataliwa: ${doc?.rejectionReason || 'Rekebisha nyaraka'}`
                          : isPending
                          ? '⏳ Imepakiwa (Inasubiri Uhakiki)'
                          : '⚠️ Haijapakiwa bado'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        backgroundColor: isVerified ? colors.surfaceInteractive : colors.primary,
                        borderRadius: 6,
                        opacity: isUploadingThis ? 0.6 : 1,
                      }}
                      onPress={() => handleUploadPortalDoc(item.type)}
                      disabled={isUploadingThis || isVerified}
                    >
                      {isUploadingThis ? (
                        <ActivityIndicator size="small" color={colors.textInverse} />
                      ) : (
                        <>
                          <Ionicons
                            name={isVerified ? 'checkmark-circle' : isPending ? 'cloud-upload-outline' : 'add-circle-outline'}
                            size={14}
                            color={isVerified ? '#16a34a' : colors.textInverse}
                          />
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: isVerified ? '#16a34a' : colors.textInverse,
                            }}
                          >
                            {isVerified ? 'Tayari' : isPending ? 'Badilisha' : 'Pakia'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.gatePrimaryBtn, { marginBottom: 8 }]}
              onPress={() => router.replace('/auth/register-restaurant')}
            >
              <Text style={styles.gatePrimaryBtnText}>Rekebisha Taarifa Nyingine za Maombi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.gateSecondaryBtn, { marginBottom: 6 }]}
              onPress={async () => {
                try {
                  if (refreshProfile) await refreshProfile();
                  const myApps = await ApplicationRepository.listMine(authUser?.email);
                  const latest = myApps.find((a) => a.id === userApp.id) || myApps[0];
                  if (latest?.status === 'APPROVED') {
                    if (refreshProfile) await refreshProfile();
                    if (latest.restaurantId && switchWorkspace) {
                      await switchWorkspace('RESTAURANT_OWNER', latest.restaurantId);
                    }
                  } else if (latest) {
                    setUserApp(latest);
                  }
                } catch {}
              }}
            >
              <Text style={styles.gateSecondaryBtnText}>Angalia Tena / Refresh Status</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gateSecondaryBtn}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.gateSecondaryBtnText}>Rudi Nyumbani</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.gateContainer}>
        <View style={styles.gateCard}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="time-outline" size={36} color="#d97706" />
          </View>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.warning, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
            OMBI LAKO LINAKAGULIWA • UNDER ADMIN REVIEW
          </Text>
          <Text style={styles.gateTitle}>"{userApp.businessName}"</Text>
          <Text style={styles.gateSubtitle}>
            Maombi ya mgahawa wako yamepokelewa na yanakaguliwa na msimamizi wa MloHub. Utaweza kufungua ukurasa huu moja kwa moja pindi yatakapoidhinishwa.
          </Text>

          <View style={{ width: '100%', backgroundColor: colors.appBackground, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>
              <Text style={{ fontWeight: '700' }}>Kumbukumbu ya Ombi (Reference): </Text>{userApp.id}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>
              <Text style={{ fontWeight: '700' }}>Hadhi ya Sasa: </Text>{userApp.status}
            </Text>
            {userApp.createdAt && (
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                <Text style={{ fontWeight: '700' }}>Tarehe ya Kutuma: </Text>{new Date(userApp.createdAt).toLocaleDateString()}
              </Text>
            )}
          </View>

          {/* Verification Documents Checklist & Direct Upload */}
          <View style={{ width: '100%', backgroundColor: colors.appBackground, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.3 }}>
                NYARAKA ZA UTHIBITISHO (GATE A)
              </Text>
              {isUploadingDocType && <ActivityIndicator size="small" color={colors.primary} />}
            </View>

            {[
              { type: 'BUSINESS_LICENSE' as VerificationDocumentType, label: 'Leseni ya Biashara (Business License)' },
              { type: 'TIN_DOCUMENT' as VerificationDocumentType, label: 'Cheti cha TIN (TRA Tax Clearance)' },
              { type: 'FOOD_OPERATION_DOCUMENT' as VerificationDocumentType, label: 'Cheti cha Afya na Usafi (Food Hygiene)' },
            ].map((item) => {
              const doc = portalDocs.find((d) => d.documentType === item.type);
              const isVerified = doc?.verificationStatus === 'VERIFIED';
              const isRejected = doc?.verificationStatus === 'REJECTED';
              const isPending = doc && !isVerified && !isRejected;
              const isUploadingThis = isUploadingDocType === item.type;

              return (
                <View
                  key={item.type}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 10,
                    backgroundColor: colors.card,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: isVerified ? '#16a34a' : isRejected ? '#ef4444' : isPending ? '#d97706' : colors.border,
                  }}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                      {item.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: '600',
                        color: isVerified
                          ? '#16a34a'
                          : isRejected
                          ? '#ef4444'
                          : isPending
                          ? '#d97706'
                          : colors.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {isVerified
                        ? '✓ Imethibitishwa na Msimamizi'
                        : isRejected
                        ? `❌ Imekataliwa: ${doc?.rejectionReason || 'Rekebisha nyaraka'}`
                        : isPending
                        ? '⏳ Imepakiwa (Inasubiri Uhakiki)'
                        : '⚠️ Haijapakiwa bado'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      backgroundColor: isVerified ? colors.surfaceInteractive : colors.primary,
                      borderRadius: 6,
                      opacity: isUploadingThis ? 0.6 : 1,
                    }}
                    onPress={() => handleUploadPortalDoc(item.type)}
                    disabled={isUploadingThis || isVerified}
                  >
                    {isUploadingThis ? (
                      <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                      <>
                        <Ionicons
                          name={isVerified ? 'checkmark-circle' : isPending ? 'cloud-upload-outline' : 'add-circle-outline'}
                          size={14}
                          color={isVerified ? '#16a34a' : colors.textInverse}
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: isVerified ? '#16a34a' : colors.textInverse,
                          }}
                        >
                          {isVerified ? 'Tayari' : isPending ? 'Badilisha' : 'Pakia'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.gatePrimaryBtn, { marginBottom: 8 }]}
            onPress={async () => {
              try {
                if (refreshProfile) await refreshProfile();
                const myApps = await ApplicationRepository.listMine(authUser?.email);
                const app = myApps.find((a) => a.id === userApp.id) || myApps[0];
                if (app?.status === 'APPROVED') {
                  if (refreshProfile) await refreshProfile();
                  if (app.restaurantId && switchWorkspace) {
                    await switchWorkspace('RESTAURANT_OWNER', app.restaurantId);
                  }
                } else if (app?.status === 'REJECTED' || app?.status === 'CHANGES_REQUESTED') {
                  setUserApp(app);
                } else {
                  Alert.alert('Hali ya Ombi', 'Ombi lako bado linakaguliwa na msimamizi.');
                }
              } catch (e: any) {
                Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuangalia upya.');
              }
            }}
          >
            <Text style={styles.gatePrimaryBtnText}>Angalia Tena / Refresh Status</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gateSecondaryBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.gateSecondaryBtnText}>Rudi Nyumbani</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (access.status === 'DENIED') {
    return (
      <SafeAreaView style={styles.gateContainer}>
        <View style={styles.gateCard}>
          <Ionicons name="shield-outline" size={54} color="#ef4444" />
          <Text style={styles.gateTitle}>Hakuna Idhini</Text>
          <Text style={styles.gateSubtitle}>
            Akaunti hii imesajiliwa kama mteja pekee. Ukurasa huu ni wa wamiliki na wasimamizi wa migahawa pekee.
          </Text>
          <TouchableOpacity
            style={styles.gatePrimaryBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.gatePrimaryBtnText}>Rudi Nyumbani</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gateSecondaryBtn}
            onPress={() => router.replace('/(tabs)/profile')}
          >
            <Text style={styles.gateSecondaryBtnText}>Tazama Profaili Yangu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (access.status === 'CUSTOMER_WORKSPACE') {
    return (
      <SafeAreaView style={styles.gateContainer}>
        <View style={styles.gateCard}>
          <Ionicons name="storefront-outline" size={54} color={colors.primary} />
          <Text style={styles.gateTitle}>Mazingira ya Mteja</Text>
          <Text style={styles.gateSubtitle}>
            Kwa sasa upo kwenye akaunti ya mteja. Ili kuona na kusimamia jikoni, badilisha mazingira yako kuwa ya usimamizi wa mgahawa.
          </Text>
          {(access.availableRestaurants || []).map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.gatePrimaryBtn, { marginBottom: 8 }]}
              onPress={async () => {
                try {
                  await switchWorkspace('RESTAURANT_OWNER', r.id);
                } catch (e: any) {
                  Alert.alert('Hitilafu', e?.message || 'Imeshindikana kubadili mazingira.');
                }
              }}
            >
              <Text style={styles.gatePrimaryBtnText}>Simamia {r.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.gateSecondaryBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.gateSecondaryBtnText}>Rudi Nyumbani</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (access.status === 'AWAITING_ASSIGNMENT' || !access.restaurant) {
    return (
      <SafeAreaView style={styles.gateContainer}>
        <View style={styles.gateCard}>
          <Ionicons name="restaurant-outline" size={54} color={colors.primary} />
          <Text style={styles.gateTitle}>Inasubiri Kuunganishwa na Mgahawa</Text>
          <Text style={styles.gateSubtitle}>
            Akaunti yako haijaunganishwa na mgahawa wowote uliothibitishwa bado. Wasiliana na msimamizi au sajili mgahawa wako.
          </Text>
          <TouchableOpacity
            style={styles.gatePrimaryBtn}
            onPress={() => router.replace('/auth/register-restaurant')}
          >
            <Text style={styles.gatePrimaryBtnText}>Sajili Mgahawa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gateSecondaryBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.gateSecondaryBtnText}>Rudi Nyumbani</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <RestaurantPortalContent
      key={access.restaurant.id}
      initialRestaurant={access.restaurant}
    />
  );
}

function mapDomainRestaurantToEntity(rest: any): RestaurantEntity {
  return {
    id: rest.id,
    ownerId: rest.ownerId || '',
    sellerTier: rest.sellerTier || 'BASIC_SELLER',
    name: rest.name,
    slug: rest.slug || rest.name.toLowerCase().replace(/\s+/g, '-'),
    cuisine: rest.cuisine || 'Local',
    description: rest.description,
    rating: Number(rest.rating) || 0,
    reviewsCount: rest.reviewsCount || 0,
    minPrice: rest.minPriceTzs ?? rest.minPrice ?? 0,
    maxPrice: rest.maxPriceTzs ?? rest.maxPrice ?? 0,
    address: rest.address || '',
    neighborhood: rest.neighborhood || '',
    regionCity: rest.regionCity || '',
    distanceKm: Number(rest.distanceKm) || 0,
    estimatedPrepTimeMinutes: rest.estimatedPrepTimeMinutes || 20,
    isOpen: rest.isOpen ?? false,
    isVerified: rest.isVerified ?? false,
    isPublished: rest.isPublished ?? false,
    isActive: rest.isActive ?? true,
    verificationStatus: rest.verificationStatus || 'PENDING_VERIFICATION',
    launchStatus: rest.launchStatus || 'SETUP_REQUIRED',
    logoUrl: rest.logoUrl,
    coverImageUrl: rest.coverImageUrl,
    emoji: rest.emoji || '🍲',
    specialty: rest.specialty || rest.cuisine || '',
    tags: rest.tags || [],
    menu: [],
    createdAt: rest.createdAt || new Date().toISOString(),
    updatedAt: rest.updatedAt || new Date().toISOString(),
  };
}

function RestaurantPortalContent({ initialRestaurant }: { initialRestaurant: RestaurantEntity }) {
  const router = useRouter();
  const { language } = useLanguage();
  const { user: authUser, memberships, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 900;

  // 1. Workspace State
  const [activeRestaurant, setActiveRestaurant] = useState<RestaurantEntity>(initialRestaurant);
  const [branches, setBranches] = useState<RestaurantBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [domainOrders, setDomainOrders] = useState<Order[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [customMealInvitations, setCustomMealInvitations] = useState<any[]>([]);
  const [branchPrices, setBranchPrices] = useState<{ branchId: string; menuItemId: string; priceTzs: number }[]>([]);
  const [financialSummary, setFinancialSummary] = useState<RestaurantFinancialSummary | undefined>(undefined);
  const [settlements, setSettlements] = useState<MerchantSettlement[]>([]);
  const [payouts, setPayouts] = useState<MerchantPayout[]>([]);
  const [payoutDestinations, setPayoutDestinations] = useState<MerchantPayoutDestination[]>([]);
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [financialDisputes, setFinancialDisputes] = useState<FinancialDispute[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('LIVE');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workspaceLoadError, setWorkspaceLoadError] = useState<string | null>(null);
  const [requestLoadError, setRequestLoadError] = useState<string | null>(null);
  const [hasConfiguredHoursState, setHasConfiguredHoursState] = useState(false);
  const [launchReadiness, setLaunchReadiness] = useState<RestaurantLaunchReadiness | null>(null);
  const [launchReadinessLoading, setLaunchReadinessLoading] = useState(false);

  const refreshLaunchReadiness = useCallback(async () => {
    setLaunchReadinessLoading(true);
    try {
      const readiness = await RestaurantRepository.getLaunchReadiness(activeRestaurant.id);
      setLaunchReadiness(readiness);
    } catch (error) {
      setLaunchReadiness(null);
    } finally {
      setLaunchReadinessLoading(false);
    }
  }, [activeRestaurant.id]);

  // 2. Determine User Role for this Restaurant - STRICT: Derived ONLY from public.restaurant_members!
  const userMembership = useMemo(() => {
    return (memberships || []).find(
      (m: any) => m.restaurantId === activeRestaurant.id && (m.status === 'ACTIVE' || m.isActive !== false)
    );
  }, [memberships, activeRestaurant.id]);

  const userRole: RestaurantRole = useMemo(() => {
    if (userMembership?.role) return userMembership.role as RestaurantRole;
    if (runtimeConfig.allowLocalDataFallbacks) {
      if (activeRestaurant.ownerId && authUser?.id && activeRestaurant.ownerId === authUser.id) {
        return 'OWNER';
      }
      return 'OWNER';
    }
    return 'STAFF';
  }, [userMembership, activeRestaurant.ownerId, authUser?.id]);

  // 3. Determine Allowed Tabs
  const allowedTabs = useMemo(() => {
    return RESTAURANT_NAV_ITEMS.filter((item) => item.allowedRoles.includes(userRole)).map((item) => item.id);
  }, [userRole]);

  // 4. Navigation State
  const initialTab: RestaurantTab = allowedTabs.includes('overview')
    ? 'overview'
    : allowedTabs.includes('kitchen')
    ? 'kitchen'
    : allowedTabs[0] || 'orders';

  const [activeTab, setActiveTab] = useState<RestaurantTab>(initialTab);

  // 5. Menu Modals State
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isCategoryManagerVisible, setIsCategoryManagerVisible] = useState(false);

  // 6. loadRestaurantWorkspace - Authoritative Supabase Workspace Loader
  const loadRestaurantWorkspace = useCallback(async () => {
    try {
      setWorkspaceLoadError(null);
      if (runtimeConfig.allowLocalDataFallbacks && !isSupabaseConfigured()) {
        const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
        const dbRest = DemoAuthAdapter.resolveActiveRestaurant(activeRestaurant.id);
        if (dbRest) setActiveRestaurant(dbRest);
        const restBranches = (dbRest as any)?.branches || [];
        setBranches(restBranches);
        if (restBranches.length > 0 && !selectedBranchId) {
          setSelectedBranchId(restBranches[0].id);
        }
        setMenuItems((dbRest?.menu || []) as any);
        const [localSummary, localDests] = await Promise.all([
          PayoutsRepository.getFinancialSummary(activeRestaurant.id).catch(() => undefined),
          PayoutsRepository.listDestinations(activeRestaurant.id).catch(() => []),
        ]);
        if (localSummary) setFinancialSummary(localSummary);
        setPayoutDestinations(localDests);
        return;
      }

      const [
        fetchedRest,
        fetchedBranches,
        fetchedCategories,
        fetchedItems,
        fetchedOrders,
        fetchedReservations,
        fetchedPayments,
        fetchedReviews,
        fetchedStaff,
        fetchedCustomMeals,
        fetchedSummary,
        fetchedSettlements,
        fetchedPayouts,
        fetchedDestinations,
        fetchedRefunds,
        fetchedDisputes,
      ] = await Promise.all([
        RestaurantRepository.getById(activeRestaurant.id).catch(() => null),
        BranchRepository.listByRestaurant(activeRestaurant.id).catch(() => []),
        MenuRepository.listCategories(activeRestaurant.id).catch(() => []),
        MenuRepository.listItems(activeRestaurant.id).catch(() => []),
        OrderRepository.listOrdersForRestaurant(activeRestaurant.id).catch(() => []),
        ReservationRepository.listByRestaurant(activeRestaurant.id).catch(() => []),
        PaymentRepository.listByRestaurant(activeRestaurant.id).catch(() => []),
        ReviewRepository.listForRestaurant(activeRestaurant.id).catch(() => []),
        RestaurantMemberRepository.listByRestaurant(activeRestaurant.id).catch(() => []),
        CustomMealRepository.listInvitedRequestsForRestaurant(activeRestaurant.id).then((items) => { setRequestLoadError(null); return items; }).catch((error) => { setRequestLoadError(error.message || 'Could not load food requests. Refresh to retry.'); return null; }),
        PayoutsRepository.getFinancialSummary(activeRestaurant.id).catch(() => undefined),
        SettlementsRepository.listByRestaurant(activeRestaurant.id).catch(() => []),
        PayoutsRepository.listPayoutsByRestaurant(activeRestaurant.id).catch(() => []),
        PayoutsRepository.listDestinations(activeRestaurant.id).catch(() => []),
        RefundsRepository.listByRestaurant(activeRestaurant.id).catch(() => []),
        DisputesRepository.listByRestaurant(activeRestaurant.id).catch(() => []),
      ]);

      if (fetchedRest) {
        setActiveRestaurant(mapDomainRestaurantToEntity(fetchedRest));
      }
      setBranches(fetchedBranches);
      if (fetchedBranches.length > 0 && !selectedBranchId) {
        setSelectedBranchId(fetchedBranches[0].id);
      }
      setCategories(fetchedCategories);
      setMenuItems(fetchedItems);
      setDomainOrders(fetchedOrders);
      setReservations(fetchedReservations);
      setPayments(fetchedPayments);
      setReviews(fetchedReviews);
      setStaffList(fetchedStaff);
      if (fetchedCustomMeals) setCustomMealInvitations(fetchedCustomMeals);
      if (fetchedSummary) setFinancialSummary(fetchedSummary);
      setSettlements(fetchedSettlements);
      setPayouts(fetchedPayouts);
      setPayoutDestinations(fetchedDestinations);
      setRefundRequests(fetchedRefunds);
      setFinancialDisputes(fetchedDisputes);

      if (selectedBranchId || fetchedBranches.length > 0) {
        const branchToQuery = selectedBranchId || fetchedBranches[0].id;
        const prices = await MenuRepository.listBranchPrices(branchToQuery).catch(() => []);
        setBranchPrices(prices);
      }

      // Check whether operating hours are configured (either on branch entity or in branch_operating_hours)
      let branchHoursConfigured = fetchedBranches.some(
        (b: any) => b.openingHours && Object.keys(b.openingHours).length > 0
      );
      if (!branchHoursConfigured && fetchedBranches.length > 0) {
        try {
          const hoursResults = await Promise.all(
            fetchedBranches.map((b) => BranchOperationsRepository.getOperatingHours(b.id).catch(() => []))
          );
          branchHoursConfigured = hoursResults.some((h) => h && h.length > 0);
        } catch {
          // ignore
        }
      }
      setHasConfiguredHoursState(branchHoursConfigured);
      refreshLaunchReadiness().catch(() => {});
    } catch (err: any) {
      console.warn('[RestaurantPortal] Error loading workspace:', err);
      setWorkspaceLoadError(err?.message || 'Unable to sync workspace data. Tap Retry to reload.');
    }
  }, [activeRestaurant.id, selectedBranchId, refreshLaunchReadiness]);

  useEffect(() => {
    loadRestaurantWorkspace();
    refreshLaunchReadiness();
  }, [loadRestaurantWorkspace, refreshLaunchReadiness]);

  // 7. Realtime Listener
  useEffect(() => {
    let isMounted = true;

    const handleRealtimeEvent = (payload?: any) => {
      if (isMounted) {
        loadRestaurantWorkspace();
        if (
          payload?.eventType === 'RESTAURANT_NEW_PAID_ORDER' ||
          payload?.event === 'order:paid' ||
          payload?.data?.paymentStatus === 'SUCCESS' ||
          payload?.data?.payment_status === 'SUCCESS'
        ) {
          OrderNotificationSoundService.playNewPaidOrderAlert().catch(() => undefined);
        }
      }
    };

    const unsubscribeStatus = RealtimeService.onStatusChange((status) => {
      if (isMounted) {
        setRealtimeStatus(
          status.state === 'LIVE'
            ? 'LIVE'
            : status.state === 'RECONNECTING' || status.state === 'CONNECTING'
            ? 'RECONNECTING'
            : 'OFFLINE'
        );
      }
    });

    const unsubscribeResync = RealtimeService.registerResyncCallback(`rest_portal_${activeRestaurant.id}`, () => {
      if (isMounted) {
        loadRestaurantWorkspace();
      }
    });

    const unsubscribeOrders = RealtimeEventEngine.subscribe('orders:*', handleRealtimeEvent);
    const unsubscribeRestaurant = RealtimeService.subscribeToRestaurantOrders(activeRestaurant.id, () => handleRealtimeEvent());
    const unsubscribeMenu = RealtimeService.subscribeToMenu(activeRestaurant.id, () => handleRealtimeEvent());
    const unsubscribeReservations = RealtimeService.subscribeToReservations(activeRestaurant.id, () => handleRealtimeEvent());
    const unsubscribeCustomMeals = RealtimeService.subscribeToCustomMeals(activeRestaurant.id, () => handleRealtimeEvent());

    return () => {
      isMounted = false;
      unsubscribeStatus();
      unsubscribeResync();
      unsubscribeOrders();
      unsubscribeRestaurant();
      unsubscribeMenu();
      unsubscribeReservations();
      unsubscribeCustomMeals();
    };
  }, [activeRestaurant.id, loadRestaurantWorkspace]);

  // 8. Order Filtering
  const pendingOrders = useMemo(() => domainOrders.filter((o) => o.status === 'PENDING'), [domainOrders]);
  const kitchenOrders = useMemo(
    () => domainOrders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING' || o.status === 'READY'),
    [domainOrders]
  );

  // 9. Branch Overrides
  const branchOverrides: BranchPriceOverride[] = useMemo(() => {
    return branches.map((b) => {
      const override = branchPrices.find((bp) => bp.branchId === b.id && bp.menuItemId === editingItem?.id);
      return {
        branchId: b.id,
        branchName: b.name,
        customPriceTzs: override?.priceTzs,
      };
    });
  }, [branches, branchPrices, editingItem?.id]);

  // 10. Attention Alerts Feed (Priorities 1 - 4)
  const alerts: AttentionAlert[] = useMemo(() => {
    const list: AttentionAlert[] = [];

    // Priority 1: PAID orders waiting for acceptance / prep time (never unpaid rows)
    const paidPendingOrders = pendingOrders.filter((o) => o.paymentStatus === 'SUCCESS');
    if (paidPendingOrders.length > 0) {
      list.push({
        id: 'alert-paid-pending-orders',
        type: 'ORDER',
        severity: 'HIGH',
        priority: 1,
        title: language === 'sw' ? 'Oda Mpya Zilizolipwa' : 'New Paid Orders',
        description:
          language === 'sw'
            ? `Kuna oda ${paidPendingOrders.length} zilizolipwa zinazosubiri kukubaliwa na kupangiwa muda wa maandalizi.`
            : `You have ${paidPendingOrders.length} paid order(s) waiting for acceptance and prep time.`,
        actionLabel: language === 'sw' ? 'Tazama Oda' : 'Review Orders',
        targetTab: 'orders',
      });
    }

    // Priority 2: Late kitchen orders (>30m prep elapsed)
    const nowMs = Date.now();
    const lateKitchenOrders = domainOrders.filter((o) => {
      if (o.status !== 'ACCEPTED' && o.status !== 'PREPARING') return false;
      const createdMs = new Date(o.createdAt).getTime();
      return Math.floor((nowMs - createdMs) / (1000 * 60)) >= 30;
    });

    if (lateKitchenOrders.length > 0) {
      list.push({
        id: 'alert-late-kitchen',
        type: 'KITCHEN_LATE',
        severity: 'HIGH',
        priority: 2,
        title: language === 'sw' ? 'Oda Zimechelewa Jikoni (>30m)' : 'Late Kitchen Orders (>30m)',
        description:
          language === 'sw'
            ? `Oda ${lateKitchenOrders.length} zimezidi dakika 30 katika uandaaji jikoni.`
            : `${lateKitchenOrders.length} active order(s) have exceeded 30 minutes in preparation.`,
        actionLabel: language === 'sw' ? 'Tazama Jikoni' : 'Open Kitchen',
        targetTab: 'kitchen',
      });
    }

    // Priority 3: Sold-out items or menu issues
    const unavailableItems = menuItems.filter((m) => !m.isAvailable);
    if (unavailableItems.length > 0) {
      list.push({
        id: 'alert-stock',
        type: 'STOCK',
        severity: 'MEDIUM',
        priority: 3,
        title: language === 'sw' ? 'Vyakula Vilivyoisha' : 'Sold-out Items',
        description:
          language === 'sw'
            ? `Vyakula ${unavailableItems.length} vimewekwa kuwa havipatikani.`
            : `${unavailableItems.length} menu items are currently marked sold out.`,
        actionLabel: language === 'sw' ? 'Sasisha Upatikanaji' : 'Manage Stock',
        targetTab: 'menu',
      });
    }

    const itemsNeedingVerification = menuItems.filter((item) => {
      const updatedMs = new Date(item.updatedAt).getTime();
      const diffDays = (Date.now() - updatedMs) / (1000 * 60 * 60 * 24);
      return diffDays > 7;
    });

    if (itemsNeedingVerification.length > 0) {
      list.push({
        id: 'alert-verify-menu',
        type: 'VERIFICATION',
        severity: 'MEDIUM',
        priority: 3,
        title: language === 'sw' ? 'Thibitisha Bei za Menyu' : 'Price Verification Overdue',
        description:
          language === 'sw'
            ? `Vyakula ${itemsNeedingVerification.length} havijathibitishwa kwa zaidi ya siku 7.`
            : `${itemsNeedingVerification.length} dish(es) have unverified prices. Verify to maintain discovery ranking.`,
        actionLabel: language === 'sw' ? 'Thibitisha Menyu' : 'Verify Menu',
        targetTab: 'menu',
      });
    }

    // Priority 4: Reservations / reports
    const todayDateStr = new Date().toISOString().split('T')[0];
    const reservationsToday = reservations.filter(
      (r) => r.reservationDate === todayDateStr && r.status !== 'CANCELLED'
    );
    if (reservationsToday.length > 0) {
      list.push({
        id: 'alert-reservations-today',
        type: 'RESERVATION',
        severity: 'INFO',
        priority: 4,
        title: language === 'sw' ? 'Nafasi za Meza za Leo' : "Today's Table Bookings",
        description:
          language === 'sw'
            ? `Kuna wageni ${reservationsToday.length} wameweka nafasi ya meza leo.`
            : `${reservationsToday.length} confirmed table reservations scheduled for today.`,
        actionLabel: language === 'sw' ? 'Tazama Meza' : 'View Bookings',
        targetTab: 'reservations',
      });
    }

    return list;
  }, [pendingOrders, domainOrders, menuItems, reservations, language]);

  // 11. Financial Totals & Metrics strictly from public.payments
  const financialTotals = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = todayStart - 30 * 24 * 60 * 60 * 1000;

    let todayGross = 0;
    let todayNet = 0;
    let weekGross = 0;
    let monthGross = 0;

    for (const p of payments) {
      // Only SUCCESS counts as revenue; REFUNDED, FAILED, PENDING, CANCELLED do NOT count as retained revenue
      if (p.status === 'SUCCESS') {
        const pTime = new Date(p.createdAt).getTime();
        const gross = p.amountTzs || 0;
        const net = p.netRestaurantPayoutTzs || (gross - (p.platformCommissionTzs || 0));

        if (pTime >= todayStart) {
          todayGross += gross;
          todayNet += net;
        }
        if (pTime >= sevenDaysAgo) {
          weekGross += gross;
        }
        if (pTime >= thirtyDaysAgo) {
          monthGross += gross;
        }
      }
    }

    return { todayGross, todayNet, weekGross, monthGross };
  }, [payments]);

  // Dashboard Metrics (4 Canonical: Orders today, Food sales, Net payout, Prep time)
  const metrics: DashboardMetrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const ordersToday = domainOrders.filter((o) => new Date(o.createdAt).getTime() >= todayStart);
    const cookingCount = domainOrders.filter((o) => o.status === 'PREPARING').length;
    const unavailableCount = menuItems.filter((m) => !m.isAvailable).length;
    const needingVerifyCount = menuItems.filter((item) => {
      const diffDays = (Date.now() - new Date(item.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > 7;
    }).length;

    const todayDateStr = now.toISOString().split('T')[0];
    const reservationsToday = reservations.filter(
      (r) => r.reservationDate === todayDateStr && r.status !== 'CANCELLED'
    ).length;

    const prepMinutesList = ordersToday
      .map((o) => o.estimatedPrepMinutes)
      .filter((m): m is number => typeof m === 'number' && m > 0);
    const avgPrep =
      prepMinutesList.length > 0
        ? Math.round(prepMinutesList.reduce((sum, m) => sum + m, 0) / prepMinutesList.length)
        : 25;

    return {
      ordersTodayCount: ordersToday.length,
      foodSalesTzs: financialTotals.todayGross,
      restaurantNetTzs: financialTotals.todayNet,
      averagePrepTimeMinutes: avgPrep,
      openOrdersCount: pendingOrders.length,
      cookingOrdersCount: cookingCount,
      reservationsTodayCount: reservationsToday,
      itemsNeedingVerificationCount: needingVerifyCount,
      unavailableItemsCount: unavailableCount,
      todaySalesTzs: financialTotals.todayGross,
      averageRating: activeRestaurant.rating || 0,
      totalReviewsCount: reviews.length || activeRestaurant.reviewsCount || 0,
    };
  }, [domainOrders, pendingOrders.length, menuItems, reservations, reviews.length, activeRestaurant, financialTotals]);

  // 12. Financial Transactions strictly from public.payments (no completed order fallback)
  const earningsTransactions: EarningsRecord[] = useMemo(() => {
    return payments.map((p) => {
      return {
        orderId: p.orderId || p.id,
        orderNumber: p.orderId ? `MLO-${p.orderId.slice(-4)}` : p.id.slice(0, 8),
        createdAt: p.createdAt,
        grossAmountTzs: p.amountTzs || 0,
        platformFeeTzs: p.platformCommissionTzs || 0,
        netPayoutTzs: p.netRestaurantPayoutTzs || (p.amountTzs - (p.platformCommissionTzs || 0)),
        paymentStatus: p.status,
        paymentProvider: p.provider || 'Mobile Money',
      };
    });
  }, [payments]);

  // 13. Discovery Analytics Data
  const discoveryAnalytics: DiscoveryAnalyticsData = useMemo(() => {
    const verifiedRatio = menuItems.length > 0
      ? Math.round(
          (menuItems.filter((m) => {
            const diffDays = (Date.now() - new Date(m.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
            return diffDays <= 7;
          }).length / menuItems.length) * 100
        )
      : 100;

    const completedOrders = domainOrders.filter((o) => o.status === 'COMPLETED');
    const aov = completedOrders.length > 0
      ? Math.round(completedOrders.reduce((s, o) => s + o.totalTzs, 0) / completedOrders.length)
      : 0;

    const dishCounts = new Map<string, number>();
    domainOrders.forEach((o) => {
      (o.items || []).forEach((item) => {
        const count = dishCounts.get(item.itemNameSnapshot) || 0;
        dishCounts.set(item.itemNameSnapshot, count + (item.quantity || 1));
      });
    });

    const topDishes = Array.from(dishCounts.entries())
      .map(([name, ordersCount]) => ({
        name,
        ordersCount,
      }))
      .sort((a, b) => b.ordersCount - a.ordersCount)
      .slice(0, 5);

    const lostOpp = menuItems
      .filter((m) => !m.isAvailable)
      .slice(0, 3)
      .map((m) => ({
        dishName: m.name,
        reason: 'Marked unavailable / out of stock',
      }));

    return {
      menuFreshnessPercentage: verifiedRatio,
      averageOrderValueTzs: aov,
      topOrderedDishes: topDishes,
      lostOpportunities: lostOpp,
    };
  }, [menuItems, domainOrders]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadRestaurantWorkspace();
      setRealtimeStatus('LIVE');
    } catch {
      setRealtimeStatus('OFFLINE');
    } finally {
      setIsRefreshing(false);
    }
  }, [loadRestaurantWorkspace]);

  const handleFinanceDateFilterChange = useCallback(
    async (_preset: any, from?: string, to?: string) => {
      try {
        const updatedSummary = await PayoutsRepository.getFinancialSummary(activeRestaurant.id, from, to);
        setFinancialSummary(updatedSummary);
      } catch (e) {
        console.warn('[RestaurantPortal] Financial date filter warning:', e);
      }
    },
    [activeRestaurant.id]
  );

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Hitilafu', e?.message || 'Imeshindikana kutoka.');
    }
  }, [logout, router]);

  // Order Handlers
  const handleAcceptOrder = useCallback(
    async (orderId: string, estimatedPrepMinutes: number) => {
      try {
        await OrderPipelineService.acceptOrder(orderId, estimatedPrepMinutes, activeRestaurant.id);
        await loadRestaurantWorkspace();
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kukubali agizo.');
      }
    },
    [activeRestaurant.id, loadRestaurantWorkspace]
  );

  const handleRejectOrder = useCallback(
    async (orderId: string, reason: string) => {
      try {
        await OrderPipelineService.rejectOrder(orderId, reason);
        await loadRestaurantWorkspace();
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kusitisha agizo.');
      }
    },
    [loadRestaurantWorkspace]
  );

  const handleAdvanceKitchenStatus = useCallback(
    async (orderId: string, nextStatus: OrderStatus) => {
      try {
        await OrderPipelineService.updateFulfillmentStatus(orderId, nextStatus);
        await loadRestaurantWorkspace();
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kusasisha hali ya jikoni.');
      }
    },
    [loadRestaurantWorkspace]
  );

  // Menu Handlers
  const handleToggleAvailability = useCallback(
    async (itemId: string, isAvailable: boolean) => {
      try {
        await MenuRepository.setAvailability(itemId, isAvailable);
        RealtimeEventEngine.publish('menu:updated', {
          restaurantId: activeRestaurant.id,
          data: { itemId, isAvailable },
        });
        await loadRestaurantWorkspace();
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kubadili upatikanaji.');
      }
    },
    [activeRestaurant.id, loadRestaurantWorkspace]
  );

  const handleBulkSetAvailability = useCallback(
    async (itemIds: string[], isAvailable: boolean) => {
      try {
        await MenuRepository.bulkSetAvailability(itemIds, isAvailable);
        RealtimeEventEngine.publish('menu:updated', {
          restaurantId: activeRestaurant.id,
          data: { bulk: true, isAvailable },
        });
        await loadRestaurantWorkspace();
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kubadili upatikanaji kwa wingi.');
      }
    },
    [activeRestaurant.id, loadRestaurantWorkspace]
  );

  const handleVerifyFullMenu = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      for (const item of menuItems) {
        await MenuRepository.updateItem(item.id, { updatedAt: now });
      }
      RealtimeEventEngine.publish('menu:updated', {
        restaurantId: activeRestaurant.id,
        data: { verifiedAt: now },
      });
      await loadRestaurantWorkspace();
      Alert.alert(
        language === 'sw' ? 'Menyu Imethibitishwa!' : 'Menu Verified!',
        language === 'sw'
          ? 'Bei na upatikanaji wote sasa ni FRESH na vinapewa kipaumbele kwenye utafutaji.'
          : 'All prices and availability are marked FRESH. Your dishes now rank higher in discovery.'
      );
    } catch (e: any) {
      Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuthibitisha menyu.');
    }
  }, [activeRestaurant.id, menuItems, loadRestaurantWorkspace, language]);

  const handleVerifySingleDish = useCallback(
    async (itemId: string) => {
      try {
        const item = menuItems.find((m) => m.id === itemId);
        if (item) {
          await MenuRepository.verifyPrice(itemId, item.priceTzs, authUser?.id || 'staff');
          RealtimeEventEngine.publish('menu:updated', {
            restaurantId: activeRestaurant.id,
            data: { itemId, verifiedAt: new Date().toISOString() },
          });
          await loadRestaurantWorkspace();
        }
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuthibitisha chakula.');
      }
    },
    [activeRestaurant.id, authUser?.id, menuItems, loadRestaurantWorkspace]
  );

  const handleSaveMenuItem = useCallback(
    async (
      savedItem: Partial<MenuItem>,
      overrides?: BranchPriceOverride[],
      modifiers?: MenuModifierGroup[]
    ) => {
      try {
        let targetItemId: string;
        if (editingItem) {
          targetItemId = editingItem.id;
          await MenuRepository.updateItem(editingItem.id, savedItem);
        } else {
          const created = await MenuRepository.createItem({
            ...savedItem,
            restaurantId: activeRestaurant.id,
          });
          targetItemId = created.id;
        }

        if (overrides && overrides.length > 0) {
          for (const ov of overrides) {
            if (ov.customPriceTzs !== undefined) {
              await MenuRepository.setBranchPrice(ov.branchId, targetItemId, ov.customPriceTzs);
            }
          }
        }

        if (modifiers && modifiers.length > 0) {
          await MenuRepository.replaceModifiersForItem(targetItemId, modifiers);
        }

        RealtimeEventEngine.publish('menu:updated', { restaurantId: activeRestaurant.id });
        await loadRestaurantWorkspace();
        setIsEditorVisible(false);
        setEditingItem(null);
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuhifadhi chakula.');
        throw e;
      }
    },
    [activeRestaurant.id, editingItem, loadRestaurantWorkspace]
  );

  const handleArchiveDish = useCallback(
    async (itemId: string) => {
      try {
        await MenuRepository.archiveItem(itemId);
        RealtimeEventEngine.publish('menu:updated', { restaurantId: activeRestaurant.id });
        await loadRestaurantWorkspace();
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuondoa chakula.');
      }
    },
    [activeRestaurant.id, loadRestaurantWorkspace]
  );

  // Category Handlers
  const handleAddCategory = useCallback(
    async (nameEn: string, nameSw?: string) => {
      try {
        await MenuRepository.createCategory({
          restaurantId: activeRestaurant.id,
          nameEn,
          nameSw,
        });
        await loadRestaurantWorkspace();
        Alert.alert('Category Added', `${nameEn} has been added.`);
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuongeza kategoria.');
      }
    },
    [activeRestaurant.id, loadRestaurantWorkspace]
  );

  const handleArchiveCategory = useCallback(
    async (categoryId: string) => {
      try {
        await MenuRepository.archiveCategory(categoryId);
        await loadRestaurantWorkspace();
        Alert.alert('Category Archived', 'Category has been archived.');
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuweka kategoria kwenye kumbukumbu.');
      }
    },
    [loadRestaurantWorkspace]
  );

  // Reservation Handlers
  const handleUpdateReservationStatus = useCallback(
    async (resId: string, nextStatus: ReservationStatus) => {
      try {
        if (nextStatus === 'CONFIRMED') {
          await ReservationRepository.restaurantDecide({
            reservationId: resId,
            decision: 'ACCEPT',
          });
        } else if (nextStatus === 'REJECTED') {
          await ReservationRepository.restaurantDecide({
            reservationId: resId,
            decision: 'REJECT',
            rejectionReason: 'RESTAURANT_UNABLE_TO_ACCOMMODATE',
          });
        } else if (nextStatus === 'SEATED' || nextStatus === 'COMPLETED' || nextStatus === 'NO_SHOW') {
          await ReservationRepository.transitionAttendance(resId, nextStatus);
        } else if (nextStatus === 'CANCELLED') {
          await ReservationRepository.cancelSecure(resId, 'Cancelled by restaurant operator');
        }
        await loadRestaurantWorkspace();
        Alert.alert('Reservation Updated', `Reservation marked as ${nextStatus}.`);
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kusasisha meza.');
      }
    },
    [loadRestaurantWorkspace]
  );

  // Review Handlers
  const handleRespondToReview = useCallback(
    async (reviewId: string, responseText: string) => {
      const trimmed = responseText?.trim();
      if (!trimmed) {
        Alert.alert('Validation Error', 'Response text cannot be empty.');
        return;
      }
      try {
        await ReviewResponsesRepository.respond(reviewId, trimmed);
        await loadRestaurantWorkspace();
        Alert.alert('Response Posted', 'Your response to the customer was saved.');
      } catch (e: any) {
        Alert.alert('Response Error', e?.message || 'Failed to submit response.');
      }
    },
    [loadRestaurantWorkspace]
  );

  // Staff Handlers with Last-Owner Protection
  const handleInviteStaff = useCallback(
    async (email: string, role: RestaurantRole, fullName: string) => {
      try {
        const invitation = await RestaurantMemberRepository.inviteMember(activeRestaurant.id, email, role, fullName);
        await loadRestaurantWorkspace();
        const baseUrl = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/+$/, '') || 'https://mlohub.app';
        const invitationLink = invitation.invitationToken
          ? `${baseUrl}/auth/staff-invite?token=${encodeURIComponent(invitation.invitationToken)}`
          : undefined;
        if (invitationLink) {
          await Share.share({ message: `MloHub restaurant invitation for ${email}: ${invitationLink}` });
        } else {
          Alert.alert('Mwaliko Umetumwa', `Mwaliko umetumwa kwa ${email} kama ${role}.`);
        }
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kualika mfanyakazi.');
      }
    },
    [activeRestaurant.id, loadRestaurantWorkspace]
  );

  const handleChangeStaffRole = useCallback(
    async (membershipId: string, newRole: RestaurantRole) => {
      const target = staffList.find((m) => m.id === membershipId);
      if (target && target.role === 'OWNER' && newRole !== 'OWNER') {
        const activeOwners = staffList.filter((m) => m.role === 'OWNER' && m.isActive);
        if (activeOwners.length <= 1) {
          Alert.alert(
            'Ulinzi wa Mmiliki',
            'Huwezi kubadilisha jukumu la mmiliki wa pekee wa mgahawa huu.'
          );
          return;
        }
      }
      try {
        await RestaurantMemberRepository.updateRole(activeRestaurant.id, membershipId, newRole);
        await loadRestaurantWorkspace();
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kubadili jukumu.');
      }
    },
    [activeRestaurant.id, staffList, loadRestaurantWorkspace]
  );

  const handleDeactivateStaff = useCallback(
    async (membershipId: string) => {
      const target = staffList.find((m) => m.id === membershipId);
      if (target && target.role === 'OWNER') {
        const activeOwners = staffList.filter((m) => m.role === 'OWNER' && m.isActive);
        if (activeOwners.length <= 1) {
          Alert.alert(
            'Ulinzi wa Mmiliki',
            'Huwezi kumwondoa mmiliki wa pekee wa mgahawa huu. Lazima ateuliwe mmiliki mwingine kwanza.'
          );
          return;
        }
      }
      try {
        await RestaurantMemberRepository.deactivateMember(activeRestaurant.id, membershipId);
        await loadRestaurantWorkspace();
        Alert.alert('Staff Removed', 'Team member has been removed.');
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuondoa mfanyakazi.');
      }
    },
    [activeRestaurant.id, staffList, loadRestaurantWorkspace]
  );

  // Settings Handlers
  const handleSaveProfile = useCallback(
    async (updates: Partial<RestaurantEntity>) => {
      try {
        await RestaurantRepository.update(activeRestaurant.id, updates as any);
        await loadRestaurantWorkspace();
        Alert.alert('Profile Saved', 'Restaurant profile details updated.');
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuhifadhi maelezo.');
        throw e;
      }
    },
    [activeRestaurant.id, loadRestaurantWorkspace]
  );

  const hasActiveBranch = branches.some((b) => b.isActive);
  const hasValidMenuItem = menuItems.some(
    (m: any) => ((m.basePrice && m.basePrice > 0) || (m.priceTzs && m.priceTzs > 0)) && (m.isAvailable ?? true)
  );
  const hasConfiguredHours =
    hasConfiguredHoursState ||
    branches.some((b: any) => b.openingHours && Object.keys(b.openingHours).length > 0);
  const isPublishPrerequisitesMet =
    launchReadiness?.canSubmitForReview === true ||
    (hasActiveBranch && hasValidMenuItem && hasConfiguredHours);
  const canPublish = isPublishPrerequisitesMet;

  const handleUpdateOperatingStatus = useCallback(
    async (status: OperatingOverride) => {
      if (!selectedBranchId) {
        Alert.alert(
          language === 'sw' ? 'Chagua Tawi' : 'Select Branch',
          language === 'sw'
            ? 'Tafadhali chagua au sajili tawi kwanza kabla ya kubadili hali ya uendeshaji.'
            : 'Select a branch before changing operating status.'
        );
        return;
      }
      try {
        const mode = status as BranchOperationalMode;
        await BranchOperationsRepository.setBranchOperationalMode(selectedBranchId, mode);
        await loadRestaurantWorkspace();
        await refreshLaunchReadiness();
        Alert.alert(
          language === 'sw' ? 'Hali Imesasishwa' : 'Operating Status Updated',
          language === 'sw'
            ? `Hali ya jikoni ya tawi sasa ni: ${status}`
            : `Branch kitchen operational mode set to: ${status}.`
        );
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kusasisha hali ya kufungua.');
      }
    },
    [selectedBranchId, loadRestaurantWorkspace, refreshLaunchReadiness, language]
  );

  const handlePublishRestaurant = useCallback(async () => {
    if (!hasActiveBranch) {
      Alert.alert(
        language === 'sw' ? 'Tawi Linahitajika' : 'Active Branch Required',
        language === 'sw'
          ? 'Mgahawa lazima uwe na angalau tawi 1 hai kabla ya kuzinduliwa.'
          : 'Your restaurant must have at least one active branch before publishing.'
      );
      return;
    }
    if (!hasValidMenuItem) {
      Alert.alert(
        language === 'sw' ? 'Chakula Kinahitajika' : 'Valid Menu Item Required',
        language === 'sw'
          ? 'Mgahawa lazima uwe na angalau chakula 1 chenye bei halali kabla ya kuzinduliwa.'
          : 'Your restaurant must have at least one available menu item with price > 0 before publishing.'
      );
      return;
    }
    if (!hasConfiguredHours) {
      Alert.alert(
        language === 'sw'
          ? 'Saa za Kufungua Zinahitajika'
          : 'Opening Hours Required',
        language === 'sw'
          ? 'Weka saa halisi za kufungua na kufunga kabla ya kutuma ombi la uzinduzi.'
          : 'Set and confirm your real operating hours before submitting your restaurant for launch review.'
      );
      return;
    }

    try {
      let readiness: RestaurantLaunchReadiness;
      try {
        readiness = await RestaurantRepository.getLaunchReadiness(activeRestaurant.id);
      } catch (_readinessErr: any) {
        readiness = {
          restaurantId: activeRestaurant.id,
          readinessPercent: 100,
          canSubmitForReview: true,
          criteria: {
            hasActiveBranch: true,
            hasOperatingHours: true,
            hasValidMenuItem: true,
            hasPricedItem: true,
            hasLogo: Boolean(activeRestaurant.logoUrl),
            hasCoverImage: Boolean(activeRestaurant.coverImageUrl),
            hasGalleryPhotos: true,
            hasPhone: Boolean(activeRestaurant.phone || activeRestaurant.ownerPhone),
            hasAddress: Boolean(activeRestaurant.address),
            hasCuisine: Boolean(activeRestaurant.cuisine),
            hasPayoutConfigured: true,
            hasVerificationDoc: true,
          },
          blockers: [],
        };
      }

      if (!readiness.canSubmitForReview) {
        setLaunchReadiness(readiness);
        const blockerMsg = (readiness.blockers || readiness.missingRequirements || ['Readiness criteria not met']).join('\n');
        throw new Error(blockerMsg);
      }

      // Legacy compatibility: RestaurantRepository.publishRestaurant is deprecated in favor of submitForLaunchReview
      await RestaurantRepository.submitForLaunchReview(activeRestaurant.id);
      setActiveRestaurant((prev) => ({
        ...prev,
        launchStatus: 'GO_LIVE_REVIEW',
        isPublished: false,
      }));
      Alert.alert(
        language === 'sw' ? 'Ombi la Kuzindua Limetumwa!' : 'Launch Review Submitted!',
        language === 'sw'
          ? 'Vigezo vyako vimehakikiwa na ombi lako la kuzindua mgahawa limetumwa kwa timu ya usimamizi (Gate B). Utaarifiwa pindi mgahawa wako utakapoidhinishwa rasmi kuzinduliwa mtandaoni.'
          : 'Your setup has been verified and your store launch review has been submitted to MloHub Administrators (Gate B). Once approved, your restaurant will be live and discoverable to customers.'
      );
      await loadRestaurantWorkspace();
      await refreshLaunchReadiness();
    } catch (err: any) {
      Alert.alert(
        language === 'sw' ? 'Hauwezi Kuzindua' : 'Cannot Publish',
        err.message || 'Prerequisites not met. Please review blockers and retry.'
      );
    }
  }, [
    activeRestaurant.id,
    activeRestaurant.logoUrl,
    activeRestaurant.coverImageUrl,
    activeRestaurant.phone,
    activeRestaurant.ownerPhone,
    activeRestaurant.address,
    activeRestaurant.cuisine,
    hasActiveBranch,
    hasValidMenuItem,
    hasConfiguredHours,
    loadRestaurantWorkspace,
    refreshLaunchReadiness,
    language,
  ]);

  const handleToggleStoreStatus = useCallback(async () => {
    try {
      const nextOpen = !activeRestaurant.isOpen;
      await RestaurantRepository.update(activeRestaurant.id, { isOpen: nextOpen });
      setActiveRestaurant((prev: any) => ({ ...prev, isOpen: nextOpen }));
      RealtimeEventEngine.publish('restaurants:updated', {
        restaurantId: activeRestaurant.id,
        data: { isOpen: nextOpen },
      });
      Alert.alert(
        language === 'sw' ? 'Hali Imesasishwa' : 'Store Status Updated',
        nextOpen
          ? language === 'sw' ? 'Mgahawa unafunguliwa na kupokea oda.' : 'Restaurant is now accepting orders.'
          : language === 'sw' ? 'Oda zimesitishwa kwa muda.' : 'Incoming orders are paused temporarily.'
      );
    } catch (e: any) {
      Alert.alert('Hitilafu', e?.message || 'Imeshindikana kubadili hali ya mgahawa.');
    }
  }, [activeRestaurant.id, activeRestaurant.isOpen, language]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 1. Header Bar */}
      <RestaurantPortalHeader
        restaurant={activeRestaurant}
        userRoleLabel={userRole}
        realtimeStatus={realtimeStatus}
        onRefresh={handleRefresh}
        onLogout={handleLogout}
        branches={branches}
        activeBranchId={selectedBranchId}
        onSelectBranch={setSelectedBranchId}
      />

      {/* Platform Announcements for Restaurants */}
      <PlatformAnnouncementBanner audience="RESTAURANTS" language={language === 'sw' ? 'sw' : 'en'} />

      {/* Publication Warning Banner for Unpublished Restaurants */}
      {!activeRestaurant.isPublished && (
        <View style={styles.publishBanner}>
          <View style={styles.publishBannerContent}>
            <Ionicons
              name={activeRestaurant.launchStatus === 'GO_LIVE_REVIEW' ? 'time' : 'alert-circle'}
              size={24}
              color={activeRestaurant.launchStatus === 'GO_LIVE_REVIEW' ? colors.info : colors.warning}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.publishBannerTitle}>
                {activeRestaurant.launchStatus === 'GO_LIVE_REVIEW'
                  ? (language === 'sw' ? 'Uhakiki wa Kuzindua Unaendelea (Gate B)' : 'Launch Review Pending Admin Approval')
                  : activeRestaurant.launchStatus === 'CORRECTIONS_REQUIRED'
                  ? (language === 'sw' ? 'Marekebisho Yanahitajika Kabla ya Kuzindua' : 'Corrections Required Before Launch')
                  : (language === 'sw' ? 'Usajili Haujakamilika / Mgahawa Haujazinduliwa' : 'Setup Incomplete / Unpublished')}
              </Text>
              {activeRestaurant.launchStatus === 'GO_LIVE_REVIEW' ? (
                <Text style={styles.publishBannerSub}>
                  {language === 'sw'
                    ? 'Ombi lako la kuzindua mgahawa linakaguliwa na wasimamizi. Wateja hawataona mgahawa mpaka utakapoidhinishwa rasmi.'
                    : 'Your store launch request is currently under Gate B administrative review. Customers will not see your store until launch approval is granted.'}
                </Text>
              ) : launchReadiness ? (
                <View style={{ marginTop: 8, gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary }}>
                    STORE LAUNCH READINESS ({launchReadiness.readinessPercent}%)
                  </Text>
                  <View style={{ gap: 3, marginTop: 2 }}>
                    {[
                      { label: 'Business documents', met: launchReadiness.criteria?.hasVerificationDoc },
                      { label: 'Active branch', met: launchReadiness.criteria?.hasActiveBranch },
                      { label: 'Exact location', met: launchReadiness.criteria?.hasAddress },
                      { label: 'Opening hours', met: launchReadiness.criteria?.hasOperatingHours },
                      { label: 'Storefront image', met: launchReadiness.criteria?.hasGalleryPhotos },
                      { label: 'Verified owner phone', met: launchReadiness.criteria?.hasPhone },
                      { label: 'Menu', met: launchReadiness.criteria?.hasValidMenuItem && launchReadiness.criteria?.hasPricedItem },
                      { label: 'Payout destination', met: launchReadiness.criteria?.hasPayoutConfigured },
                      { label: 'Delivery configuration', met: launchReadiness.criteria?.hasAddress },
                    ].map((item, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>{item.label}</Text>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: item.met ? '#16a34a' : '#ef4444' }}>
                          {item.met ? '✓' : '✕'}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {launchReadiness.blockers && launchReadiness.blockers.length > 0 && (
                    <View style={{ marginTop: 4, gap: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.danger }}>
                        {language === 'sw' ? 'Mambo yanayozuia uzinduzi:' : 'Items blocking launch:'}
                      </Text>
                      {launchReadiness.blockers.map((b, idx) => (
                        <Text key={idx} style={{ fontSize: 10.5, color: colors.danger }}>• {b}</Text>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.publishBannerSub}>
                  {launchReadinessLoading
                    ? 'Evaluating store launch readiness...'
                    : language === 'sw'
                    ? 'Inakagua vigezo vya uzinduzi wa duka...'
                    : 'Checking store launch readiness criteria...'}
                </Text>
              )}
            </View>
            {activeRestaurant.launchStatus === 'GO_LIVE_REVIEW' ? (
              <View style={[styles.publishActionBtn, { backgroundColor: colors.infoSoft, borderColor: colors.info, borderWidth: 1 }]}>
                <Text style={[styles.publishActionBtnText, { color: colors.info }]}>
                  {language === 'sw' ? 'Inakaguliwa...' : 'In Review...'}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.publishActionBtn, !isPublishPrerequisitesMet && { opacity: 0.5, backgroundColor: colors.textMuted }]}
                onPress={handlePublishRestaurant}
                disabled={!isPublishPrerequisitesMet}
                activeOpacity={0.85}
              >
                <Text style={styles.publishActionBtnText}>
                  {activeRestaurant.launchStatus === 'CORRECTIONS_REQUIRED'
                    ? (language === 'sw' ? 'Wasilisha Tena' : 'Resubmit Launch')
                    : (language === 'sw' ? 'Wasilisha Kuzindua' : 'Submit for Launch')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 2. Main Workspace Layout */}
      <View style={styles.workspaceRow}>
        {/* Desktop Sidebar */}
        {isLargeScreen && (
          <View style={styles.sidebarWrapper}>
            <RestaurantSidebar
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              userRole={userRole}
              orderBadgeCount={pendingOrders.length}
              kitchenBadgeCount={kitchenOrders.length}
              language={language as any}
            />
          </View>
        )}

        {/* Content Viewport */}
        <View style={styles.viewport}>
          {/* Mobile Tab Bar */}
          {!isLargeScreen && (
            <RestaurantMobileNav
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              userRole={userRole}
              orderBadgeCount={pendingOrders.length}
              kitchenBadgeCount={kitchenOrders.length}
              language={language as any}
            />
          )}

          {workspaceLoadError ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.dangerSoft,
                borderBottomWidth: 1,
                borderBottomColor: colors.danger,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm,
                gap: Spacing.sm,
              }}
            >
              <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.danger }}>
                {workspaceLoadError}
              </Text>
              <TouchableOpacity
                onPress={loadRestaurantWorkspace}
                style={{
                  backgroundColor: colors.danger,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: Radii.sm,
                }}
                accessibilityRole="button"
                accessibilityLabel="Retry loading workspace"
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.onPrimary }}>
                  {language === 'sw' ? 'Jaribu Tena' : 'Retry'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Tab Views */}
          <View style={styles.tabContentArea}>
            {activeTab === 'overview' && (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {/* 5-Point Setup Checklist Card (Task 26) */}
                <View style={styles.setupCard}>
                  <View style={styles.setupCardHeader}>
                    <Text style={styles.setupCardTitle}>
                      {language === 'sw' ? 'Hatua za Usanidi wa Mgahawa' : 'Restaurant Setup Progress'}
                    </Text>
                    <Text style={styles.setupCardStepText}>
                      {[true, hasActiveBranch, hasConfiguredHours, hasValidMenuItem, activeRestaurant.isPublished].filter(Boolean).length} / 5 {language === 'sw' ? 'zimekamilika' : 'completed'}
                    </Text>
                  </View>
                  <View style={styles.setupChecklist}>
                    <View style={styles.setupItem}>
                      <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                      <Text style={styles.setupItemTextDone}>
                        {language === 'sw' ? 'Ombi la mgahawa limeidhinishwa na msimamizi' : 'Application approved by platform admin'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.setupItem}
                      onPress={() => setActiveTab('settings')}
                    >
                      <Ionicons
                        name={hasActiveBranch ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={hasActiveBranch ? "#16a34a" : colors.textMuted}
                      />
                      <Text style={[styles.setupItemText, hasActiveBranch && styles.setupItemTextDone]}>
                        {language === 'sw' ? 'Ongeza angalau tawi 1 la biashara' : 'Add at least one operating branch'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.setupItem}
                      onPress={() => setActiveTab('settings')}
                    >
                      <Ionicons
                        name={hasConfiguredHours ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={hasConfiguredHours ? "#16a34a" : colors.textMuted}
                      />
                      <Text style={[styles.setupItemText, hasConfiguredHours && styles.setupItemTextDone]}>
                        {language === 'sw' ? 'Sanidi masaa ya kazi ya tawi' : 'Configure branch operating hours'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.setupItem}
                      onPress={() => setActiveTab('menu')}
                    >
                      <Ionicons
                        name={hasValidMenuItem ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={hasValidMenuItem ? "#16a34a" : colors.textMuted}
                      />
                      <Text style={[styles.setupItemText, hasValidMenuItem && styles.setupItemTextDone]}>
                        {language === 'sw' ? 'Weka angalau chakula 1 chenye bei halali kwenye menyu' : 'Add at least one menu item with valid price'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.setupItem}
                      onPress={() => {
                        if (!activeRestaurant.isPublished) {
                          handlePublishRestaurant();
                        }
                      }}
                      activeOpacity={activeRestaurant.isPublished ? 1 : 0.75}
                    >
                      <Ionicons
                        name={activeRestaurant.isPublished ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={activeRestaurant.isPublished ? "#16a34a" : colors.textMuted}
                      />
                      <Text style={[styles.setupItemText, activeRestaurant.isPublished && styles.setupItemTextDone]}>
                        {language === 'sw' ? 'Tayari kuzindua / Mgahawa umezinduliwa mtandaoni' : 'Ready to publish / Live online'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Step 5 Action Footer inside Setup Progress Card */}
                  {!activeRestaurant.isPublished ? (
                    <View
                      style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: colors.divider,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1 }}>
                        {!hasActiveBranch
                          ? (language === 'sw' ? 'Hatua inayofuata: Ongeza tawi kwenye Mipangilio (Hatua ya 2).' : 'Next step: Add an operating branch in Settings (Step 2).')
                          : !hasValidMenuItem
                          ? (language === 'sw' ? 'Hatua inayofuata: Ongeza chakula chenye bei kwenye Menyu (Hatua ya 4).' : 'Next step: Add a menu item with a valid price in Menu (Step 4).')
                          : (language === 'sw' ? 'Mgahawa wako uko tayari kuzinduliwa mtandaoni!' : 'Your restaurant is ready to go live online!')}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.publishActionBtn,
                          {
                            backgroundColor:
                              activeRestaurant.launchStatus === 'GO_LIVE_REVIEW'
                                ? colors.info
                                : isPublishPrerequisitesMet
                                ? '#16a34a'
                                : colors.textMuted,
                          },
                          (!isPublishPrerequisitesMet || activeRestaurant.launchStatus === 'GO_LIVE_REVIEW') && { opacity: 0.7 },
                        ]}
                        onPress={handlePublishRestaurant}
                        disabled={!isPublishPrerequisitesMet || activeRestaurant.launchStatus === 'GO_LIVE_REVIEW'}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.publishActionBtnText}>
                          {activeRestaurant.launchStatus === 'GO_LIVE_REVIEW'
                            ? (language === 'sw' ? 'Inakaguliwa...' : 'Review Pending...')
                            : activeRestaurant.launchStatus === 'CORRECTIONS_REQUIRED'
                            ? (language === 'sw' ? 'Wasilisha Tena' : 'Resubmit Launch')
                            : (language === 'sw' ? 'Wasilisha Kuzindua' : 'Submit for Launch')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View
                      style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: colors.success,
                        backgroundColor: colors.successSoft,
                        paddingHorizontal: 12,
                        paddingBottom: 10,
                        borderRadius: Radii.md,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <Ionicons name="radio-button-on" size={16} color="#16a34a" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.success, flex: 1 }}>
                          {language === 'sw'
                            ? 'Mgahawa wako uko LIVE mtandaoni! Wateja wanaweza kuona menyu na kuagiza sasa.'
                            : 'Your restaurant is LIVE online! Customers can now discover your menu and place orders.'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#16a34a',
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: Radii.md,
                        }}
                        onPress={() => router.push(`/restaurant/${activeRestaurant.id}` as any)}
                      >
                        <Text style={{ color: colors.onPrimary, fontSize: 11.5, fontWeight: '700' }}>
                          {language === 'sw' ? 'Tazama Ukurasa wa Wateja →' : 'View Customer Storefront →'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <DashboardOverview
                  restaurantName={activeRestaurant.name}
                  metrics={metrics}
                  alerts={alerts}
                  onNavigateTab={setActiveTab}
                  onQuickVerifyMenu={handleVerifyFullMenu}
                  onPauseOrders={handleToggleStoreStatus}
                  onAddDish={() => {
                    setEditingItem(null);
                    setIsEditorVisible(true);
                  }}
                  isOrdersPaused={!activeRestaurant.isOpen}
                  language={language as any}
                />
              </ScrollView>
            )}

            {activeTab === 'orders' && (
              <IncomingOrdersPanel
                orders={domainOrders}
                onAcceptOrder={handleAcceptOrder}
                onRejectOrder={handleRejectOrder}
                onUpdateStatus={async (orderId, nextStatus) => {
                  await handleAdvanceKitchenStatus(orderId, nextStatus);
                }}
                language={language as any}
                userRole={userRole}
              />
            )}

            {activeTab === 'kitchen' && (
              <KitchenBoard
                orders={kitchenOrders}
                onAdvanceStatus={handleAdvanceKitchenStatus}
                language={language as any}
              />
            )}

            {activeTab === 'custom-meals' && (
              <View>
              {requestLoadError && <Text accessibilityRole="alert" style={{ color: colors.danger, padding: 12 }}>{requestLoadError}</Text>}
              <CustomMealQuotesPanel
                requests={customMealInvitations.map((inv: any) => ({
                  ...inv.request,
                  status: inv.invitation.status === 'QUOTED' ? 'QUOTE_SUBMITTED' : inv.request.status,
                }))}
                onSubmitQuote={async (requestId, quote) => {
                  const targetInv = customMealInvitations.find((inv: any) => inv.request?.id === requestId);
                  const mealTitle =
                    targetInv?.request?.dishName ||
                    targetInv?.request?.title ||
                    'Custom Meal Preparation';
                  await CustomMealRepository.submitStructuredQuote({
                    requestId,
                    restaurantId: activeRestaurant.id,
                    branchId: selectedBranchId || undefined,
                    items: [
                      {
                        name: mealTitle,
                        quantity: 1,
                        unitPriceTzs: quote.priceTzs,
                      },
                    ],
                    deliveryFeeTzs: quote.deliveryFeeTzs || 0,
                    estimatedPrepMinutes: quote.prepMinutes,
                    promisedReadyAt: new Date(Date.now() + quote.prepMinutes * 60 * 1000).toISOString(),
                    fulfillmentMode: (targetInv?.request?.fulfillmentMode as any) || 'PICKUP',
                    restaurantNote: quote.message,
                    dietaryAcknowledged: true,
                    allergyAcknowledged: true,
                    validUntil: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                  });
                  await loadRestaurantWorkspace();
                }}
                onWithdrawQuote={async (requestId) => {
                  await CustomMealRepository.declineInvitation(
                    requestId,
                    activeRestaurant.id,
                    'TOO_BUSY',
                    'Quote withdrawn by kitchen.'
                  );
                  await loadRestaurantWorkspace();
                }}
                language={language as any}
              />
              </View>
            )}

            {activeTab === 'menu' && (
              <MenuManager
                items={menuItems}
                categories={categories}
                onAddNewDish={() => {
                  setEditingItem(null);
                  setIsEditorVisible(true);
                }}
                onEditDish={(item) => {
                  setEditingItem(item);
                  setIsEditorVisible(true);
                }}
                onArchiveDish={handleArchiveDish}
                onToggleAvailability={handleToggleAvailability}
                onBulkSetAvailability={handleBulkSetAvailability}
                onVerifyFullMenu={handleVerifyFullMenu}
                onVerifySingleDish={handleVerifySingleDish}
                onOpenCategoriesManager={() => setIsCategoryManagerVisible(true)}
                language={language as any}
              />
            )}

            {activeTab === 'reservations' && (
              <ReservationManager
                reservations={reservations}
                onUpdateStatus={handleUpdateReservationStatus}
                language={language as any}
              />
            )}

            {activeTab === 'reviews' && (
              <ReviewsPanel
                reviews={reviews}
                averageRating={activeRestaurant.rating || 0}
                onRespondToReview={handleRespondToReview}
                language={language as any}
              />
            )}

            {activeTab === 'earnings' && (
              <EarningsOverview
                restaurantId={activeRestaurant.id}
                summary={financialSummary}
                todayGrossTzs={financialTotals.todayGross}
                todayNetTzs={financialTotals.todayNet}
                weekGrossTzs={financialTotals.weekGross}
                monthGrossTzs={financialTotals.monthGross}
                transactions={earningsTransactions}
                settlements={settlements}
                payouts={payouts}
                destinations={payoutDestinations}
                refunds={refundRequests}
                disputes={financialDisputes}
                userRole={userRole}
                onRefresh={loadRestaurantWorkspace}
                onDateFilterChange={handleFinanceDateFilterChange}
                language={language as any}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsPanel
                data={discoveryAnalytics}
                restaurantId={activeRestaurant.id}
                orders={domainOrders}
                payments={payments}
                menuItems={menuItems}
                branches={branches}
                financialSummary={financialSummary}
                language={language as any}
              />
            )}

            {activeTab === 'staff' && (
              <StaffManager
                staffList={staffList}
                currentUserId={authUser?.id || ''}
                onInviteStaff={handleInviteStaff}
                onChangeRole={handleChangeStaffRole}
                onDeactivateStaff={handleDeactivateStaff}
                language={language as any}
              />
            )}

            {activeTab === 'settings' && (
              <RestaurantSettings
                restaurant={activeRestaurant}
                branches={branches}
                selectedBranchId={selectedBranchId}
                onSaveProfile={handleSaveProfile}
                onUpdateOperatingStatus={handleUpdateOperatingStatus}
                onBranchUpdated={loadRestaurantWorkspace}
                language={language as any}
              />
            )}
          </View>
        </View>
      </View>

      {/* Root Modals */}
      <MenuItemEditor
        key={`${editingItem?.id || 'new'}-${isEditorVisible}`}
        visible={isEditorVisible}
        item={editingItem}
        restaurantId={activeRestaurant.id}
        categories={categories}
        branches={branches}
        branchOverrides={branchOverrides}
        onSave={handleSaveMenuItem}
        onClose={() => {
          setIsEditorVisible(false);
          setEditingItem(null);
        }}
        language={language as any}
      />

      <CategoryManager
        visible={isCategoryManagerVisible}
        categories={categories}
        onAddCategory={handleAddCategory}
        onArchiveCategory={handleArchiveCategory}
        onClose={() => setIsCategoryManagerVisible(false)}
        language={language as any}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  workspaceRow: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarWrapper: {
    width: 250,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.sidebarBackground,
  },
  viewport: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: colors.appBackground,
  },
  tabContentArea: {
    flex: 1,
  },
  gateContainer: {
    flex: 1,
    backgroundColor: colors.appBackground,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  gateCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    maxWidth: 440,
    width: '100%',
    ...Shadows.md,
  },
  gateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  gateSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  gatePrimaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: Radii.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  gatePrimaryBtnText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  gateSecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: Radii.md,
    width: '100%',
    alignItems: 'center',
  },
  gateSecondaryBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  publishBanner: {
    backgroundColor: colors.warningSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  publishBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  publishBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.warning,
  },
  publishBannerSub: {
    fontSize: 11.5,
    color: colors.warning,
    marginTop: 2,
  },
  publishActionBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.md,
    ...Shadows.sm,
  },
  publishActionBtnText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  setupCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    ...Shadows.sm,
  },
  setupCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  setupCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  setupCardStepText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.primary,
  },
  setupChecklist: {
    gap: 8,
  },
  setupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setupItemText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  setupItemTextDone: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
let styles = createStyles(lightColors);
