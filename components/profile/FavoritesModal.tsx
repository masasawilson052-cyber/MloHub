import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { EmptyState } from '../ui/EmptyState';

interface FavoriteRestaurant {
  id: string;
  name: string;
  emoji?: string;
  cuisine?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  reviewsCount?: number;
}

export interface FavoritesModalProps {
  visible: boolean;
  onClose: () => void;
  favoriteIds: string[];
  onRemoveFavorite: (id: string) => void;
  restaurants?: FavoriteRestaurant[];
}

export const FavoritesModal: React.FC<FavoritesModalProps> = ({
  visible,
  onClose,
  favoriteIds,
  onRemoveFavorite,
  restaurants = [],
}) => {
  const router = useRouter();

  if (!visible) return null;

  const favoriteRestaurants = (restaurants || []).filter((r) => favoriteIds.includes(r.id));

  const handleOpenRestaurant = (id: string) => {
    onClose();
    router.push(`/restaurant/${id}` as any);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Saved Favorites ({favoriteRestaurants.length})</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {favoriteRestaurants.length === 0 ? (
            <EmptyState
              title="No favorites saved yet"
              message="Tap the heart icon on any restaurant or dish to save it here for fast reordering."
              icon="heart-outline"
              actionTitle="Browse Restaurants"
              onAction={onClose}
              style={styles.emptyState}
            />
          ) : (
            <ScrollView
              style={styles.scrollList}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {favoriteRestaurants.map((r) => (
                <View key={r.id} style={styles.favoriteRow}>
                  <TouchableOpacity
                    style={styles.favoriteInfo}
                    onPress={() => handleOpenRestaurant(r.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.emojiCircle}>
                      <Text style={styles.emoji}>{r.emoji || '🍲'}</Text>
                    </View>
                    <View style={styles.textCol}>
                      <Text style={styles.restaurantName}>{r.name}</Text>
                      <Text style={styles.subText}>{r.cuisine} • {r.address}</Text>
                      <Text style={styles.ratingText}>★ {r.rating ?? '—'} ({r.reviews ?? r.reviewsCount ?? 0} reviews)</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => onRemoveFavorite(r.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${r.name} from favorites`}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 40, 30, 0.45)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: {
    ...Typography.H2,
  },
  closeBtn: {
    padding: 6,
  },
  emptyState: {
    paddingVertical: Spacing.xxl,
  },
  scrollList: {
    maxHeight: 380,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  favoriteInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  emoji: {
    fontSize: 22,
  },
  textCol: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
    marginTop: 2,
  },
  removeBtn: {
    padding: Spacing.xs,
  },
});
