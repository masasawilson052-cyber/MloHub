import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';
import { Spacing, Radii, Shadows } from '../../constants/theme';
import {
  evaluateOpeningStatus,
  OperatingHoursRow,
  OpeningStatusResult,
} from '../../utils/openingStatus';
import { formatTzs, formatDistance } from '../../utils/formatters';
import {
  computeDistanceKm,
  KNOWN_TANZANIA_AREAS,
} from '../../utils/customerLocationResolver';
import { matchDeliveryZone } from '../../utils/deliveryZoneMatcher';

export { matchDeliveryZone };

let colors: ThemeColors = lightColors;

export interface RestaurantDecisionFactsProps {
  restaurant: any;
  branch?: any;
  operatingHours?: OperatingHoursRow[];
  deliveryZones?: any[];
  customerArea?: string;
  customerCoords?: { latitude?: number; longitude?: number };
  supportsReservations?: boolean;
}



export const RestaurantDecisionFacts: React.FC<RestaurantDecisionFactsProps> = ({
  restaurant,
  branch,
  operatingHours = [],
  deliveryZones = [],
  customerArea,
  customerCoords,
  supportsReservations = false,
}) => {
  const { t, language } = useLanguage();
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);

  // 1. Authoritative Opening Status
  const isRestaurantOpenFlag =
    restaurant?.isOpen !== false && branch?.is_open !== false && branch?.isOpen !== false;

  const openingStatus: OpeningStatusResult = useMemo(() => {
    return evaluateOpeningStatus(
      isRestaurantOpenFlag,
      operatingHours,
      'PICKUP',
      new Date()
    );
  }, [isRestaurantOpenFlag, operatingHours]);

  // 2. Delivery Zone & Availability Evaluation
  const isDeliveryEnabled =
    branch?.deliveryEnabled !== false &&
    branch?.delivery_enabled !== false &&
    restaurant?.deliveryEnabled !== false;

  const matchedZone = useMemo(() => {
    return matchDeliveryZone(deliveryZones, customerArea);
  }, [deliveryZones, customerArea]);

  const deliveryAvailable = isDeliveryEnabled && matchedZone !== null;
  const zoneFee = matchedZone ? (matchedZone.feeTzs ?? matchedZone.fee_tzs ?? 0) : null;
  const estimatedMin = matchedZone
    ? (matchedZone.estimatedDeliveryMinutes ?? matchedZone.estimated_delivery_minutes ?? 30)
    : null;
  const minOrderAmount = matchedZone
    ? (matchedZone.minimumOrderTzs ?? matchedZone.minimum_order_tzs ?? branch?.min_order_amount_tzs ?? 0)
    : (branch?.min_order_amount_tzs ?? 0);

  // 3. Distance in km
  const distanceStr = useMemo(() => {
    let cLat = customerCoords?.latitude;
    let cLng = customerCoords?.longitude;

    if ((cLat == null || cLng == null) && customerArea) {
      const knownCust = KNOWN_TANZANIA_AREAS.find(
        (a) => a.name.toLowerCase() === customerArea.trim().toLowerCase()
      );
      if (knownCust) {
        cLat = knownCust.lat;
        cLng = knownCust.lng;
      }
    }

    let bLat = branch?.latitude ?? branch?.lat ?? restaurant?.latitude ?? restaurant?.lat;
    let bLng = branch?.longitude ?? branch?.lng ?? restaurant?.longitude ?? restaurant?.lng;

    if ((bLat == null || bLng == null) && (restaurant?.neighborhood || restaurant?.address)) {
      const targetArea = (restaurant?.neighborhood || restaurant?.address || '').toLowerCase();
      const knownBranch = KNOWN_TANZANIA_AREAS.find((a) =>
        targetArea.includes(a.name.toLowerCase())
      );
      if (knownBranch) {
        bLat = knownBranch.lat;
        bLng = knownBranch.lng;
      }
    }

    if (cLat != null && cLng != null && bLat != null && bLng != null) {
      const distKm = computeDistanceKm(cLat, cLng, bLat, bLng);
      return formatDistance(distKm);
    }

    return restaurant?.distance || null;
  }, [customerCoords, customerArea, branch, restaurant]);

  // 4. Service Types
  const services = useMemo(() => {
    const list: Array<{ id: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = [];

    if (isDeliveryEnabled && deliveryZones.length > 0) {
      list.push({
        id: 'delivery',
        label: t('factsServiceDelivery'),
        icon: 'bicycle-outline',
      });
    }

    const takeawayEnabled =
      branch?.takeawayEnabled !== false && branch?.takeaway_enabled !== false;
    if (takeawayEnabled) {
      list.push({
        id: 'takeaway',
        label: t('factsServiceTakeaway'),
        icon: 'bag-handle-outline',
      });
    }

    const dineInEnabled =
      branch?.dineInEnabled === true || branch?.dine_in_enabled === true;
    if (dineInEnabled) {
      list.push({
        id: 'dine_in',
        label: t('factsServiceDineIn'),
        icon: 'restaurant-outline',
      });
    }

    if (supportsReservations) {
      list.push({
        id: 'reservations',
        label: t('factsServiceReservations'),
        icon: 'calendar-outline',
      });
    }

    return list;
  }, [isDeliveryEnabled, deliveryZones, branch, supportsReservations, t]);

  // Status badge appearance
  const getStatusStyle = () => {
    if (openingStatus.status === 'OPEN') {
      return {
        bg: colors.successSoft,
        text: colors.success,
        dot: colors.success,
        label: language === 'sw' ? openingStatus.labelSw : openingStatus.labelEn,
      };
    }
    if (openingStatus.status === 'OPENS_LATER') {
      return {
        bg: colors.warningSoft,
        text: colors.accentDark,
        dot: colors.warning,
        label: language === 'sw' ? openingStatus.labelSw : openingStatus.labelEn,
      };
    }
    if (openingStatus.status === 'PAUSED') {
      return {
        bg: colors.warningSoft,
        text: colors.accentDark,
        dot: colors.warning,
        label: language === 'sw' ? openingStatus.labelSw : openingStatus.labelEn,
      };
    }
    return {
      bg: colors.surfaceInteractive,
      text: colors.textMuted,
      dot: colors.textMuted,
      label: language === 'sw' ? openingStatus.labelSw : openingStatus.labelEn,
    };
  };

  const statusConfig = getStatusStyle();

  return (
    <View style={styles.card}>
      {/* Top Key Metrics Row: Status & Distance */}
      <View style={styles.topRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusConfig.dot }]} />
          <Text style={[styles.statusText, { color: statusConfig.text }]}>
            {statusConfig.label}
          </Text>
        </View>

        {distanceStr ? (
          <View style={styles.distanceBadge}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.distanceText}>{distanceStr}</Text>
          </View>
        ) : null}
      </View>

      {/* Delivery Zone Decision Fact */}
      <View style={styles.deliveryBlock}>
        {deliveryAvailable ? (
          <View>
            <View style={styles.deliveryMainRow}>
              <View style={styles.deliveryIconCircle}>
                <Ionicons name="bicycle" size={16} color={colors.primary} />
              </View>
              <View style={styles.deliveryDetails}>
                <Text style={styles.deliveryHeadline}>
                  {t('factsDeliveryFrom')}{' '}
                  <Text style={styles.boldText}>{formatTzs(zoneFee)}</Text>
                  {estimatedMin != null ? (
                    <Text style={styles.timeTag}>
                      {' '}
                      • {t('factsEstTime').replace('{min}', String(estimatedMin))}
                    </Text>
                  ) : null}
                </Text>
                <Text style={styles.deliveryDisclaimer}>
                  {t('factsFinalFeeAtCheckout')}
                </Text>
              </View>
            </View>

            {/* Minimum Order Fact */}
            <View style={styles.minOrderRow}>
              <Text style={styles.minOrderText}>
                {minOrderAmount > 0
                  ? t('factsMinOrder').replace('{amount}', formatTzs(minOrderAmount))
                  : t('factsNoMinOrder')}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.deliveryUnavailableRow}>
            <Ionicons name="walk-outline" size={16} color={colors.warning} />
            <Text style={styles.deliveryUnavailableText}>
              {t('factsDeliveryNotAvailable')}
            </Text>
          </View>
        )}
      </View>

      {/* Service Types Pills */}
      {services.length > 0 && (
        <View style={styles.servicesRow}>
          {services.map((svc) => (
            <View key={svc.id} style={styles.servicePill}>
              <Ionicons
                name={svc.icon}
                size={12}
                color={colors.primary}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.servicePillText}>{svc.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      marginHorizontal: Spacing.md,
      marginTop: Spacing.sm,
      marginBottom: Spacing.sm,
      padding: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.sm,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radii.full,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginRight: 6,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
    },
    distanceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    distanceText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    deliveryBlock: {
      paddingVertical: Spacing.xs,
    },
    deliveryMainRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    deliveryIconCircle: {
      width: 28,
      height: 28,
      borderRadius: Radii.full,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.sm,
      marginTop: 2,
    },
    deliveryDetails: {
      flex: 1,
    },
    deliveryHeadline: {
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    boldText: {
      fontWeight: '800',
      color: colors.primary,
    },
    timeTag: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    deliveryDisclaimer: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    minOrderRow: {
      marginTop: 6,
      paddingLeft: 36, // align with delivery text
    },
    minOrderText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    deliveryUnavailableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 8,
      borderRadius: Radii.md,
      gap: 6,
    },
    deliveryUnavailableText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accentDark,
      flex: 1,
    },
    servicesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    servicePill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceInteractive,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: Radii.sm,
    },
    servicePillText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  });
