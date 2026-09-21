import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useNotifications } from '../../context/NotificationContext';
import { useLanguage } from '../../context/LanguageContext';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { preferences, updatePreference } = useNotifications();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [savedToast, setSavedToast] = useState(false);

  const handleToggle = async (key: any, val: boolean) => {
    try {
      await updatePreference(key, val);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } catch (err) {
      console.warn('[NotificationSettings] handleToggle error:', err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.headerTitle}>{t('notifSettingsTitle')}</Text>
          <Text style={styles.headerSub}>{t('notifSettingsSub')}</Text>
        </View>
      </View>

      {/* Toast */}
      {savedToast && (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>
            {language === 'sw' ? '✓ Mipangilio imesasishwa kiotomatiki' : '✓ Preferences saved automatically'}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: RESERVATIONS */}
        <Text style={styles.sectionHeader}>
          {language === 'sw' ? 'Nafasi za Meza' : 'Table Reservations'}
        </Text>
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>
                {language === 'sw' ? 'Uthibitisho wa Nafasi ya Meza' : 'Reservation Confirmations'}
              </Text>
              <Text style={styles.settingSub}>
                {language === 'sw'
                  ? 'Pokea ujumbe wakati mgahawa unakubali au kubadili meza yako'
                  : 'Get notified when restaurants accept or modify your reservation'}
              </Text>
            </View>
            <Switch
              value={preferences.reservationUpdates}
              onValueChange={(val) => handleToggle('reservationUpdates', val)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>
                {language === 'sw' ? 'Kumbusho la Saa 1 Kabla' : '1-Hour Arrival Reminders'}
              </Text>
              <Text style={styles.settingSub}>
                {language === 'sw'
                  ? 'Kumbusho na maelekezo ya kufika kabla ya muda wa meza'
                  : 'Helpful reminder and directions before your scheduled dining time'}
              </Text>
            </View>
            <Switch
              value={preferences.reservationReminders}
              onValueChange={(val) => handleToggle('reservationReminders', val)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* SECTION 2: CUSTOM MEALS */}
        <Text style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          {language === 'sw' ? 'Milo na Maagizo Maalum' : 'Custom Meal Requests'}
        </Text>
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>
                {language === 'sw' ? 'Ofa za Wapishi & Uandaaji Jikoni' : 'Chef Quotes & Kitchen Updates'}
              </Text>
              <Text style={styles.settingSub}>
                {language === 'sw'
                  ? 'Pata taarifa pindi mpishi anapokubali ombi lako au kuanza kupika'
                  : 'Receive real-time alerts when chefs bid, accept, or begin cooking'}
              </Text>
            </View>
            <Switch
              value={preferences.customMealUpdates}
              onValueChange={(val) => handleToggle('customMealUpdates', val)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* SECTION 3: PAYMENTS & RECEIPTS */}
        <Text style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          {language === 'sw' ? 'Malipo na Risiti' : 'Payments & Invoices'}
        </Text>
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <View style={styles.lockedRow}>
                <Text style={styles.settingLabel}>
                  {language === 'sw' ? 'Risiti za Malipo ya M-Pesa & Kadi' : 'Payment Confirmations & Receipts'}
                </Text>
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredText}>REQUIRED</Text>
                </View>
              </View>
              <Text style={styles.settingSub}>
                {language === 'sw'
                  ? 'Taarifa muhimu za usalama wa akaunti na kumbukumbu za kisheria'
                  : 'Essential transaction records and verified receipts for your account safety'}
              </Text>
            </View>
            <Switch
              value={true}
              disabled
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* SECTION 4: RATINGS & REVIEWS */}
        <Text style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          {language === 'sw' ? 'Tathmini na Maoni' : 'Feedback & Reviews'}
        </Text>
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>
                {language === 'sw' ? 'Kumbusho la Kutathmini Mgahawa' : 'Rate Your Dining Experience'}
              </Text>
              <Text style={styles.settingSub}>
                {language === 'sw'
                  ? 'Kumbusho fupi baada ya kula kusaidia walaji wengine Dar es Salaam'
                  : 'Short prompt after dining to help other local food lovers in Dar'}
              </Text>
            </View>
            <Switch
              value={preferences.ratingReminders}
              onValueChange={(val) => handleToggle('ratingReminders', val)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* SECTION 5: OFFERS & RECOMMENDATIONS */}
        <Text style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          {language === 'sw' ? 'Ofa na Punguzo' : 'Offers & Recommendations'}
        </Text>
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>
                {language === 'sw' ? 'Punguzo la Bei na Ofa za Siku' : 'Discounts & Daily Promotions'}
              </Text>
              <Text style={styles.settingSub}>
                {language === 'sw'
                  ? 'Pokea ofa za vyakula vya bei nafuu kutoka migahawa unayoipenda'
                  : 'Exclusive deals, meal vouchers, and discounts from top restaurants'}
              </Text>
            </View>
            <Switch
              value={preferences.offersPromotions}
              onValueChange={(val) => handleToggle('offersPromotions', val)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>
                {language === 'sw' ? 'Migahawa Mipya ya Karibu' : 'Nearby Restaurant Suggestions'}
              </Text>
              <Text style={styles.settingSub}>
                {language === 'sw'
                  ? 'Mapendekezo ya maeneo mapya yaliyothibitishwa ndani ya mtaa wako'
                  : 'Discover verified dining spots in your neighborhood as new branches go live'}
              </Text>
            </View>
            <Switch
              value={preferences.nearbySuggestions}
              onValueChange={(val) => handleToggle('nearbySuggestions', val)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* SECTION 6: CHANNELS */}
        <Text style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          {language === 'sw' ? 'Njia za Ujumbe' : 'Delivery Channels'}
        </Text>
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>
                {language === 'sw' ? 'Taarifa za Skrini (Push Notifications)' : 'Push Notifications'}
              </Text>
              <Text style={styles.settingSub}>
                {language === 'sw'
                  ? 'Pata taarifa moja kwa moja kwenye simu yako hata app ikiwa imefungwa'
                  : 'Instant alerts on your device lock screen even when app is closed'}
              </Text>
            </View>
            <Switch
              value={preferences.pushEnabled}
              onValueChange={(val) => handleToggle('pushEnabled', val)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>
                {language === 'sw' ? 'Ujumbe wa SMS & WhatsApp' : 'SMS & WhatsApp Booking Alerts'}
              </Text>
              <Text style={styles.settingSub}>
                {language === 'sw'
                  ? 'Taarifa za meza kwa nambari yako ya simu ya Tanzania (+255)'
                  : 'Table confirmations and alerts to your local Tanzanian number'}
              </Text>
            </View>
            <Switch
              value={preferences.smsEnabled}
              onValueChange={(val) => handleToggle('smsEnabled', val)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  titleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  headerSub: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 1,
  },
  toastBanner: {
    backgroundColor: Colors.primaryDark,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
  },
  toastText: {
    color: Colors.lime,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 50,
  },
  largeScreenContainer: {
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primaryLight,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  groupCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.md,
  },
  settingTextWrap: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  settingSub: {
    fontSize: 11,
    color: Colors.muted,
    lineHeight: 15,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  requiredBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: Radii.sm,
  },
  requiredText: {
    fontSize: 8,
    fontWeight: '900',
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
});
