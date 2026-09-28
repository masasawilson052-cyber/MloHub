import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { MenuModifierGroup, MenuModifierOption } from '../../types/domain';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface MenuModifierEditorProps {
  groups: MenuModifierGroup[];
  onChangeGroups: (groups: MenuModifierGroup[]) => void;
  language?: 'en' | 'sw';
}

export const MenuModifierEditor: React.FC<MenuModifierEditorProps> = ({
  groups,
  onChangeGroups,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  styles = createStyles(colors);

  const handleAddGroup = () => {
    const newGroup: MenuModifierGroup = {
      id: `temp_grp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      menuItemId: '',
      name: '',
      minSelections: 0,
      maxSelections: 1,
      minSelect: 0,
      maxSelect: 1,
      isRequired: false,
      sortOrder: groups.length,
      options: [
        {
          id: `temp_opt_${Date.now()}_1`,
          groupId: '',
          name: '',
          priceDeltaTzs: 0,
          isAvailable: true,
          sortOrder: 0,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };
    onChangeGroups([...groups, newGroup]);
  };

  const handleRemoveGroup = (groupIndex: number) => {
    const next = groups.filter((_, idx) => idx !== groupIndex);
    onChangeGroups(next);
  };

  const handleUpdateGroupField = <K extends keyof MenuModifierGroup>(
    groupIndex: number,
    field: K,
    value: MenuModifierGroup[K]
  ) => {
    const next = [...groups];
    const target = { ...next[groupIndex], [field]: value };
    if (field === 'isRequired' && value === true) {
      if ((target.minSelections || 0) < 1) {
        target.minSelections = 1;
        target.minSelect = 1;
      }
    }
    if (field === 'minSelections') {
      target.minSelect = Number(value);
      if (Number(value) > (target.maxSelections || 1)) {
        target.maxSelections = Number(value);
        target.maxSelect = Number(value);
      }
    }
    if (field === 'maxSelections') {
      target.maxSelect = Number(value);
    }
    next[groupIndex] = target;
    onChangeGroups(next);
  };

  const handleAddOption = (groupIndex: number) => {
    const next = [...groups];
    const group = { ...next[groupIndex] };
    const currentOptions = group.options || [];
    const newOption: MenuModifierOption = {
      id: `temp_opt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      groupId: group.id,
      name: '',
      priceDeltaTzs: 0,
      isAvailable: true,
      sortOrder: currentOptions.length,
      createdAt: new Date().toISOString(),
    };
    group.options = [...currentOptions, newOption];
    next[groupIndex] = group;
    onChangeGroups(next);
  };

  const handleRemoveOption = (groupIndex: number, optionIndex: number) => {
    const next = [...groups];
    const group = { ...next[groupIndex] };
    group.options = (group.options || []).filter((_, idx) => idx !== optionIndex);
    next[groupIndex] = group;
    onChangeGroups(next);
  };

  const handleUpdateOption = <K extends keyof MenuModifierOption>(
    groupIndex: number,
    optionIndex: number,
    field: K,
    value: MenuModifierOption[K]
  ) => {
    const next = [...groups];
    const group = { ...next[groupIndex] };
    const opts = [...(group.options || [])];
    opts[optionIndex] = { ...opts[optionIndex], [field]: value };
    group.options = opts;
    next[groupIndex] = group;
    onChangeGroups(next);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>
            {language === 'sw' ? 'Marekebisho na Chaguzi (Modifiers)' : 'Customizations & Modifiers'}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {language === 'sw'
              ? 'Weka chaguzi za ukubwa, nyongeza au viungo kwa chakula hiki.'
              : 'Add sizes, extra toppings, or choices for this dish.'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addGroupBtn}
          onPress={handleAddGroup}
          accessibilityRole="button"
          accessibilityLabel="Add Modifier Group"
        >
          <Ionicons name="add" size={16} color={colors.onPrimary} />
          <Text style={styles.addGroupBtnText}>
            {language === 'sw' ? 'Ongeza Kundi' : 'Add Group'}
          </Text>
        </TouchableOpacity>
      </View>

      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="options-outline" size={24} color={colors.textMuted} />
          <Text style={styles.emptyStateText}>
            {language === 'sw'
              ? 'Hakuna makundi ya nyongeza bado (k.m. Ukubwa, Michuzi, Vinywaji).'
              : 'No customization groups added yet (e.g. Size, Extra Cheese, Spice Level).'}
          </Text>
        </View>
      ) : (
        groups.map((group, groupIdx) => (
          <View key={group.id || groupIdx} style={styles.groupCard}>
            <View style={styles.groupHeader}>
              <View style={styles.groupHeaderLeft}>
                <Ionicons name="folder-outline" size={16} color={colors.primary} />
                <Text style={styles.groupHeading}>
                  {language === 'sw' ? `Kundi #${groupIdx + 1}` : `Modifier Group #${groupIdx + 1}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveGroup(groupIdx)}
                style={styles.deleteGroupBtn}
                accessibilityRole="button"
                accessibilityLabel="Delete Modifier Group"
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={styles.deleteGroupBtnText}>
                  {language === 'sw' ? 'Ondoa Kundi' : 'Remove Group'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Group Name & Required Toggle */}
            <View style={styles.formRow}>
              <View style={styles.inputColFlex}>
                <Text style={styles.inputLabel}>
                  {language === 'sw' ? 'Jina la Kundi (k.m. Ukubwa wa Sehemu) *' : 'Group Name (e.g. Portion Size) *'}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={group.name}
                  onChangeText={(val) => handleUpdateGroupField(groupIdx, 'name', val)}
                  placeholder={language === 'sw' ? 'k.m. Ukubwa wa Sahani' : 'e.g. Portion Size'}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.switchCol}>
                <Text style={styles.inputLabel}>
                  {language === 'sw' ? 'Lazima? (Required)' : 'Required?'}
                </Text>
                <View style={styles.switchWrapper}>
                  <Switch
                    value={Boolean(group.isRequired)}
                    onValueChange={(val) => handleUpdateGroupField(groupIdx, 'isRequired', val)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.surface}
                  />
                  <Text style={styles.switchText}>
                    {group.isRequired
                      ? language === 'sw' ? 'Lazima' : 'Required'
                      : language === 'sw' ? 'Hiari' : 'Optional'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Selection Limits */}
            <View style={styles.formRow}>
              <View style={styles.inputCol}>
                <Text style={styles.inputLabel}>
                  {language === 'sw' ? 'Uchaguzi wa Chini (Min)' : 'Min Selections'}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={String(group.minSelections ?? group.minSelect ?? 0)}
                  onChangeText={(val) => {
                    const parsed = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0;
                    handleUpdateGroupField(groupIdx, 'minSelections', parsed);
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.inputLabel}>
                  {language === 'sw' ? 'Uchaguzi wa Juu (Max)' : 'Max Selections'}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={String(group.maxSelections ?? group.maxSelect ?? 1)}
                  onChangeText={(val) => {
                    const parsed = parseInt(val.replace(/[^0-9]/g, ''), 10) || 1;
                    handleUpdateGroupField(groupIdx, 'maxSelections', parsed);
                  }}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Child Options Header */}
            <View style={styles.optionsHeaderRow}>
              <Text style={styles.optionsSubheading}>
                {language === 'sw' ? 'Chaguzi za Kundi Hili (Options)' : 'Group Options'}
              </Text>
              <TouchableOpacity
                style={styles.addOptionBtn}
                onPress={() => handleAddOption(groupIdx)}
                accessibilityRole="button"
                accessibilityLabel="Add Option to Group"
              >
                <Ionicons name="add-circle-outline" size={15} color={colors.primary} />
                <Text style={styles.addOptionBtnText}>
                  {language === 'sw' ? 'Ongeza Chaguo' : 'Add Option'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Child Options List */}
            {(group.options || []).map((opt, optIdx) => (
              <View key={opt.id || optIdx} style={styles.optionRow}>
                <View style={styles.optionNameCol}>
                  <Text style={styles.optionMiniLabel}>
                    {language === 'sw' ? 'Jina la Chaguo *' : 'Option Name *'}
                  </Text>
                  <TextInput
                    style={styles.optionTextInput}
                    value={opt.name}
                    onChangeText={(val) => handleUpdateOption(groupIdx, optIdx, 'name', val)}
                    placeholder={language === 'sw' ? 'k.m. Kubwa (Large)' : 'e.g. Large'}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.optionPriceCol}>
                  <Text style={styles.optionMiniLabel}>
                    {language === 'sw' ? 'Gharama ya Ziada (TSh)' : 'Price Delta (TSh)'}
                  </Text>
                  <TextInput
                    style={styles.optionTextInput}
                    value={String(opt.priceDeltaTzs ?? 0)}
                    onChangeText={(val) => {
                      const parsed = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0;
                      handleUpdateOption(groupIdx, optIdx, 'priceDeltaTzs', parsed);
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.optionAvailCol}>
                  <Text style={styles.optionMiniLabel}>
                    {language === 'sw' ? 'Ipo?' : 'Avail?'}
                  </Text>
                  <Switch
                    value={opt.isAvailable ?? true}
                    onValueChange={(val) => handleUpdateOption(groupIdx, optIdx, 'isAvailable', val)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={colors.surface}
                  />
                </View>

                <TouchableOpacity
                  onPress={() => handleRemoveOption(groupIdx, optIdx)}
                  style={styles.removeOptionBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Remove Option"
                >
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
      flexWrap: 'wrap',
      gap: 8,
    },
    sectionTitle: {
      ...Typography.H3,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    sectionSubtitle: {
      ...Typography.Caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    addGroupBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radii.md,
    },
    addGroupBtnText: {
      ...Typography.Caption,
      color: colors.onPrimary,
      fontWeight: '700',
    },
    emptyState: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.divider,
      borderStyle: 'dashed',
      borderRadius: Radii.md,
      padding: Spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginVertical: Spacing.xs,
    },
    emptyStateText: {
      ...Typography.Caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    groupCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    groupHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    groupHeading: {
      ...Typography.BodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    deleteGroupBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: Radii.sm,
      backgroundColor: colors.dangerSoft,
    },
    deleteGroupBtnText: {
      ...Typography.Caption,
      color: colors.danger,
      fontWeight: '600',
    },
    formRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: Spacing.sm,
      flexWrap: 'wrap',
    },
    inputColFlex: {
      flex: 1,
      minWidth: 200,
    },
    inputCol: {
      flex: 1,
      minWidth: 100,
    },
    switchCol: {
      minWidth: 120,
    },
    inputLabel: {
      ...Typography.Caption,
      color: colors.textSecondary,
      fontWeight: '600',
      marginBottom: 4,
    },
    textInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.sm,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
      color: colors.textPrimary,
    },
    switchWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 38,
    },
    switchText: {
      ...Typography.Caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    optionsHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: Spacing.xs,
      marginBottom: Spacing.xs,
      paddingTop: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    optionsSubheading: {
      ...Typography.Caption,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    addOptionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    addOptionBtnText: {
      ...Typography.Caption,
      color: colors.primary,
      fontWeight: '600',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      backgroundColor: colors.surfaceInteractive,
      padding: 8,
      borderRadius: Radii.sm,
      marginBottom: 6,
      flexWrap: 'wrap',
    },
    optionNameCol: {
      flex: 2,
      minWidth: 140,
    },
    optionPriceCol: {
      flex: 1,
      minWidth: 100,
    },
    optionAvailCol: {
      alignItems: 'center',
      minWidth: 50,
    },
    optionMiniLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      fontWeight: '600',
      marginBottom: 2,
    },
    optionTextInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.sm,
      paddingHorizontal: 8,
      paddingVertical: 6,
      fontSize: 12,
      color: colors.textPrimary,
    },
    removeOptionBtn: {
      paddingBottom: 6,
      paddingHorizontal: 4,
    },
  });

let styles = createStyles(lightColors);
