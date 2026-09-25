import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { FavoritesRepository } from '../../repositories/favorites.repository';
import { RestaurantRepository } from '../../repositories/restaurants.repository';
import { Restaurant } from '../../types/domain';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface SavedFavoritesModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SavedFavoritesModal: React.FC<SavedFavoritesModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const router = useRouter();
  const { user } = useAuth();
  const [favoriteRestaurants, setFavoriteRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const favIds = await FavoritesRepository.listFavorites(user.id);
      if (favIds.length === 0) {
        setFavoriteRestaurants([]);
        setLoading(false);
        return;
      }

      const all = await RestaurantRepository.list({ verifiedOnly: true, publishedOnly: true });
      const matched = all.filter((r: Restaurant) => favIds.includes(r.id));
      setFavoriteRestaurants(matched);
    } catch (err: any) {
      console.warn('Failed to load favorites:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && user?.id) {
      loadFavorites();
    }
  }, [visible, user?.id]);

  const handleRemove = async (restId: string) => {
    if (!user?.id) return;
    try {
      await FavoritesRepository.removeFavorite(user.id, restId);
      setFavoriteRestaurants((prev) => prev.filter((r) => r.id !== restId));
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Saved Favorites</Text>
              <Text style={styles.subtitle}>Your preferred kitchens in Dar es Salaam</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : favoriteRestaurants.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="heart-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No favorite restaurants yet</Text>
                <Text style={styles.emptySub}>
                  Tap the heart icon on any restaurant card to save your favorite spots here.
                </Text>
              </View>
            ) : (
              favoriteRestaurants.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.card}
                  onPress={() => {
                    onClose();
                    router.push(`/restaurant/${r.id}` as any);
                  }}
                >
                  <Image
                    source={{
                      uri:
                        r.logoUrl ||
                        r.coverImageUrl ||
                        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400',
                    }}
                    style={styles.image}
                  />
                  <View style={styles.cardContent}>
                    <Text style={styles.cardName}>{r.name}</Text>
                    <Text style={styles.cardCuisine}>{r.cuisine} • {r.neighborhood || 'Dar es Salaam'}</Text>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={14} color="#EAB308" />
                      <Text style={styles.ratingText}>{Number(r.rating || 0).toFixed(1)}</Text>
                      <Text style={styles.reviewsText}>({r.reviewsCount || 0} reviews)</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleRemove(r.id);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="heart" size={22} color="#EF4444" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
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
    padding: 6,
  },
  scroll: {
    padding: Spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.appBackground,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: Radii.sm,
    backgroundColor: colors.divider,
  },
  cardContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardCuisine: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reviewsText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  removeBtn: {
    padding: Spacing.sm,
  },
});
let styles = createStyles(lightColors);
