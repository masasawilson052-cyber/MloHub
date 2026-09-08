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

type SelectedAccountType = 'customer' | 'restaurant';

export default function AuthLandingScreen() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [selectedType, setSelectedType] = useState<SelectedAccountType>('customer');
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);

  const handleProceedRegistration = () => {
    if (selectedType === 'customer') {
      router.push('/auth/register-customer');
    } else {
      router.push('/auth/register-restaurant');
    }
  };

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
              ? 'Gundua vyakula bora vya Dar es Salaam au kukuza biashara ya mgahawa wako.'
              : 'Discover great food in Dar es Salaam or grow your restaurant business.'}
          </Text>
        </View>

        {/* ACCOUNT TYPE SELECTION SECTION */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeading}>
            {language === 'sw' ? 'Chagua Aina ya Akaunti Yako:' : 'Select How You Want to Join:'}
          </Text>
          <Text style={styles.sectionSub}>
            {language === 'sw' ? 'Bofya kadi hapa chini kuanza' : 'Tap a card below to get started'}
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          {/* 1. CUSTOMER ACCOUNT CARD */}
          <TouchableOpacity
            style={[
              styles.accountCard,
              selectedType === 'customer' && styles.accountCardActive,
            ]}
            onPress={() => setSelectedType('customer')}
            activeOpacity={0.9}
          >
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#eaf4ed' }]}>
                <Text style={styles.cardEmoji}>👤</Text>
              </View>
              <View
                style={[
                  styles.radioIndicator,
                  selectedType === 'customer' && styles.radioIndicatorActive,
                ]}
              >
                {selectedType === 'customer' && <View style={styles.radioDot} />}
              </View>
            </View>

            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.cardTitle,
                  selectedType === 'customer' && styles.cardTitleActive,
                ]}
              >
                {language === 'sw' ? 'Endelea kama Mteja (Customer)' : 'Continue as Customer'}
              </Text>
            </View>

            <Text style={styles.cardDesc}>
              {language === 'sw'
                ? 'Gundua migahawa bora, linganisha bei, hifadhi meza, na weka maagizo maalum ya chakula.'
                : 'Discover restaurants, compare prices, reserve tables, and order custom advance meals.'}
            </Text>

            <View style={styles.featuresRow}>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>🍽️ Dine & Reserve</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>⚡ Custom Meals</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>⭐️ Reviews</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* 2. RESTAURANT ACCOUNT CARD */}
          <TouchableOpacity
            style={[
              styles.accountCard,
              selectedType === 'restaurant' && styles.accountCardActive,
            ]}
            onPress={() => setSelectedType('restaurant')}
            activeOpacity={0.9}
          >
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#fef3c7' }]}>
                <Text style={styles.cardEmoji}>🏪</Text>
              </View>
              <View
                style={[
                  styles.radioIndicator,
                  selectedType === 'restaurant' && styles.radioIndicatorActive,
                ]}
              >
                {selectedType === 'restaurant' && <View style={styles.radioDot} />}
              </View>
            </View>

            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.cardTitle,
                  selectedType === 'restaurant' && styles.cardTitleActive,
                ]}
              >
                {language === 'sw' ? 'Endelea kama Mgahawa (Restaurant)' : 'Continue as Restaurant'}
              </Text>
              <View style={styles.partnerBadge}>
                <Text style={styles.partnerBadgeText}>MERCHANT</Text>
              </View>
            </View>

            <Text style={styles.cardDesc}>
              {language === 'sw'
                ? 'Orodhesha mgahawa wako, dhibiti menyu, pokea maagizo ya jikoni, na pokea malipo ya M-Pesa.'
                : 'List your kitchen, manage menus, receive reservations and advance batch orders, and get M-Pesa payouts.'}
            </Text>

            <View style={styles.featuresRow}>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>👑 Specialist Badge</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>📊 Kitchen Orders</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>💰 M-Pesa Payouts</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ACTION BUTTONS */}
        <View style={styles.actionButtonsBox}>
          {/* PRIMARY CREATE ACCOUNT CTA */}
          <TouchableOpacity
            style={styles.primaryCreateBtn}
            onPress={handleProceedRegistration}
            activeOpacity={0.88}
          >
            <Ionicons name="sparkles" size={17} color="#ffffff" />
            <Text style={styles.primaryCreateText}>
              {selectedType === 'customer'
                ? language === 'sw'
                  ? 'Fungua Akaunti ya Mteja →'
                  : 'Create Customer Account →'
                : language === 'sw'
                ? 'Sajili Mgahawa Wako →'
                : 'Register Restaurant Wizard →'}
            </Text>
          </TouchableOpacity>

          {/* SEPARATED LOG IN BUTTON */}
          <TouchableOpacity
            style={styles.secondaryLoginBtn}
            onPress={() => router.push(`/auth/login?type=${selectedType}` as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="log-in-outline" size={18} color="#113a26" />
            <Text style={styles.secondaryLoginText}>
              {selectedType === 'customer'
                ? language === 'sw' ? 'Ingia kama Mteja (Customer Log In)' : 'Log In as Customer'
                : language === 'sw' ? 'Ingia kama Mgahawa (Restaurant Log In)' : 'Log In as Restaurant Owner'}
            </Text>
          </TouchableOpacity>

          {/* GUEST PREVIEW LINK */}
          <TouchableOpacity
            style={styles.guestLinkBtn}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.7}
          >
            <Text style={styles.guestLinkText}>
              {language === 'sw' ? 'Gundua migahawa kama mgeni kwanza →' : 'Explore restaurants as guest first →'}
            </Text>
          </TouchableOpacity>
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
    lineHeight: 19,
    maxWidth: 320,
  },
  sectionHeaderWrap: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionHeading: {
    fontSize: 13.5,
    fontWeight: '900',
    color: Colors.text,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  sectionSub: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 2,
  },
  cardsContainer: {
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  accountCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xxl,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  accountCardActive: {
    borderColor: '#113a26',
    backgroundColor: '#f5faf6',
    ...Shadows.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: 22,
  },
  radioIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioIndicatorActive: {
    borderColor: '#113a26',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#113a26',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.text,
  },
  cardTitleActive: {
    color: '#113a26',
  },
  partnerBadge: {
    backgroundColor: '#113a26',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: Radii.sm,
  },
  partnerBadgeText: {
    color: '#e8c468',
    fontSize: 8.5,
    fontWeight: '900',
  },
  cardDesc: {
    fontSize: 11.5,
    color: Colors.muted,
    lineHeight: 17,
    marginBottom: 10,
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  featurePill: {
    backgroundColor: Colors.background,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radii.sm,
  },
  featurePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.text,
  },
  actionButtonsBox: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  primaryCreateBtn: {
    backgroundColor: '#113a26',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: Radii.xl,
    ...Shadows.md,
  },
  primaryCreateText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryLoginBtn: {
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radii.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  secondaryLoginText: {
    color: '#113a26',
    fontSize: 13.5,
    fontWeight: '900',
  },
  guestLinkBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  guestLinkText: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
