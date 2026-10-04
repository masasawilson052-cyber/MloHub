import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCustomerLocation } from '../context/CustomerLocationContext';
import { CustomerAddressesRepository } from '../repositories/customerAddresses.repository';
import { ServiceCity, ServiceArea, CustomerSavedAddress } from '../types/domain';

import { useTheme } from '../context/ThemeContext';
import { ThemeColors, lightColors } from '../theme/palettes';

let colors: ThemeColors = lightColors;

interface LocationModalProps {
  visible?: boolean;
  onClose?: () => void;
  // Backward compatibility props
  selectedLocation?: string;
  onSelect?: (location: string) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  visible: propVisible,
  onClose: propOnClose,
  selectedLocation,
  onSelect,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const { language } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const {
    location,
    isLocationModalOpen,
    setIsLocationModalOpen,
    selectSavedAddress,
    selectServiceArea,
    useDeviceLocation,
    isLoadingLocation,
    locationError,
  } = useCustomerLocation();

  const isVisible = propVisible !== undefined ? propVisible : isLocationModalOpen;
  const handleClose = () => {
    if (propOnClose) propOnClose();
    setIsLocationModalOpen(false);
  };

  const [cities, setCities] = useState<ServiceCity[]>([]);
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<CustomerSavedAddress[]>([]);
  const [selectedCity, setSelectedCity] = useState<ServiceCity | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isVisible) return;
    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const cityList = await CustomerAddressesRepository.listServiceCities();
        if (!isMounted) return;
        setCities(cityList);

        const liveCity = cityList.find((c) => c.marketStatus === 'LIVE') || cityList[0];
        setSelectedCity(liveCity || null);

        if (liveCity) {
          const areaList = await CustomerAddressesRepository.listServiceAreas(liveCity.id);
          if (isMounted) setAreas(areaList);
        }

        if (isAuthenticated && user?.id) {
          const addrList = await CustomerAddressesRepository.list(user.id);
          if (isMounted) setSavedAddresses(addrList);
        }
      } catch (err: any) {
        console.warn('[LocationModal] Error loading location metadata:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [isVisible, isAuthenticated, user?.id]);

  const handleCitySelect = async (city: ServiceCity) => {
    if (city.marketStatus !== 'LIVE') return;
    setSelectedCity(city);
    try {
      const areaList = await CustomerAddressesRepository.listServiceAreas(city.id);
      setAreas(areaList);
    } catch (err: any) {
      console.warn('[LocationModal] Error fetching areas for city:', err.message);
    }
  };

  const handleAreaSelect = (area: ServiceArea) => {
    if (selectedCity) {
      selectServiceArea(selectedCity, area);
    }
    if (onSelect) {
      onSelect(area.name);
    }
    handleClose();
  };

  const handleSavedAddressSelect = (addr: CustomerSavedAddress) => {
    selectSavedAddress(addr);
    if (onSelect) {
      onSelect(addr.areaName || addr.streetAddress);
    }
    handleClose();
  };

  const handleDeviceDetect = async () => {
    const success = await useDeviceLocation();
    if (success) {
      handleClose();
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {language === 'sw' ? 'Chagua Eneo Lako' : 'Select Delivery Location'}
              </Text>
              <Text style={styles.subtitle}>
                {language === 'sw'
                  ? 'Gundua migahawa halisi iliyo wazi na huduma za uwasilishaji'
                  : 'Discover real open restaurants and delivery services'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            {/* Device Location CTA */}
            <TouchableOpacity
              style={styles.deviceBtn}
              onPress={handleDeviceDetect}
              disabled={isLoadingLocation}
              activeOpacity={0.8}
            >
              <View style={styles.deviceIconCircle}>
                {isLoadingLocation ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="navigate" size={18} color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deviceBtnTitle}>
                  {language === 'sw' ? 'Tumia Mahali Nilipo Sasa' : 'Use Current Device Location'}
                </Text>
                <Text style={styles.deviceBtnSub}>
                  {location.source === 'DEVICE' && location.latitude
                    ? (language === 'sw' ? 'GPS imewashwa kwa ukaribu wa migahawa' : 'GPS active for true nearby restaurants')
                    : (language === 'sw' ? 'Bofya kutambua eneo lako kwa usahihi' : 'Tap to detect coordinates with your permission')}
                </Text>
              </View>
            </TouchableOpacity>

            {locationError ? (
              <View style={styles.errorNotice}>
                <Ionicons name="information-circle" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{locationError}</Text>
              </View>
            ) : null}

            {/* Saved Addresses Section */}
            {savedAddresses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                  {language === 'sw' ? 'Anwani Zilizohifadhiwa' : 'Saved Addresses'}
                </Text>
                {savedAddresses.map((addr) => {
                  const isCurrent = location.savedAddressId === addr.id;
                  return (
                    <TouchableOpacity
                      key={addr.id}
                      style={[styles.itemCard, isCurrent && styles.itemCardActive]}
                      onPress={() => handleSavedAddressSelect(addr)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.itemIconCircle}>
                        <Ionicons
                          name={addr.label.toLowerCase().includes('work') ? 'briefcase-outline' : 'home-outline'}
                          size={18}
                          color={isCurrent ? colors.primary : colors.textMuted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.itemTitle}>{addr.label}</Text>
                          {addr.isDefault && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>Default</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.itemSub} numberOfLines={1}>
                          {addr.streetAddress} {addr.areaName ? `• ${addr.areaName}` : ''}
                        </Text>
                      </View>
                      {isCurrent && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Service Cities Section */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>
                {language === 'sw' ? 'Miji Inayohudumiwa' : 'Service Cities'}
              </Text>
              <View style={styles.cityGrid}>
                {cities.map((city) => {
                  const isLive = city.marketStatus === 'LIVE';
                  const isSelected = selectedCity?.id === city.id;
                  return (
                    <TouchableOpacity
                      key={city.id}
                      style={[
                        styles.cityCard,
                        isSelected && styles.cityCardActive,
                        !isLive && styles.cityCardDisabled,
                      ]}
                      onPress={() => handleCitySelect(city)}
                      disabled={!isLive}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.cityName, isSelected && styles.cityNameActive, !isLive && styles.cityNameDisabled]}>
                        {city.name}
                      </Text>
                      <View style={[styles.cityBadge, isLive ? styles.cityBadgeLive : styles.cityBadgeSoon]}>
                        <Text style={[styles.cityBadgeText, isLive ? styles.cityBadgeTextLive : styles.cityBadgeTextSoon]}>
                          {isLive ? (language === 'sw' ? 'Inafanya Kazi' : 'Available') : (language === 'sw' ? 'Hivi Karibuni' : 'Coming Soon')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Operating Areas in Selected City */}
            {selectedCity && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                  {language === 'sw' ? `Maeneo ya ${selectedCity.name}` : `${selectedCity.name} Areas`}
                </Text>
                {loading ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
                ) : areas.length === 0 ? (
                  <Text style={styles.emptyAreaText}>
                    {language === 'sw' ? 'Hakuna maeneo maalum yaliyopatikana.' : 'No active service zones found.'}
                  </Text>
                ) : (
                  <View style={styles.areasGrid}>
                    {areas.map((area) => {
                      const isCurrent =
                        location.serviceAreaName === area.name || selectedLocation === area.name;
                      return (
                        <TouchableOpacity
                          key={area.id}
                          style={[styles.areaPill, isCurrent && styles.areaPillActive]}
                          onPress={() => handleAreaSelect(area)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.areaPillText, isCurrent && styles.areaPillTextActive]}>
                            {area.name}
                          </Text>
                          {isCurrent && <Ionicons name="checkmark" size={14} color={colors.onPrimary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalBox: {
    backgroundColor: colors.card,
    borderRadius: Radii.xxl,
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    ...Shadows.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
    borderRadius: Radii.full,
    backgroundColor: colors.card,
  },
  scrollList: {
    padding: Spacing.lg,
  },
  deviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    marginBottom: Spacing.md,
  },
  deviceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.warningSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceBtnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  deviceBtnSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerSoft,
    padding: Spacing.sm,
    borderRadius: Radii.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.textMuted,
    marginBottom: Spacing.sm,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: Spacing.xs,
  },
  itemCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  itemIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  defaultBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.full,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
  },
  cityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cityCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    justifyContent: 'space-between',
  },
  cityCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  cityCardDisabled: {
    opacity: 0.6,
    backgroundColor: colors.surfaceInteractive,
  },
  cityName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  cityNameActive: {
    color: colors.primary,
  },
  cityNameDisabled: {
    color: colors.textMuted,
  },
  cityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  cityBadgeLive: {
    backgroundColor: colors.successSoft,
  },
  cityBadgeSoon: {
    backgroundColor: colors.divider,
  },
  cityBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cityBadgeTextLive: {
    color: colors.success,
  },
  cityBadgeTextSoon: {
    color: colors.textSecondary,
  },
  emptyAreaText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  areasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  areaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  areaPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  areaPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  areaPillTextActive: {
    color: colors.onPrimary,
  },
});
let styles = createStyles(lightColors);
