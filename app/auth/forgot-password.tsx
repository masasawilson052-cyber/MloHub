import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!emailOrPhone.trim()) return;
    setSubmitted(true);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {language === 'sw' ? 'Rejesha Nenosiri' : 'Reset Password'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={[styles.content, isLargeScreen && styles.largeContent]}>
        {!submitted ? (
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="key-outline" size={28} color="#113a26" />
            </View>

            <Text style={styles.cardTitle}>
              {language === 'sw' ? 'Umesahau Nenosiri Lako?' : 'Forgot Your Password?'}
            </Text>
            <Text style={styles.cardSub}>
              {language === 'sw'
                ? 'Weka barua pepe yako au namba ya simu. Tutakutumia kiungo cha kubadilisha nenosiri.'
                : 'Enter your registered email address or phone number and we will send you password reset instructions.'}
            </Text>

            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Email or Phone Number</Text>
              <TextInput
                style={styles.input}
                value={emailOrPhone}
                onChangeText={setEmailOrPhone}
                placeholder="e.g. frank.mlaki@mlohub.tz"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.88}>
              <Text style={styles.submitBtnText}>
                {language === 'sw' ? 'Tuma Maelekezo ya Nenosiri →' : 'Send Reset Instructions →'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: '#eaf4ed' }]}>
              <Ionicons name="checkmark-circle-outline" size={32} color="#113a26" />
            </View>

            <Text style={styles.cardTitle}>
              {language === 'sw' ? 'Maelekezo Yametumwa!' : 'Instructions Sent!'}
            </Text>
            <Text style={styles.cardSub}>
              {language === 'sw'
                ? `Ikiwa akaunti inalingana na ${emailOrPhone}, tumetuma kiungo cha kurejesha nenosiri.`
                : `If an account exists for ${emailOrPhone}, a secure password reset link has been dispatched.`}
            </Text>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => router.replace('/auth/login')}
              activeOpacity={0.88}
            >
              <Text style={styles.submitBtnText}>Return to Login →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    padding: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.white,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.text,
  },
  content: {
    padding: Spacing.xl,
    flex: 1,
    justifyContent: 'center',
  },
  largeContent: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xxl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    ...Shadows.md,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    marginBottom: 4,
    textAlign: 'center',
  },
  cardSub: {
    fontSize: 12,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  fieldBox: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.text,
  },
  submitBtn: {
    width: '100%',
    backgroundColor: '#113a26',
    paddingVertical: 14,
    borderRadius: Radii.xl,
    alignItems: 'center',
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 13.5,
    fontWeight: '900',
  },
});
