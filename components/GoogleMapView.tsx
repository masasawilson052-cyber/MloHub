import { directionsUrl } from '../utils/directions';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Restaurant } from '../types/domain';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

export interface GoogleMapViewProps {
  restaurants: Restaurant[];
  selectedRestaurantId?: string;
  onSelectRestaurant?: (restaurant: Restaurant) => void;
  onOpenReservation?: (restaurant: Restaurant) => void;
  height?: number;
}

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  restaurants,
  selectedRestaurantId,
  onSelectRestaurant,
  onOpenReservation,
  height = 420,
}) => {
  const router = useRouter();
  const { language } = useLanguage();
  const { width } = useWindowDimensions();

  const [activeRestaurant, setActiveRestaurant] = useState<Restaurant | undefined>(
    restaurants.find((r) => r.id === selectedRestaurantId) || (restaurants.length > 0 ? restaurants[0] : undefined)
  );
  const [zoomLevel, setZoomLevel] = useState<number>(14);

  const neighborhoods = [
    { name: 'All Dar', lat: -6.7720, lng: 39.2600, zoom: 13 },
    { name: 'Masaki', lat: -6.7540, lng: 39.2830, zoom: 15 },
    { name: 'Oysterbay', lat: -6.7735, lng: 39.2730, zoom: 15 },
    { name: 'Mikocheni', lat: -6.7620, lng: 39.2480, zoom: 15 },
    { name: 'Sinza', lat: -6.7865, lng: 39.2250, zoom: 15 },
  ];

  const [mapCenter, setMapCenter] = useState({
    lat: activeRestaurant?.lat || -6.7735,
    lng: activeRestaurant?.lng || 39.2730,
  });

  const handleSelectPin = (restaurant: Restaurant) => {
    setActiveRestaurant(restaurant);
    setMapCenter({ lat: restaurant.lat || -6.7735, lng: restaurant.lng || 39.2730 });
    if (onSelectRestaurant) {
      onSelectRestaurant(restaurant);
    }
  };

  const handleOpenGoogleMapsDirections = (restaurant: Restaurant) => {
    Linking.openURL(directionsUrl(restaurant)).catch(() => undefined);
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(18, Math.max(11, prev + delta)));
  };

  const handleSelectNeighborhood = (n: typeof neighborhoods[0]) => {
    setMapCenter({ lat: n.lat, lng: n.lng });
    setZoomLevel(n.zoom);
    const nearby = restaurants.find((r) => r.address.includes(n.name));
    if (nearby) {
      setActiveRestaurant(nearby);
    }
  };

  // Google Maps Embed / Tile coordinates URL for live web preview
  const googleMapEmbedUrl = `https://maps.google.com/maps?q=${mapCenter.lat},${mapCenter.lng}&z=${zoomLevel}&output=embed&hl=${language === 'sw' ? 'sw' : 'en'}`;

  return (
    <View style={[styles.container, { height }]}>
      {/* MAP EMBED / CANVAS */}
      <View style={styles.mapCanvasWrapper}>
        {Platform.OS === 'web' ? (
          <iframe
            title="MloHub Google Maps Explorer"
            src={googleMapEmbedUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: 20,
            }}
            loading="lazy"
          />
        ) : (
          <View style={styles.nativeMapBackdrop}>
            <View style={styles.gridLinesRow} />
            <Text style={styles.nativeMapTitle}>🗺️ Google Maps Navigation</Text>
            <Text style={styles.nativeMapSub}>Dar es Salaam • Live GPS</Text>
          </View>
        )}
      </View>

      {/* TOP NEIGHBORHOOD FILTER CHIPS */}
      <View style={styles.neighborhoodChipsWrap}>
        {neighborhoods.map((n) => {
          const isActive =
            Math.abs(mapCenter.lat - n.lat) < 0.005 &&
            Math.abs(mapCenter.lng - n.lng) < 0.005;
          return (
            <TouchableOpacity
              key={n.name}
              style={[styles.nChip, isActive && styles.nChipActive]}
              onPress={() => handleSelectNeighborhood(n)}
              activeOpacity={0.8}
            >
              <Text style={[styles.nChipText, isActive && styles.nChipTextActive]}>
                📍 {n.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* FLOATING ZOOM & CENTER CONTROLS */}
      <View style={styles.mapControlsRight}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => handleZoom(1)}
          activeOpacity={0.8}
          accessibilityLabel="Zoom in"
        >
          <Text style={styles.controlBtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => handleZoom(-1)}
          activeOpacity={0.8}
          accessibilityLabel="Zoom out"
        >
          <Text style={styles.controlBtnText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlBtn, styles.locateBtn]}
          onPress={() => {
            setMapCenter({ lat: -6.7735, lng: 39.2730 });
            setZoomLevel(15);
          }}
          activeOpacity={0.8}
          accessibilityLabel="Center Dar es Salaam"
        >
          <Ionicons name="locate" size={16} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {/* RESTAURANT PIN BAR / SELECTOR */}
      <View style={styles.pinsHorizontalBar}>
        {restaurants.map((r) => {
          const isSelected = activeRestaurant?.id === r.id;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.mapPinPill, isSelected && styles.mapPinPillSelected]}
              onPress={() => handleSelectPin(r)}
              activeOpacity={0.8}
            >
              <Text style={styles.pinEmoji}>{r.emoji}</Text>
              <View>
                <Text
                  style={[styles.pinName, isSelected && styles.pinNameSelected]}
                  numberOfLines={1}
                >
                  {r.name.split(' ')[0]}
                </Text>
                <Text style={styles.pinRating}>★ {r.rating}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* FLOATING RESTAURANT PREVIEW CARD */}
      {activeRestaurant && (
        <View style={styles.floatingCard}>
          <TouchableOpacity
            style={styles.cardHeaderRow}
            onPress={() => router.push(`/restaurant/${activeRestaurant.id}`)}
            activeOpacity={0.8}
          >
            <View style={styles.cardAvatar}>
              <Text style={styles.cardEmoji}>{activeRestaurant.emoji}</Text>
            </View>

            <View style={styles.cardMainInfo}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {activeRestaurant.name}
                </Text>
                <View style={styles.distPill}>
                  <Text style={styles.distPillText}>📍 {activeRestaurant.distance}</Text>
                </View>
              </View>

              <Text style={styles.cardCuisine}>{activeRestaurant.cuisine}</Text>
              <Text style={styles.cardPrice}>{activeRestaurant.price}</Text>
            </View>
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={styles.directionsBtn}
              onPress={() => handleOpenGoogleMapsDirections(activeRestaurant)}
              activeOpacity={0.85}
            >
              <Ionicons name="navigate" size={14} color={Colors.white} />
              <Text style={styles.directionsBtnText}>
                {language === 'sw' ? 'Fungua Google Maps' : 'Google Maps Directions'}
              </Text>
            </TouchableOpacity>

            {onOpenReservation ? (
              <TouchableOpacity
                style={styles.viewMenuBtn}
                onPress={() => onOpenReservation(activeRestaurant)}
                activeOpacity={0.8}
              >
                <Text style={styles.viewMenuBtnText}>
                  {language === 'sw' ? '🪑 Weka Meza' : '🪑 Reserve'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.viewMenuBtn}
                onPress={() => router.push(`/restaurant/${activeRestaurant.id}`)}
                activeOpacity={0.8}
              >
                <Text style={styles.viewMenuBtnText}>
                  {language === 'sw' ? 'Menyu ›' : 'Menu ›'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: Radii.xxl,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#e5e3df',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.md,
  },
  mapCanvasWrapper: {
    width: '100%',
    height: '100%',
  },
  nativeMapBackdrop: {
    flex: 1,
    backgroundColor: '#e8ece9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLinesRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: '#d2ddd5',
  },
  nativeMapTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  nativeMapSub: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 2,
  },
  neighborhoodChipsWrap: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    zIndex: 10,
  },
  nChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  nChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  nChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.text,
  },
  nChipTextActive: {
    color: Colors.white,
  },
  mapControlsRight: {
    position: 'absolute',
    top: 48,
    right: 12,
    gap: 6,
    zIndex: 10,
  },
  controlBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  locateBtn: {
    marginTop: 4,
  },
  controlBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
    lineHeight: 18,
  },
  pinsHorizontalBar: {
    position: 'absolute',
    bottom: 124,
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  mapPinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  mapPinPillSelected: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryLight,
  },
  pinEmoji: {
    fontSize: 12,
  },
  pinName: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.text,
  },
  pinNameSelected: {
    color: Colors.white,
  },
  pinRating: {
    fontSize: 8,
    fontWeight: '900',
    color: Colors.accent,
  },
  floatingCard: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 10,
    ...Shadows.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardAvatar: {
    width: 42,
    height: 42,
    borderRadius: Radii.lg,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: 22,
  },
  cardMainInfo: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.text,
    flex: 1,
  },
  distPill: {
    backgroundColor: Colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  distPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  cardCuisine: {
    fontSize: 10,
    color: Colors.muted,
    marginTop: 1,
  },
  cardPrice: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginTop: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  directionsBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1d6637',
    paddingVertical: 8,
    borderRadius: Radii.lg,
  },
  directionsBtnText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '900',
  },
  viewMenuBtn: {
    flex: 1,
    backgroundColor: Colors.primaryMuted,
    paddingVertical: 8,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewMenuBtnText: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
});
