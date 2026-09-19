import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage } from '../context/LanguageContext';
import { useMloHubDB } from '../context/DbContext';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
import { Button } from '../components/ui/Button';

export default function OnboardingScreen() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const { setOnboardingCompleted } = useMloHubDB();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 'slide1',
      icon: 'restaurant-outline' as const,
      emoji: '🍲',
      badge: 'FOOD-FIRST DISCOVERY',
      titleEn: 'Find exactly what you want to eat',
      titleSw: 'Pata chakula unachotaka kula mara moja',
      subEn: 'Search by dish name, budget, and neighborhood. Discover Chicken Biryani, Chipsi Kuku, and authentic Swahili dishes near you.',
      subSw: 'Tafuta kwa jina la chakula, bajeti, na mtaa wako. Pata Biryani ya Kuku, Chipsi, na vyakula asilia vya Dar es Salaam.',
    },
    {
      id: 'slide2',
      icon: 'git-compare-outline' as const,
      emoji: '⚖️',
      badge: 'TRANSPARENT COMPARISON',
      titleEn: 'Compare prices, distance & verified ratings',
      titleSw: 'Linganisha bei, umbali na maoni ya wateja',
      subEn: 'Compare candidate dishes side-by-side. Know exact branch prices, distance in meters, and preparation times before deciding.',
      subSw: 'Linganisha vyakula ubavu kwa ubavu. Jua bei halisi ya tawi, umbali kwa mita, na muda wa mapishi kabla ya kuchagua.',
    },
    {
      id: 'slide3',
      icon: 'shield-checkmark-outline' as const,
      emoji: '✓',
      badge: 'TRUSTED & VERIFIED MENUS',
      titleEn: 'Order with confidence from verified menus',
      titleSw: 'Agiza kwa uhakika kutoka menyu zilizothibitishwa',
      subEn: 'Menu prices and dish availability are verified directly with kitchen staff. No unexpected surprises or price changes.',
      subSw: 'Bei na upatikanaji wa vyakula vimethibitishwa moja kwa moja jikoni. Hakuna mabadiliko ya bei ya ghafla.',
    },
  ];

  const handleFinish = async () => {
    await setOnboardingCompleted(true);
    router.replace('/auth');
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const slide = slides[currentSlide];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.logoRow}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoM}>M</Text>
          </View>
          <Text style={styles.brandTitle}>MloHub</Text>
        </View>

        {/* Quick Language Toggle */}
        <TouchableOpacity
          style={styles.langPill}
          onPress={toggleLanguage}
          activeOpacity={0.8}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Switch language, currently ${language.toUpperCase()}`}
        >
          <Text style={styles.langText}>
            {language === 'sw' ? '🇹🇿 SW' : '🇬🇧 EN'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Slide Card */}
      <View style={[styles.mainCard, isLargeScreen && styles.largeScreenContainer]}>
        {/* Slide Visual Container */}
        <View style={styles.visualContainer}>
          <View style={styles.emojiCircle}>
            <Text style={styles.emojiText}>{slide.emoji}</Text>
          </View>
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>{slide.badge}</Text>
          </View>
        </View>

        {/* Slide Text Content */}
        <View style={styles.contentContainer}>
          <Text style={styles.slideTitle}>
            {language === 'sw' ? slide.titleSw : slide.titleEn}
          </Text>
          <Text style={styles.slideSub}>
            {language === 'sw' ? slide.subSw : slide.subEn}
          </Text>
        </View>

        {/* Dots Indicator */}
        <View style={styles.dotsRow}>
          {slides.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                idx === currentSlide && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          {currentSlide > 0 ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              accessible={true}
              accessibilityRole="button"
            >
              <Text style={styles.backBtnText}>
                {language === 'sw' ? 'Nyuma' : 'Back'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={handleFinish}
              accessible={true}
              accessibilityRole="button"
            >
              <Text style={styles.skipText}>
                {language === 'sw' ? 'Ruka' : 'Skip'}
              </Text>
            </TouchableOpacity>
          )}

          <Button
            title={
              currentSlide === slides.length - 1
                ? language === 'sw' ? 'Anza Kugundua' : 'Start Exploring'
                : language === 'sw' ? 'Endelea' : 'Next'
            }
            onPress={handleNext}
            variant="primary"
            size="lg"
            style={styles.nextBtn}
          />
        </View>
      </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  logoM: {
    color: Colors.white,
    fontWeight: '900',
    fontSize: 18,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  langPill: {
    backgroundColor: Colors.surfaceSecondary,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  mainCard: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  largeScreenContainer: {
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  visualContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  emojiCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.borderLight,
    ...Shadows.md,
    marginBottom: Spacing.lg,
  },
  emojiText: {
    fontSize: 54,
  },
  badgePill: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radii.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.accentDark,
    letterSpacing: 0.5,
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    lineHeight: 30,
  },
  slideSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    marginVertical: Spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  skipBtn: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  nextBtn: {
    flex: 1,
  },
});
