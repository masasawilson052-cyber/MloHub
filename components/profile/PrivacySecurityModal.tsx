import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../ui/Button';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface PrivacySecurityModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PrivacySecurityModal: React.FC<PrivacySecurityModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const { language } = useLanguage();
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {language === 'sw' ? 'Faragha na Usalama wa Data' : 'Privacy & Security Truth'}
              </Text>
              <Text style={styles.subtitle}>
                {language === 'sw' ? 'Ahadi zetu kwa data za wateja' : 'Our customer data commitments'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.item}>
              <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
              <View style={styles.itemTextCol}>
                <Text style={styles.itemTitle}>
                  {language === 'sw' ? 'Hakuna Ufuatiliaji wa GPS Kisiri' : 'Zero Background GPS Tracking'}
                </Text>
                <Text style={styles.itemDesc}>
                  {language === 'sw'
                    ? 'MloHub haifuatii eneo lako kisiri wala kuuza kuratibu (coordinates) zako kwa watangazaji. Eneo linatumika tu unapotafuta vyakula au kukokotoa umbali wa usafirishaji.'
                    : 'MloHub never continuously tracks your location in the background or sells your coordinates to advertisers. Location is only used on-demand when calculating restaurant delivery distances.'}
                </Text>
              </View>
            </View>

            <View style={styles.item}>
              <Ionicons name="card-outline" size={24} color={colors.primary} />
              <View style={styles.itemTextCol}>
                <Text style={styles.itemTitle}>
                  {language === 'sw' ? 'Ulinzi wa Malipo ya Simu' : 'Authoritative Payment Protection'}
                </Text>
                <Text style={styles.itemDesc}>
                  {language === 'sw'
                    ? 'Miamala ya mitandao ya simu (Vodacom M-Pesa, Airtel Money, Mixx by Yas, HaloPesa) inathibitishwa kupitia mfumo salama wa ClickPesa. Hatuhifadhi kamwe namba za siri (PIN).'
                    : 'Mobile money (Vodacom M-Pesa, Airtel Money, Mixx by Yas, HaloPesa) transactions are verified authoritatively through ClickPesa. We never store mobile money PINs or debit card security codes.'}
                </Text>
              </View>
            </View>

            <View style={styles.item}>
              <Ionicons name="receipt-outline" size={24} color={colors.primary} />
              <View style={styles.itemTextCol}>
                <Text style={styles.itemTitle}>
                  {language === 'sw' ? 'Kumbukumbu Zisizobadilika' : 'Immutable Audit Trails'}
                </Text>
                <Text style={styles.itemDesc}>
                  {language === 'sw'
                    ? 'Mabadiliko yote ya hali ya oda na miamala ya malipo yanarekodiwa kwa kudumu kwenye hifadhidata ya PostgreSQL yenye sera kali za usalama (RLS).'
                    : 'All order status transitions and payments are permanently recorded in PostgreSQL with strict Row Level Security (RLS) enforcement.'}
                </Text>
              </View>
            </View>

            <View style={styles.item}>
              <Ionicons name="shield-outline" size={24} color={colors.primary} />
              <View style={styles.itemTextCol}>
                <Text style={styles.itemTitle}>
                  {language === 'sw' ? 'Sheria ya Data ya Tanzania (PDPA 2022)' : 'Tanzania Data Sovereignty'}
                </Text>
                <Text style={styles.itemDesc}>
                  {language === 'sw'
                    ? 'Inaendeshwa kwa ukamilifu kulingana na Sheria ya Ulinzi wa Taarifa Binafsi ya Tanzania (PDPA 2022). Unaweza kuomba taarifa zako zifutwe wakati wowote.'
                    : 'Operated in strict compliance with the Tanzania Personal Data Protection Act (PDPA), 2022. You can request complete export or deletion of your profile data anytime.'}
                </Text>
              </View>
            </View>

            <Button
              title={language === 'sw' ? 'Nimeelewa' : 'Understood'}
              onPress={onClose}
              variant="primary"
              size="md"
              fullWidth={true}
              style={{ marginTop: Spacing.md }}
            />
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
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.appBackground,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  itemTextCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
});
let styles = createStyles(lightColors);
