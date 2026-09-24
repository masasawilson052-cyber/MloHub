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
      if (onSelect) onSelect(location.serviceAreaName || 'Nearby');
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
              <Ionicons name="close" size={22} color={Colors.text} />
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
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Ionicons name="navigate" size={18} color={Colors.primary} />
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
                          color={isCurrent ? Colors.primary : Colors.textMuted}
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
                      {isCurrent && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
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
                  <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
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
                          {isCurrent && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalBox: {
    backgroundColor: Colors.white,
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
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
  },
  scrollList: {
    padding: Spacing.lg,
  },
  deviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: Spacing.md,
    borderRadius: Radii.lg,
    marginBottom: Spacing.md,
  },
  deviceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceBtnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  deviceBtnSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    padding: Spacing.sm,
    borderRadius: Radii.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: 12,
    color: '#b91c1c',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  itemCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#fff7ed',
  },
  itemIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  itemSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  defaultBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.full,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  cityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cityCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    justifyContent: 'space-between',
  },
  cityCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#fff7ed',
  },
  cityCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#f1f5f9',
  },
  cityName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  cityNameActive: {
    color: Colors.primary,
  },
  cityNameDisabled: {
    color: Colors.textMuted,
  },
  cityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  cityBadgeLive: {
    backgroundColor: '#dcfce7',
  },
  cityBadgeSoon: {
    backgroundColor: '#e2e8f0',
  },
  cityBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cityBadgeTextLive: {
    color: '#15803d',
  },
  cityBadgeTextSoon: {
    color: '#64748b',
  },
  emptyAreaText: {
    fontSize: 13,
    color: Colors.textMuted,
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  areaPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  areaPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  areaPillTextActive: {
    color: '#FFFFFF',
  },
});
