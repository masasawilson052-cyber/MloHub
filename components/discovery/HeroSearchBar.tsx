import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { SearchAutocompleteSuggestion } from '../../types/discovery';
import { DiscoveryService } from '../../services/DiscoveryService';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface HeroSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  onToggleFilters?: () => void;
  activeFilterCount?: number;
  filtersOpen?: boolean;
  onSelectSuggestion?: (suggestion: SearchAutocompleteSuggestion) => void;
  latitude?: number;
  longitude?: number;
}

export const HeroSearchBar: React.FC<HeroSearchBarProps> = ({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'What do you want to eat?',
  onToggleFilters,
  activeFilterCount = 0,
  filtersOpen = false,
  onSelectSuggestion,
  latitude,
  longitude,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [suggestions, setSuggestions] = useState<SearchAutocompleteSuggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (isFocused && value.trim().length >= 2) {
      debounceTimer.current = setTimeout(async () => {
        try {
          const list = await DiscoveryService.getLiveAutocompleteSuggestions(value, latitude, longitude);
          setSuggestions(list);
        } catch {
          const fallback = DiscoveryService.getAutocompleteSuggestions(value);
          setSuggestions(fallback);
        }
      }, 250);
    } else {
      setSuggestions([]);
    }

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [value, isFocused, latitude, longitude]);

  const handleClear = () => {
    onChangeText('');
    setSuggestions([]);
  };

  const handleSelect = (item: SearchAutocompleteSuggestion) => {
    onChangeText(item.text);
    setSuggestions([]);
    setIsFocused(false);
    if (onSelectSuggestion) {
      onSelectSuggestion(item);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, isFocused && styles.containerFocused]}>
        {/* Search Icon */}
        <Ionicons name="search" size={20} color={colors.primary} style={styles.searchIcon} />

        {/* Text Input */}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.inputPlaceholder}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          accessibilityLabel="Search food, dish or cuisine"
          autoCorrect={false}
        />

        {/* Clear Button */}
        {value.length > 0 ? (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Clear search input"
          >
            <Ionicons name="close-circle" size={18} color={colors.subtle} />
          </TouchableOpacity>
        ) : null}

        {/* Filter Toggle Button */}
        {onToggleFilters ? (
          <TouchableOpacity
            style={[styles.filterBtn, filtersOpen && styles.filterBtnActive]}
            onPress={onToggleFilters}
            accessibilityRole="button"
            accessibilityLabel="Toggle search filters"
          >
            <Ionicons
              name={filtersOpen ? 'options' : 'options-outline'}
              size={18}
              color={filtersOpen ? colors.white : colors.primaryDark}
            />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Autocomplete Suggestions Popup */}
      {isFocused && suggestions.length > 0 ? (
        <View style={styles.suggestionsCard}>
          {suggestions.map((item, idx) => (
            <TouchableOpacity
              key={`${item.text}-${idx}`}
              style={styles.suggestionRow}
              onPress={() => handleSelect(item)}
              accessibilityRole="button"
            >
              <Text style={styles.suggestionIcon}>
                {item.type === 'popular' ? '🔥' : '🍲'}
              </Text>
              <View style={styles.suggestionTextCol}>
                <Text style={styles.suggestionTitle}>{item.text}</Text>
                {item.subtext ? <Text style={styles.suggestionSub}>{item.subtext}</Text> : null}
              </View>
              <Ionicons name="arrow-forward" size={14} color={colors.subtle} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrapper: {
    width: '100%',
    position: 'relative',
    zIndex: 50,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: Spacing.md,
    height: 52,
    ...Shadows.sm,
  },
  containerFocused: {
    borderColor: colors.primary,
    ...Shadows.md,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  clearBtn: {
    padding: 4,
    marginRight: 6,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.accent,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: colors.onPrimary,
    fontSize: 9,
    fontWeight: '900',
  },
  suggestionsCard: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: 4,
    ...Shadows.md,
    zIndex: 100,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  suggestionIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  suggestionTextCol: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  suggestionSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
});
let styles = createStyles(lightColors);
