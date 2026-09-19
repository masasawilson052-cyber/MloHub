import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { Button } from '../ui/Button';

export interface PreferencesModalProps {
  visible: boolean;
  onClose: () => void;
  initialPreferences: string[];
  onSave: (preferences: string[]) => void;
}

const AVAILABLE_DIETS = [
  'Halal Only',
  'High Protein',
  'Vegetarian',
  'Low Oil / Afya',
  'Gluten-Free',
  'Less Spicy',
  'No Peanuts',
  'Swahili Specialties',
];

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  visible,
  onClose,
  initialPreferences,
  onSave,
}) => {
  const [selected, setSelected] = useState<string[]>(initialPreferences);

  if (!visible) return null;

  const toggleDiet = (diet: string) => {
    setSelected((prev) =>
      prev.includes(diet) ? prev.filter((d) => d !== diet) : [...prev, diet]
    );
  };

  const handleSave = () => {
    onSave(selected);
    onClose();
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
            <Text style={styles.title}>Dietary Preferences</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={styles.subtitle}>
              Select dietary tags to prioritize matching food recommendations in discovery:
            </Text>

            <View style={styles.chipsGrid}>
              {AVAILABLE_DIETS.map((diet) => {
                const isChecked = selected.includes(diet);
                return (
                  <TouchableOpacity
                    key={diet}
                    style={[styles.chip, isChecked && styles.chipActive]}
                    onPress={() => toggleDiet(diet)}
                    accessible={true}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                  >
                    <Ionicons
                      name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={isChecked ? Colors.white : Colors.textMuted}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.chipText, isChecked && styles.chipTextActive]}>
                      {diet}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Button
              title={`Save Preferences (${selected.length} Selected)`}
              onPress={handleSave}
              variant="primary"
              size="lg"
              fullWidth={true}
              style={styles.saveBtn}
            />
          </View>
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
  body: {
    padding: Spacing.lg,
  },
  subtitle: {
    ...Typography.Body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  chipTextActive: {
    color: Colors.white,
  },
  saveBtn: {
    marginTop: Spacing.xs,
  },
});
