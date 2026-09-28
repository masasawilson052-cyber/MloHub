import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageModal } from '../../components/LanguageModal';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

const APP_ICON = require('../../assets/icon.png');

export default function AuthLandingScreen() {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [isLangModalOpen, setIsLangModalOpen] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="default" backgroundColor={colors.appBackground} />

      {/* Top Header with App Logo & Language Toggle */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <Image source={APP_ICON} style={styles.logoIcon} resizeMode="contain" />
          <Text style={styles.logoText}>MloHub</Text>
        </View>

        <TouchableOpacity
          style={styles.langPill}
          onPress={() => setIsLangModalOpen(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Change Language"
        >
          <Text style={styles.langFlag}>{language === 'sw' ? '🇹🇿' : '🇬🇧'}</Text>
          <Text style={styles.langPillText}>
            {language === 'sw' ? 'Kiswahili' : 'English'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Headline Section */}
        <View style={styles.heroSection}>
          <Text style={styles.welcomeTitle}>
            {language === 'sw' ? 'Karibu MloHub' : 'Welcome to MloHub'}
          </Text>
          <Text style={styles.welcomeSubtitle}>
            {language === 'sw'
              ? 'Gundua vyakula halisi kutoka jikoni za mitaani na migahawa iliyothibitishwa Dar es Salaam.'
              : 'Discover authentic food from local kitchens and verified restaurants in Dar es Salaam.'}
          </Text>
        </View>

        {/* Feature Cards Group */}
        <View style={styles.featureCard}>
          {/* Item 1: Dine & Reserve */}
          <View style={styles.featureRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.successSoft }]}>
              <Ionicons name="restaurant-outline" size={20} color="#246B39" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>
                {language === 'sw' ? 'Kula & Weka Meza' : 'Dine & Reserve'}
              </Text>
              <Text style={styles.featureSubtitle}>
                {language === 'sw'
                  ? 'Gundua menyu, weka meza mapema, au agiza chakula kiletwe kwako.'
                  : 'Browse menus, reserve tables, or order for delivery/pickup.'}
              </Text>
            </View>
          </View>

          <View style={styles.featureDivider} />

          {/* Item 2: Custom Advance Meals */}
          <View style={styles.featureRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.warningSoft }]}>
              <Ionicons name="flash-outline" size={20} color="#D97706" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>
                {language === 'sw' ? 'Mlo Maalum wa Mapema' : 'Custom Advance Meals'}
              </Text>
              <Text style={styles.featureSubtitle}>
                {language === 'sw'
                  ? 'Agiza vyakula maalum kwa hafla, ofisini au nyumbani.'
                  : 'Request special meals for events, office or home.'}
              </Text>
            </View>
          </View>

          <View style={styles.featureDivider} />

          {/* Item 3: Verified & Transparent */}
          <View style={styles.featureRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.infoSoft }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#2B6CB0" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>
                {language === 'sw' ? 'Uhakika & Uwazi' : 'Verified & Transparent'}
              </Text>
              <Text style={styles.featureSubtitle}>
                {language === 'sw'
                  ? 'Bei halisi, menyu zilizothibitishwa na malipo salama ya M-Pesa.'
                  : 'Real prices, verified menus and secure M-Pesa payments.'}
              </Text>
            </View>
          </View>
        </View>

        {/* CTA Actions Group */}
        <View style={styles.ctaGroup}>
          {/* Primary CTA: Create Customer Account */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/auth/register-customer')}
            activeOpacity={0.88}
            accessibilityRole="button"
          >
            <Ionicons name="sparkles" size={18} color={colors.onPrimary} style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>
              {language === 'sw' ? 'Fungua Akaunti ya Mteja' : 'Create Customer Account'}
            </Text>
          </TouchableOpacity>

          {/* Secondary CTA: Sign In as Customer */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Ionicons name="log-in-outline" size={18} color="#246B39" style={{ marginRight: 8 }} />
            <Text style={styles.secondaryBtnText}>
              {language === 'sw' ? 'Ingia Kama Mteja' : 'Sign In as Customer'}
            </Text>
          </TouchableOpacity>

          {/* Browse as Guest Link */}
          <TouchableOpacity
            style={styles.guestLink}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.guestLinkText}>
              {language === 'sw' ? 'Gundua Vyakula Kwanza (Kama Mgeni)' : 'Explore Food First (Browse as Guest)'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Discreet Partner Card */}
        <View style={styles.partnerCard}>
          <View style={styles.partnerRow}>
            <View style={styles.partnerIconBox}>
              <Ionicons name="storefront-outline" size={22} color="#4F46E5" />
            </View>
            <View style={styles.partnerTextCol}>
              <Text style={styles.partnerQuestion}>
                {language === 'sw' ? 'Wewe ni mwenye mgahawa au jiko?' : 'Are you a restaurant partner?'}
              </Text>
              <Text style={styles.partnerDesc}>
                {language === 'sw'
                  ? 'Jiunge na MloHub kupokea oda na kukuza mauzo yako.'
                  : 'List your kitchen and start earning.'}
              </Text>
              <TouchableOpacity
                style={styles.partnerLinkBtn}
                onPress={() => router.push('/partner')}
                activeOpacity={0.8}
              >
                <Text style={styles.partnerLinkText}>
                  {language === 'sw' ? 'Bofya Hapa Kusajili Jiko ›' : 'Partner Portal →'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Language Modal */}
      <LanguageModal
        visible={isLangModalOpen}
        currentLanguage={language}
        onSelectLanguage={setLanguage}
        onClose={() => setIsLangModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: colors.appBackground,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
    ...Shadows.sm,
  },
  langFlag: {
    fontSize: 14,
  },
  langPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    paddingTop: Spacing.md,
  },
  largeScreenContent: {
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    marginVertical: Spacing.md,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  featureCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: Spacing.md,
    ...Shadows.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 4,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  featureSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  featureDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 12,
  },
  ctaGroup: {
    marginTop: Spacing.md,
    gap: 12,
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    backgroundColor: colors.primaryCta,
    borderRadius: Radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    width: '100%',
    height: 52,
    backgroundColor: colors.successSoft,
    borderRadius: Radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.success,
  },
  secondaryBtnText: {
    color: colors.success,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  guestLink: {
    paddingVertical: 10,
  },
  guestLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
  partnerCard: {
    backgroundColor: colors.infoSoft,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.info,
    marginTop: Spacing.lg,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  partnerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceInteractive,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  partnerTextCol: {
    flex: 1,
  },
  partnerQuestion: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.info,
    marginBottom: 2,
  },
  partnerDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
  },
  partnerLinkBtn: {
    alignSelf: 'flex-start',
  },
  partnerLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.info,
  },
});
let styles = createStyles(lightColors);
