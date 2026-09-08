import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage } from '../context/LanguageContext';
import { useMloHubDB } from '../context/DbContext';
import { ONBOARDING_ART_BASE64 } from '../assets/onboarding/artBase64';
import { Radii, Shadows } from '../constants/theme';

const SLIDE_STATIC_IMAGES = [
  require('../assets/onboarding/slide1_art.jpg'),
  require('../assets/onboarding/slide2_art.jpg'),
  require('../assets/onboarding/slide3_art.jpg'),
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, language, toggleLanguage } = useLanguage();
  const { setOnboardingCompleted } = useMloHubDB();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [useBase64Fallback, setUseBase64Fallback] = useState(false);

  const handleFinish = async () => {
    await setOnboardingCompleted(true);
    router.replace('/auth');
  };

  const handleNext = () => {
    if (currentSlide < 2) {
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

  const getSlideTitle = () => {
    switch (currentSlide) {
      case 0:
        return t('onboardingSlide1Title');
      case 1:
        return t('onboardingSlide2Title');
      case 2:
        return t('onboardingSlide3Title');
      default:
        return '';
    }
  };

  const getSlideSub = () => {
    switch (currentSlide) {
      case 0:
        return t('onboardingSlide1Sub');
      case 1:
        return t('onboardingSlide2Sub');
      case 2:
        return t('onboardingSlide3Sub');
      default:
        return '';
    }
  };

  const getButtonText = () => {
    switch (currentSlide) {
      case 0:
        return t('onboardingGetStarted');
      case 1:
        return t('onboardingNext');
      case 2:
        return t('onboardingStartExploring');
      default:
        return t('onboardingNext');
    }
  };

  const getBase64Uri = (index: number) => {
    if (index === 0) return ONBOARDING_ART_BASE64.slide1;
    if (index === 1) return ONBOARDING_ART_BASE64.slide2;
    if (index === 2) return ONBOARDING_ART_BASE64.slide3;
    return '';
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* TOP HEADER */}
      <View style={styles.topHeader}>
        {/* Center Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoM}>M</Text>
            <View style={styles.logoPinDot} />
          </View>
          <Text style={styles.brandTitle}>MloHub</Text>
        </View>

        {/* Quick Language Toggle Pill */}
        <TouchableOpacity
          style={styles.langTogglePill}
          onPress={toggleLanguage}
          activeOpacity={0.8}
          accessibilityLabel={`Language switch: ${language.toUpperCase()}`}
        >
          <Text style={styles.langFlag}>{language === 'en' ? '🇬🇧' : '🇹🇿'}</Text>
          <Text style={styles.langText}>{language === 'en' ? 'EN' : 'SW'}</Text>
        </TouchableOpacity>
      </View>

      {/* MAIN CONTENT AREA */}
      <ScrollView
        contentContainerStyle={[
          styles.contentScroll,
          isLargeScreen && styles.largeContentScroll,
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* TITLE */}
        <Text style={styles.headingTitle}>{getSlideTitle()}</Text>

        {/* SUBTITLE */}
        <Text style={styles.headingSub}>{getSlideSub()}</Text>

        {/* ARTWORK / ILLUSTRATION CONTAINER */}
        <View style={styles.illustrationWrapper}>
          <Image
            source={
              useBase64Fallback
                ? { uri: getBase64Uri(currentSlide) }
                : SLIDE_STATIC_IMAGES[currentSlide]
            }
            style={styles.illustrationImage}
            resizeMode="cover"
            onError={() => setUseBase64Fallback(true)}
          />
        </View>
      </ScrollView>

      {/* FOOTER AREA */}
      <View style={[styles.footerArea, isLargeScreen && styles.largeFooterArea]}>
        {/* 3 PAGINATION DOTS */}
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => setCurrentSlide(idx)}
              activeOpacity={0.7}
              style={[
                styles.dot,
                currentSlide === idx && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* PRIMARY CTA BUTTON */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleNext}
          activeOpacity={0.88}
        >
          <Text style={styles.primaryBtnText}>{getButtonText()}</Text>
          <Ionicons name="arrow-forward" size={18} color="#ffffff" style={styles.arrowIcon} />
        </TouchableOpacity>

        {/* SECONDARY BOTTOM LINK */}
        <View style={styles.bottomLinkRow}>
          {currentSlide === 2 ? (
            <TouchableOpacity onPress={handleBack} activeOpacity={0.7} style={styles.bottomLinkBtn}>
              <Text style={styles.bottomLinkText}>{t('onboardingBack')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleFinish} activeOpacity={0.7} style={styles.bottomLinkBtn}>
              <Text style={styles.bottomLinkText}>{t('onboardingSkip')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#faf8f3',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    position: 'relative',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#113a26',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#c69c43',
    position: 'relative',
  },
  logoM: {
    color: '#e8c468',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  logoPinDot: {
    position: 'absolute',
    bottom: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#c69c43',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#113a26',
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    letterSpacing: -0.5,
  },
  langTogglePill: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#eaf2ec',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: '#b4d7be',
  },
  langFlag: {
    fontSize: 11,
  },
  langText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#113a26',
  },
  contentScroll: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  largeContentScroll: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  headingTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#113a26',
    textAlign: 'center',
    lineHeight: 38,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    marginBottom: 10,
  },
  headingSub: {
    fontSize: 13.5,
    color: '#55625a',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  illustrationWrapper: {
    width: '100%',
    height: 350,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    backgroundColor: '#f5f0e6',
    borderWidth: 1,
    borderColor: '#e8e2d4',
    ...Shadows.md,
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  footerArea: {
    paddingHorizontal: 24,
    paddingBottom: Platform.select({ ios: 16, default: 20 }),
    paddingTop: 4,
    backgroundColor: '#faf8f3',
    alignItems: 'center',
    gap: 16,
  },
  largeFooterArea: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#d8d4c5',
  },
  dotActive: {
    backgroundColor: '#113a26',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  primaryBtn: {
    width: '100%',
    height: 54,
    backgroundColor: '#113a26',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...Shadows.md,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' }),
  },
  arrowIcon: {
    marginTop: 1,
  },
  bottomLinkRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  bottomLinkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  bottomLinkText: {
    fontSize: 14,
    color: '#113a26',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
