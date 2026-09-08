import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { DAR_LOCATIONS } from '../constants/data';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

interface LocationModalProps {
  visible: boolean;
  selectedLocation: string;
  onSelect: (location: string) => void;
  onClose: () => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  visible,
  selectedLocation,
  onSelect,
  onClose,
}) => {
  const { t } = useLanguage();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{t('selectAreaTitle')}</Text>
              <Text style={styles.subtitle}>{t('selectAreaSub')}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list}>
            {DAR_LOCATIONS.map((locItem) => {
              const locName = typeof locItem === 'string' ? locItem : locItem.name;
              const isSelected = selectedLocation === locName;
              return (
                <TouchableOpacity
                  key={typeof locItem === 'string' ? locItem : locItem.id}
                  style={[styles.item, isSelected && styles.itemSelected]}
                  onPress={() => {
                    onSelect(locName);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                    📍 {locName}
                  </Text>
                  {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalBox: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xxl,
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    fontSize: 18,
    color: Colors.muted,
    fontWeight: '700',
  },
  list: {
    marginTop: Spacing.xs,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.lg,
    marginBottom: Spacing.xs,
  },
  itemSelected: {
    backgroundColor: Colors.primaryMuted,
  },
  itemText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  itemTextSelected: {
    color: Colors.primaryDark,
    fontWeight: '900',
  },
  checkIcon: {
    fontSize: 16,
    color: Colors.primaryDark,
    fontWeight: '900',
  },
});
