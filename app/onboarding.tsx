import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage } from '../context/LanguageContext';
import { useMloHubDB } from '../context/DbContext';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';

const SLIDE_IMAGES = [
  require('../assets/onboarding/slide1_art.jpg'),
  require('../assets/onboarding/slide2_art.jpg'),
  require('../assets/onboarding/slide3_art.jpg'),
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { setOnboardingCompleted } = useMloHubDB();
  const { width, height } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 'slide1',
      titleEn: 'Discover Amazing\nFood Near You',
      titleSw: 'Gundua Vyakula Bora\nKaribu Nawe',
      subEn: 'Explore authentic dishes from local kitchens and verified restaurants in Dar es Salaam.',
      subSw: 'Gundua vyakula halisi kutoka jikoni za mitaani na migahawa iliyothibitishwa Dar es Salaam.',
      ctaEn: 'Next',
      ctaSw: 'Endelea',
    },
    {
      id: 'slide2',
      titleEn: 'Compare Before\nYou Order',
      titleSw: 'Linganisha Kabla\nHujalipia',
      subEn: 'See real prices, distance, ratings and kitchen details — all in one place.',
      subSw: 'Tazama bei halisi, umbali, maoni ya wateja na taarifa za jikoni — zote sehemu moja.',
      ctaEn: 'Next',
      ctaSw: 'Endelea',
    },
    {
      id: 'slide3',
      titleEn: 'Good Food\nHappier Moments',
      titleSw: 'Chakula Bora\ncha Furaha',
      subEn: 'Order, reserve tables, or request custom meals — all from local kitchens you can trust.',
      subSw: 'Agiza chakula, weka meza mapema, au omba mlo maalum — kutoka jikoni unazoziamini.',
      ctaEn: 'Get Started',
      ctaSw: 'Anza Sasa',
    },
  ];

  const handleFinish = async () => {
    await setOnboardingCompleted(true);
    router.replace('/(tabs)');
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const slide = slides[currentSlide];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top Visual Area (Hero Dish Photo) */}
      <View style={[styles.visualArea, { height: height * 0.54 }]}>
        <Image
          source={SLIDE_IMAGES[currentSlide]}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <View style={styles.imageOverlay} />

        {/* Top Header Controls: Back & Skip */}
        <SafeAreaView edges={['top']} style={styles.topControls}>
          <View style={styles.topRow}>
            {currentSlide > 0 ? (
              <TouchableOpacity
                style={styles.circleNavBtn}
                onPress={() => setCurrentSlide((prev) => prev - 1)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}

            <TouchableOpacity
              style={styles.skipPill}
              onPress={handleFinish}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
            >
              <Text style={styles.skipText}>{language === 'sw' ? 'Ruka' : 'Skip'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Slide 2 Floating Preview Overlays */}
        {currentSlide === 1 && (
          <View style={styles.slide2Overlays} pointerEvents="none">
            <View style={styles.searchPillFloating}>
              <Ionicons name="search" size={14} color="#718096" />
              <Text style={styles.searchPillText}>Chicken Biryani</Text>
            </View>

            <View style={styles.bestMatchCard}>
              <Text style={styles.bestMatchEyebrow}>Best Match</Text>
              <View style={styles.bestMatchRow}>
                <Ionicons name="star" size={14} color="#D97706" />
                <Text style={styles.bestMatchValue}>4.8 (120+)</Text>
              </View>
              <View style={styles.bestMatchRow}>
                <Ionicons name="location" size={14} color="#D97706" />
                <Text style={styles.bestMatchValue}>2.3 km</Text>
              </View>
              <View style={styles.bestMatchRow}>
                <Ionicons name="pricetag" size={14} color="#D97706" />
                <Text style={styles.bestMatchValue}>TZS 12,000</Text>
              </View>
            </View>
          </View>
        )}

        {/* Slide 3 Floating Service Badges */}
        {currentSlide === 2 && (
          <View style={styles.slide3Badges} pointerEvents="none">
            <View style={styles.serviceChipWhite}>
              <Ionicons name="radio-button-on" size={14} color="#FA541C" />
              <Text style={styles.serviceChipText}>Order</Text>
            </View>
            <View style={styles.serviceChipWhite}>
              <Ionicons name="calendar-outline" size={14} color="#7C3AED" />
              <Text style={styles.serviceChipText}>Reserve</Text>
            </View>
            <View style={styles.serviceChipViolet}>
              <Ionicons name="sparkles" size={14} color="#6C5CE7" />
              <Text style={[styles.serviceChipText, { color: '#6C5CE7' }]}>Custom Meals</Text>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Content Sheet (Ivory/White with Organic Curved Header) */}
      <View style={[styles.bottomSheet, isLargeScreen && styles.largeScreenSheet]}>
        <View style={styles.sheetContent}>
          <Text style={styles.titleText}>
            {language === 'sw' ? slide.titleSw : slide.titleEn}
          </Text>

          <Text style={styles.subText}>
            {language === 'sw' ? slide.subSw : slide.subEn}
          </Text>

          {/* Dots Indicator: Active dark pill, Inactives gray dots */}
          <View style={styles.dotsRow}>
            {slides.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx === currentSlide ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {/* Primary CTA Button: Radiant Rounded Orange/Coral Pill */}
          <TouchableOpacity
            style={styles.primaryCtaBtn}
            onPress={handleNext}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={language === 'sw' ? slide.ctaSw : slide.ctaEn}
          >
            <Text style={styles.primaryCtaText}>
              {language === 'sw' ? slide.ctaSw : slide.ctaEn}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#142033',
  },
  visualArea: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
  },
  circleNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  slide2Overlays: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  searchPillFloating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radii.full,
    ...Shadows.md,
    marginBottom: 10,
    gap: 8,
  },
  searchPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#142033',
  },
  bestMatchCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    ...Shadows.lg,
    alignItems: 'flex-start',
    gap: 4,
  },
  bestMatchEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FA541C',
    marginBottom: 2,
  },
  bestMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bestMatchValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#142033',
  },
  slide3Badges: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  serviceChipWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.full,
    gap: 6,
    ...Shadows.sm,
  },
  serviceChipViolet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F0FC',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.full,
    gap: 6,
    borderWidth: 1,
    borderColor: '#D8B4FE',
    ...Shadows.sm,
  },
  serviceChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#142033',
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: Colors.warmIvory,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    justifyContent: 'space-between',
    ...Shadows.lg,
  },
  largeScreenSheet: {
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
  },
  sheetContent: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#142033',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  subText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#5A6B7C',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#142033',
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#CBD5E0',
  },
  primaryCtaBtn: {
    width: '100%',
    height: 54,
    backgroundColor: '#FA541C',
    borderRadius: Radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
