import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeColors } from '../../theme/palettes';
import { CustomerSavedAddress, BranchDeliveryZone } from '../../types/domain';
import { DeliveryQuoteApi, DeliveryQuoteResult } from '../../services/api/DeliveryQuoteApi';
import { createOrderReviewStyles } from './orderReviewStyles';

export interface CheckoutAddressSectionProps {
  colors: ThemeColors;
  customerLocation: {
    cityName?: string;
  };
  openLocationSelector: () => void;
  savedAddresses: CustomerSavedAddress[];
  selectedAddressId: string | null;
  onSelectSavedAddress: (addr: CustomerSavedAddress) => void;
  deliveryAddress: string;
  onChangeDeliveryAddress: (txt: string) => void;
  isLoadingQuote: boolean;
  isOutsideDeliveryRange: boolean;
  quoteError: string | null;
  deliveryQuote: DeliveryQuoteResult | null;
  destinationCoords: any;
  deliveryPricingMode: 'ROUTE_DISTANCE' | 'FIXED_ZONE';
  deliveryZones: BranchDeliveryZone[];
  isLoadingZones: boolean;
  selectedDeliveryZone: BranchDeliveryZone | null;
  onSelectDeliveryZone: (zone: BranchDeliveryZone) => void;
}

export const CheckoutAddressSection: React.FC<CheckoutAddressSectionProps> = ({
  colors,
  customerLocation,
  openLocationSelector,
  savedAddresses,
  selectedAddressId,
  onSelectSavedAddress,
  deliveryAddress,
  onChangeDeliveryAddress,
  isLoadingQuote,
  isOutsideDeliveryRange,
  quoteError,
  deliveryQuote,
  destinationCoords,
  deliveryPricingMode,
  deliveryZones,
  isLoadingZones,
  selectedDeliveryZone,
  onSelectDeliveryZone,
}) => {
  const { t } = useLanguage();
  const styles = createOrderReviewStyles(colors);

  return (
    <>
      <View style={styles.inputGroup}>
        <View style={styles.addressHeaderRow}>
          <Text style={styles.inputLabel}>
            {t('checkoutDeliveryAddress')} ({customerLocation.cityName || 'Tanzania'})
          </Text>
          <TouchableOpacity onPress={openLocationSelector}>
            <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
              📍 {t('checkoutChangeLocation')}
            </Text>
          </TouchableOpacity>
        </View>

        {savedAddresses.length > 0 && (
          <View style={styles.savedAddrsRow}>
            {savedAddresses.map((addr) => {
              const isSelected = selectedAddressId === addr.id;
              return (
                <TouchableOpacity
                  key={addr.id}
                  style={[styles.pillBtn, isSelected && styles.pillBtnActive]}
                  onPress={() => onSelectSavedAddress(addr)}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                    {addr.label === 'HOME'
                      ? `🏠 ${t('checkoutSavedAddressHome')}`
                      : addr.label === 'WORK'
                      ? `🏢 ${t('checkoutSavedAddressWork')}`
                      : `📍 ${addr.label || t('checkoutSavedAddressSaved')}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TextInput
          style={styles.textInput}
          value={deliveryAddress}
          onChangeText={onChangeDeliveryAddress}
          placeholder={t('checkoutAddressPlaceholder')}
          placeholderTextColor={colors.inputPlaceholder}
        />
      </View>

      {/* Route quote card */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{t('checkoutRoutePricing')}</Text>
        {isLoadingQuote ? (
          <View style={[styles.routeQuoteCard, { borderColor: colors.border }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.routeQuoteText, { color: colors.textSecondary }]}>
              {t('checkoutRouteCalculating')}
            </Text>
          </View>
        ) : isOutsideDeliveryRange ? (
          <View style={[styles.routeQuoteCard, { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}>
            <Ionicons name="warning-outline" size={20} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>
                {t('checkoutOutsideRadius')}
              </Text>
              <Text style={{ fontSize: 12, color: colors.danger, marginTop: 2 }}>
                {quoteError || t('deliveryRangeExceeded')}
              </Text>
            </View>
          </View>
        ) : deliveryQuote ? (
          <View style={[styles.routeQuoteCard, { borderColor: colors.primary, backgroundColor: colors.surfaceInteractive }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="navigate-circle" size={24} color={colors.primary} />
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>
                    {DeliveryQuoteApi.formatDistance(deliveryQuote.distanceMeters)} • {DeliveryQuoteApi.formatDuration(deliveryQuote.durationSeconds)}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {t('checkoutRouteVerified')}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '900', color: colors.primary }}>
                TZS {deliveryQuote.deliveryFeeTzs.toLocaleString()}
              </Text>
            </View>
          </View>
        ) : !destinationCoords ? (
          <TouchableOpacity style={[styles.routeQuoteCard, { borderColor: colors.border }]} onPress={openLocationSelector}>
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <Text style={[styles.routeQuoteText, { color: colors.primary, fontWeight: '600' }]}>
              {t('checkoutPinLocation')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Delivery zones if FIXED_ZONE */}
      {deliveryPricingMode === 'FIXED_ZONE' && deliveryZones.length > 0 && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('checkoutDeliveryArea')}</Text>
          {isLoadingZones ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <View style={{ gap: 6, marginTop: 4 }}>
              {deliveryZones.map((zone) => {
                const isSelected = selectedDeliveryZone?.id === zone.id;
                return (
                  <TouchableOpacity
                    key={zone.id}
                    style={[styles.zoneCard, isSelected && styles.zoneCardSelected]}
                    onPress={() => onSelectDeliveryZone(zone)}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.zoneName, isSelected && styles.zoneNameSelected]}>{zone.zoneName}</Text>
                        <Text style={styles.zoneDetails}>
                          {t('checkoutEstMins')} {zone.estimatedDeliveryMinutes} mins
                          {zone.minimumOrderTzs > 0 ? ` • ${t('checkoutMinOrderPrefix')} TZS ${zone.minimumOrderTzs.toLocaleString()}` : ''}
                        </Text>
                      </View>
                      <Text style={[styles.zoneFee, isSelected && styles.zoneFeeSelected]}>
                        TZS {zone.feeTzs.toLocaleString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
    </>
  );
};
