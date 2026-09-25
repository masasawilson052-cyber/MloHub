import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { PlatformSettingsRepository, PlatformOperationalSettings } from '../../repositories/platformSettings.repository';
import { Button } from '../ui/Button';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface SupportModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ visible, onClose }) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const { language } = useLanguage();
  const [settings, setSettings] = useState<PlatformOperationalSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (visible) {
      setIsLoading(true);
      PlatformSettingsRepository.getOperationalSettings()
        .then((res) => {
          if (isMounted) {
            setSettings(res);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [visible]);

  if (!visible) return null;

  const phone = settings?.supportPhone || '+255 700 000 000';
  const email = settings?.supportEmail || 'support@mlohub.co.tz';
  const hours = settings?.supportHours || '07:00 AM - 11:00 PM EAT';

  const handleCall = () => {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
  };

  const handleEmail = () => {
    Linking.openURL(`mailto:${email}?subject=MloHub%20Customer%20Support`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {language === 'sw' ? 'Msaada na Huduma kwa Wateja' : 'Help & Customer Support'}
              </Text>
              <Text style={styles.subtitle}>
                {language === 'sw' ? 'Timu ya Huduma Tanzania' : 'Official Tanzania Operations Support'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Real Support Notice */}
            <View style={styles.infoBanner}>
              <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>
                  {language === 'sw' ? 'Msaada wa Moja kwa Moja' : 'Direct Customer Support Desk'}
                </Text>
                <Text style={styles.bannerText}>
                  {language === 'sw'
                    ? 'Wasiliana moja kwa moja na dawati letu la huduma kwa wateja kwa usaidizi wa haraka kuhusu oda na malipo.'
                    : 'Reach out directly to our dedicated customer operations team for prompt assistance regarding orders and payments.'}
                </Text>
              </View>
            </View>

            {isLoading ? (
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ marginTop: 8, fontSize: 13, color: colors.textSecondary }}>
                  {language === 'sw' ? 'Inapakia maelezo...' : 'Loading support details...'}
                </Text>
              </View>
            ) : (
              <>
                {/* Phone Support */}
                <View style={styles.card}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="call-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>
                      {language === 'sw' ? 'Simu ya Huduma' : 'Telephone Desk'}
                    </Text>
                    <Text style={styles.cardVal}>{phone}</Text>
                    <Text style={styles.cardSub}>{hours}</Text>
                  </View>
                  <TouchableOpacity onPress={handleCall} style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>
                      {language === 'sw' ? 'Piga' : 'Call'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Email Support */}
                <View style={styles.card}>
                  <View style={[styles.iconCircle, { backgroundColor: colors.infoSoft }]}>
                    <Ionicons name="mail-outline" size={22} color="#0369A1" />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>
                      {language === 'sw' ? 'Barua Pepe Rasmi' : 'Official Support Email'}
                    </Text>
                    <Text style={styles.cardVal}>{email}</Text>
                    <Text style={styles.cardSub}>
                      {language === 'sw' ? 'Maswali, risiti na marejesho' : 'Inquiries, billing, and receipts'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleEmail} style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>Email</Text>
                  </TouchableOpacity>
                </View>

                {/* Operating Hours & Availability */}
                <View style={styles.operatingHoursCard}>
                  <Ionicons name="time-outline" size={20} color={colors.textPrimary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.operatingHoursTitle}>
                      {language === 'sw' ? 'Saa za Huduma' : 'Support Hours'}
                    </Text>
                    <Text style={styles.operatingHoursText}>{hours}</Text>
                  </View>
                  <View style={styles.activeStatusPill}>
                    <View style={styles.activeDot} />
                    <Text style={styles.activeStatusText}>
                      {settings?.maintenanceMode
                        ? (language === 'sw' ? 'Matengenezo' : 'Maintenance')
                        : (language === 'sw' ? 'Wazi' : 'Active')}
                    </Text>
                  </View>
                </View>
              </>
            )}

            <Button
              title={language === 'sw' ? 'Funga' : 'Close'}
              onPress={onClose}
              variant="outline"
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: 12,
    marginBottom: Spacing.md,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
    marginBottom: 2,
  },
  bannerText: {
    fontSize: 12,
    color: colors.success,
    lineHeight: 18,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.appBackground,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  cardVal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginVertical: 2,
  },
  cardSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  actionBtnText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  operatingHoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  operatingHoursTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  operatingHoursText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  activeStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
});
let styles = createStyles(lightColors);
