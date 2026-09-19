import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageModal } from '../../components/LanguageModal';

export default function AuthLandingScreen() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [isLangModalOpen, setIsLangModalOpen] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top Header with Brand & Language Selector */}
      <View style={styles.topBar}>
        <View style={styles.logoRowSmall}>
          <Text style={styles.logoEmojiSmall}>🍲</Text>
          <Text style={styles.logoTextSmall}>
            Mlo<Text style={{ color: '#16a34a' }}>Hub</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={styles.langPill}
          onPress={() => setIsLangModalOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.langPillText}>
            {language === 'sw' ? '🇹🇿 Kiswahili' : '🇬🇧 English'}
          </Text>
          <Ionicons name="chevron-down" size={13} color={Colors.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO BRAND SECTION */}
        <View style={styles.heroSection}>
          <View style={styles.logoIconCircle}>
            <Text style={styles.heroLogoEmoji}>🍲</Text>
            <View style={styles.glowDot} />
          </View>

          <Text style={styles.welcomeTitle}>
            {language === 'sw' ? 'Karibu MloHub' : 'Welcome to MloHub'}
          </Text>
          <Text style={styles.welcomeSubtitle}>
            {language === 'sw'
              ? 'Gundua vyakula halisi kutoka kwa migahawa na jikoni bora za Dar es Salaam na Tanzania.'
              : 'Discover authentic food from local kitchens and verified restaurants in Dar es Salaam.'}
          </Text>
        </View>

        {/* VALUE HIGHLIGHTS */}
        <View style={styles.valueCardsContainer}>
          <View style={styles.valueRow}>
            <View style={[styles.valueIcon, { backgroundColor: '#eaf4ed' }]}>
              <Text style={{ fontSize: 18 }}>🍽️</Text>
            </View>
            <View style={styles.valueTextCol}>
              <Text style={styles.valueTitle}>
                {language === 'sw' ? 'Agiza Chakula & Meza' : 'Dine & Reserve'}
              </Text>
              <Text style={styles.valueDesc}>
                {language === 'sw'
                  ? 'Gundua menyu safi, weka oda ya kuchukua au kuletewa na mgahawa.'
                  : 'Browse real menus, pickup directly or get restaurant-managed delivery.'}
              </Text>
            </View>
          </View>

          <View style={styles.valueRow}>
            <View style={[styles.valueIcon, { backgroundColor: '#fef3c7' }]}>
              <Text style={{ fontSize: 18 }}>⚡</Text>
            </View>
            <View style={styles.valueTextCol}>
              <Text style={styles.valueTitle}>
                {language === 'sw' ? 'Maagizo Maalum (Custom Meals)' : 'Custom Advance Meals'}
              </Text>
              <Text style={styles.valueDesc}>
                {language === 'sw'
                  ? 'Omba mlo maalum kwa muda wako na bajeti unayotaka.'
                  : 'Request custom batch meals tailored to your schedule and diet.'}
              </Text>
            </View>
          </View>

          <View style={styles.valueRow}>
            <View style={[styles.valueIcon, { backgroundColor: '#eff6ff' }]}>
              <Text style={{ fontSize: 18 }}>🛡️</Text>
            </View>
            <View style={styles.valueTextCol}>
              <Text style={styles.valueTitle}>
                {language === 'sw' ? 'Uhakika wa Bei na Malipo' : 'Verified Pricing & Secure Checkout'}
              </Text>
              <Text style={styles.valueDesc}>
                {language === 'sw'
                  ? 'Hakuna bei feki au madereva feki. Malipo salama ya M-Pesa.'
                  : 'Zero synthetic data, true kitchen capacity, and safe M-Pesa payments.'}
              </Text>
            </View>
          </View>
        </View>

        {/* PRIMARY CUSTOMER ACTIONS */}
        <View style={styles.actionButtonsBox}>
          <TouchableOpacity
            style={styles.primaryCreateBtn}
            onPress={() => router.push('/auth/register-customer')}
            activeOpacity={0.88}
          >
            <Ionicons name="sparkles" size={18} color="#ffffff" />
            <Text style={styles.primaryCreateText}>
              {language === 'sw' ? 'Fungua Akaunti ya Mteja →' : 'Create Customer Account →'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryLoginBtn}
            onPress={() => router.push('/auth/login?type=customer')}
            activeOpacity={0.85}
          >
            <Ionicons name="log-in-outline" size={18} color="#113a26" />
            <Text style={styles.secondaryLoginText}>
              {language === 'sw' ? 'Ingia kwenye Akaunti (Sign In)' : 'Sign In as Customer'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.guestBtn}
            onPress={() => router.push('/(tabs)')}
            activeOpacity={0.8}
          >
            <Text style={styles.guestBtnText}>
              {language === 'sw' ? 'Gundua Vyakula Kwanza (Bila Kuingia) →' : 'Explore Food First (Browse as Guest) →'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* PARTNER / RESTAURANT FOOTER SECTION */}
        <View style={styles.partnerFooterCard}>
          <View style={styles.partnerIconCol}>
            <Text style={{ fontSize: 24 }}>🏪</Text>
          </View>
          <View style={styles.partnerInfoCol}>
            <Text style={styles.partnerPromptTitle}>
              {language === 'sw' ? 'Una mgahawa au jikoni?' : 'Are you a restaurant partner?'}
            </Text>
            <Text style={styles.partnerPromptDesc}>
              {language === 'sw'
                ? 'Dhibiti jikoni, menyu, na maagizo yako kupitia Portal ya Washirika.'
                : 'Manage kitchen orders, menus, branches, and M-Pesa payouts.'}
            </Text>
            <TouchableOpacity
              style={styles.partnerCtaLink}
              onPress={() => router.push('/partner' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.partnerCtaLinkText}>
                {language === 'sw' ? 'Fungua Portal ya Mgahawa →' : 'Access Partner Portal & Onboarding →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Language Selector Modal */}
      <LanguageModal
        visible={isLangModalOpen}
        currentLanguage={language}
        onSelectLanguage={(lang) => {
          setLanguage(lang);
          setIsLangModalOpen(false);
        }}
        onClose={() => setIsLangModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  logoRowSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoEmojiSmall: {
    fontSize: 22,
  },
  logoTextSmall: {
    fontSize: 17,
    fontWeight: '900',
    color: '#113a26',
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  largeScreenContent: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  logoIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#eaf4ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#badbcc',
    marginBottom: Spacing.sm,
    position: 'relative',
    ...Shadows.md,
  },
  heroLogoEmoji: {
    fontSize: 38,
  },
  glowDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e8c468',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#113a26',
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    textAlign: 'center',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.sm,
  },
  valueCardsContainer: {
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  valueIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueTextCol: {
    flex: 1,
  },
  valueTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  valueDesc: {
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 16,
  },
  actionButtonsBox: {
    gap: Spacing.sm,
  },
  primaryCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: Radii.md,
    ...Shadows.sm,
  },
  primaryCreateText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#eaf4ed',
    paddingVertical: 13,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#badbcc',
  },
  secondaryLoginText: {
    color: '#113a26',
    fontSize: 14,
    fontWeight: '700',
  },
  guestBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  guestBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  partnerFooterCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D8FD',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  partnerIconCol: {
    paddingTop: 2,
  },
  partnerInfoCol: {
    flex: 1,
  },
  partnerPromptTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#553C9A',
    marginBottom: 2,
  },
  partnerPromptDesc: {
    fontSize: 12,
    color: '#6B46C1',
    lineHeight: 16,
    marginBottom: 6,
  },
  partnerCtaLink: {
    alignSelf: 'flex-start',
  },
  partnerCtaLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#805AD5',
    textDecorationLine: 'underline',
  },
});
