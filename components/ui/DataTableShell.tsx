import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface DataTableColumn {
  key: string;
  label: string;
  flex?: number;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableShellProps {
  title?: string;
  subtitle?: string;
  columns?: DataTableColumn[];
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  emptyState?: React.ReactNode;
  isEmpty?: boolean;
  style?: StyleProp<ViewStyle>;
  minWidth?: number;
}

export const DataTableShell: React.FC<DataTableShellProps> = ({
  title,
  subtitle,
  columns,
  children,
  headerRight,
  emptyState,
  isEmpty = false,
  style,
  minWidth,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {(title || subtitle || headerRight) && (
        <View
          style={[
            styles.topBar,
            {
              borderBottomColor: colors.divider,
              backgroundColor: colors.surfaceRaised,
            },
          ]}
        >
          <View style={styles.titleCol}>
            {title && (
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {subtitle}
              </Text>
            )}
          </View>
          {headerRight && <View style={styles.headerRight}>{headerRight}</View>}
        </View>
      )}

      {isEmpty && emptyState ? (
        <View style={styles.emptyWrap}>{emptyState}</View>
      ) : (
        <ScrollView
          horizontal={Boolean(minWidth)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={minWidth ? { minWidth, flexGrow: 1 } : undefined}
        >
          <View style={styles.tableBody}>
            {columns && columns.length > 0 && (
              <View
                style={[
                  styles.columnHeaderRow,
                  {
                    backgroundColor: colors.surfaceInteractive,
                    borderBottomColor: colors.divider,
                  },
                ]}
              >
                {columns.map((col) => (
                  <View
                    key={col.key}
                    style={[
                      col.width ? { width: col.width } : { flex: col.flex ?? 1 },
                      col.align === 'right' && { alignItems: 'flex-end' },
                      col.align === 'center' && { alignItems: 'center' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.columnHeaderText,
                        { color: colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {col.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {children}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export interface FilterToolbarProps {
  searchValue?: string;
  onSearchChange?: (text: string) => void;
  searchPlaceholder?: string;
  filters?: {
    key: string;
    label: string;
    count?: number;
  }[];
  activeFilter?: string;
  onSelectFilter?: (key: string) => void;
  onRefresh?: () => void;
  rightActions?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filters,
  activeFilter,
  onSelectFilter,
  onRefresh,
  rightActions,
  style,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  return (
    <View style={[styles.toolbar, style]}>
      {onSearchChange && (
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
            },
          ]}
        >
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            value={searchValue || ''}
            onChangeText={onSearchChange}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.inputPlaceholder}
          />
          {Boolean(searchValue) && (
            <TouchableOpacity onPress={() => onSearchChange('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {filters && filters.length > 0 && onSelectFilter && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
        >
          {filters.map((f) => {
            const active = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active
                      ? colors.primarySoft
                      : colors.surfaceInteractive,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => onSelectFilter(f.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterPillLabel,
                    {
                      color: active ? colors.primary : colors.textSecondary,
                      fontWeight: active ? '700' : '600',
                    },
                  ]}
                >
                  {f.label}
                  {typeof f.count === 'number' ? ` (${f.count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.toolbarRight}>
        {rightActions}
        {onRefresh && (
          <TouchableOpacity
            style={[
              styles.refreshBtn,
              {
                backgroundColor: colors.surfaceInteractive,
                borderColor: colors.border,
              },
            ]}
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel="Refresh table"
          >
            <Ionicons name="refresh-outline" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
    flexWrap: 'wrap',
  },
  titleCol: {
    flex: 1,
    minWidth: 180,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableBody: {
    flex: 1,
    width: '100%',
  },
  columnHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  columnHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyWrap: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
    minWidth: 220,
    flex: 1,
    maxWidth: 340,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  filterPillLabel: {
    fontSize: 12,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
let styles = createStyles(lightColors);
