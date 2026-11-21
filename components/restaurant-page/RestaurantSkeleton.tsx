import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Skeleton } from '../ui/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';
import { Spacing, Radii } from '../../constants/theme';

let colors: ThemeColors = lightColors;

export const RestaurantSkeleton: React.FC = () => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Bar Skeleton */}
      <View style={styles.topBar}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <Skeleton width={160} height={20} />
        <Skeleton width={40} height={40} borderRadius={20} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Cover Banner Skeleton */}
        <View style={styles.visualBanner}>
          <Skeleton width="100%" height={180} borderRadius={0} />
          <View style={styles.logoCircle}>
            <Skeleton width={64} height={64} borderRadius={32} />
          </View>
        </View>

        {/* Header Details Card */}
        <View style={styles.headerCard}>
          <Skeleton width={120} height={20} borderRadius={Radii.full} style={{ marginBottom: 12 }} />
          <Skeleton width="75%" height={26} style={{ marginBottom: 8 }} />
          <Skeleton width="45%" height={16} style={{ marginBottom: 16 }} />

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <Skeleton width="48%" height={42} borderRadius={Radii.md} />
            <Skeleton width="48%" height={42} borderRadius={Radii.md} />
          </View>
        </View>

        {/* Facts Row Card Skeleton */}
        <View style={styles.factsCard}>
          <View style={styles.factsTopRow}>
            <Skeleton width={110} height={24} borderRadius={Radii.full} />
            <Skeleton width={60} height={16} />
          </View>
          <Skeleton width="90%" height={18} style={{ marginTop: 12 }} />
          <Skeleton width="60%" height={14} style={{ marginTop: 6 }} />
          <View style={styles.servicesRow}>
            <Skeleton width={80} height={22} borderRadius={Radii.sm} />
            <Skeleton width={80} height={22} borderRadius={Radii.sm} />
            <Skeleton width={80} height={22} borderRadius={Radii.sm} />
          </View>
        </View>

        {/* Category Tabs Skeleton */}
        <View style={styles.tabBar}>
          <Skeleton width={70} height={32} borderRadius={Radii.full} />
          <Skeleton width={90} height={32} borderRadius={Radii.full} />
          <Skeleton width={80} height={32} borderRadius={Radii.full} />
          <Skeleton width={85} height={32} borderRadius={Radii.full} />
        </View>

        {/* Dishes List Skeleton */}
        <View style={styles.dishesList}>
          {[1, 2, 3].map((key) => (
            <View key={key} style={styles.dishCard}>
              <Skeleton width={64} height={64} borderRadius={Radii.md} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Skeleton width="60%" height={16} style={{ marginBottom: 6 }} />
                <Skeleton width="85%" height={12} style={{ marginBottom: 8 }} />
                <Skeleton width="30%" height={14} />
              </View>
              <Skeleton width={64} height={32} borderRadius={Radii.sm} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.appBackground,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    scrollContent: {
      paddingBottom: 60,
    },
    visualBanner: {
      height: 180,
      width: '100%',
      position: 'relative',
    },
    logoCircle: {
      position: 'absolute',
      bottom: -32,
      left: Spacing.md,
      zIndex: 2,
    },
    headerCard: {
      backgroundColor: colors.card,
      paddingHorizontal: Spacing.md,
      paddingTop: 44,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: Spacing.sm,
    },
    factsCard: {
      backgroundColor: colors.card,
      marginHorizontal: Spacing.md,
      marginTop: Spacing.sm,
      padding: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    factsTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    servicesRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: 8,
    },
    dishesList: {
      paddingHorizontal: Spacing.md,
      gap: 10,
    },
    dishCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.divider,
    },
  });
