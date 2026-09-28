import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { ApplicationRepository } from '../../repositories/applications.repository';
import { PlatformSettingsRepository } from '../../repositories/platformSettings.repository';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';
import {
  pickVerificationDocument,
  uploadVerificationDocument,
  recordVerificationDocument,
} from '../../services/MerchantVerificationService';
import { VerificationDocumentType } from '../../types/domain';

let colors: ThemeColors = lightColors;

const DRAFT_KEY = 'mlohub.restaurant-application-draft.v2';

type StepNumber = 1 | 2 | 3 | 4 | 5;

interface StagedDoc {
  id: string;
  documentType: VerificationDocumentType;
  uri: string;
  mimeType: string;
  fileName: string;
}

export default function RegisterRestaurantScreen() {
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);
  const router = useRouter();
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const { user: authUser, signUpCustomer, login } = useAuth();

  const isCurrentUserAdmin =
    authUser?.role === 'ADMIN' ||
    authUser?.role === 'SUPER_ADMIN' ||
    authUser?.accountType === 'ADMIN';

  // Wizard state
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);

  // Step 1: Account Fields
  const [ownerFullName, setOwnerFullName] = useState(!isCurrentUserAdmin ? authUser?.fullName || '' : '');
  const [ownerPhone, setOwnerPhone] = useState(!isCurrentUserAdmin && authUser?.phone ? authUser.phone : '+255 ');
  const [ownerEmail, setOwnerEmail] = useState(!isCurrentUserAdmin ? authUser?.email || '' : '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: Business Details
  const [businessName, setBusinessName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [businessType, setBusinessType] = useState('RESTAURANT');

  // Step 3: Location Details
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Step 4: Verification Details
  const [hasTinOrLicense, setHasTinOrLicense] = useState(false);
  const [tinNumber, setTinNumber] = useState('');
  const [selectedDocType, setSelectedDocType] = useState<VerificationDocumentType>('BUSINESS_LICENSE');
  const [stagedDocs, setStagedDocs] = useState<StagedDoc[]>([]);
  const [isPickingDoc, setIsPickingDoc] = useState(false);

  // Step 5: Terms Agreement
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Restore draft on mount
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY)
      .then((raw) => {
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (Date.now() - draft.savedAt > 24 * 3600 * 1000) {
          AsyncStorage.removeItem(DRAFT_KEY);
          return;
        }
        if (draft.businessName) setBusinessName(draft.businessName);
        if (draft.ownerFullName && !authUser?.fullName) setOwnerFullName(draft.ownerFullName);
        if (draft.ownerPhone && !authUser?.phone) setOwnerPhone(draft.ownerPhone);
        if (draft.ownerEmail && !authUser?.email) setOwnerEmail(draft.ownerEmail);
        if (draft.cuisine) setCuisine(draft.cuisine);
        if (draft.businessType) setBusinessType(draft.businessType);
        if (draft.neighborhood) setNeighborhood(draft.neighborhood);
        if (draft.address) setAddress(draft.address);
        if (draft.hasTinOrLicense !== undefined) setHasTinOrLicense(draft.hasTinOrLicense);
        if (draft.tinNumber) setTinNumber(draft.tinNumber);
        if (draft.notes) setNotes(draft.notes);
        if (draft.currentStep && draft.currentStep >= 1 && draft.currentStep <= 5) {
          setCurrentStep(draft.currentStep);
        }
      })
      .catch(() => {});
  }, [authUser]);

  // Save draft helper
  const saveDraft = async (stepOverride?: StepNumber) => {
    try {
      const draft = {
        businessName,
        ownerFullName,
        ownerPhone,
        ownerEmail: ownerEmail.trim().toLowerCase(),
        cuisine,
        businessType,
        neighborhood,
        address,
        hasTinOrLicense,
        tinNumber,
        notes,
        currentStep: stepOverride || currentStep,
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  };

  // Password Policy Checks (min 10 chars, uppercase, lowercase, number, special char)
  const passwordChecks = {
    hasMinLength: password.length >= 10,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[^A-Za-z0-9]/.test(password),
    matchesConfirm: password.length > 0 && password === confirmPassword,
  };

  const isPasswordValid =
    passwordChecks.hasMinLength &&
    passwordChecks.hasUppercase &&
    passwordChecks.hasLowercase &&
    passwordChecks.hasNumber &&
    passwordChecks.hasSpecialChar &&
    passwordChecks.matchesConfirm;

  const cuisinePresets = [
    { id: 'Swahili', label: '🥘 Traditional Swahili' },
    { id: 'Biryani', label: '🍚 Biryani & Pilau' },
    { id: 'Mchemsho', label: '🥣 Mchemsho & Soups' },
    { id: 'Nyama Choma', label: '🥩 Nyama Choma Grill' },
    { id: 'Breakfast', label: '☕ Breakfast & Tea Spot' },
    { id: 'Healthy', label: '🥗 Healthy & Veg' },
    { id: 'Fast Food', label: '🍔 Chips & Fast Food' },
    { id: 'Bakery', label: '🥐 Bakery & Pastries' },
  ];

  const docTypeOptions: { type: VerificationDocumentType; label: string; desc: string }[] = [
    {
      type: 'BUSINESS_LICENSE',
      label: language === 'sw' ? 'Leseni ya Biashara (BRELA / Halmashauri)' : 'Business License (BRELA / City Council)',
      desc: language === 'sw' ? 'Hati halali ya usajili wa biashara' : 'Official municipal or trade license',
    },
    {
      type: 'TIN_DOCUMENT',
      label: language === 'sw' ? 'Cheti cha Namba ya TIN (TRA)' : 'TIN Certificate (TRA Tax Clearance)',
      desc: language === 'sw' ? 'Cheti cha namba ya mlipakodi kutoka TRA' : 'TRA Taxpayer Identification Certificate',
    },
    {
      type: 'FOOD_OPERATION_DOCUMENT',
      label: language === 'sw' ? 'Cheti cha Afya na Usafi wa Chakula' : 'Food Hygiene & Health Permit',
      desc: language === 'sw' ? 'Hati ya ukaguzi wa afya ya jikoni/mpishi' : 'Certified municipal food handler clearance',
    },
    {
      type: 'OWNER_IDENTITY',
      label: language === 'sw' ? 'Kitambulisho cha NIDA cha Mmiliki' : 'Owner National ID (NIDA / Passport)',
      desc: language === 'sw' ? 'Uthibitisho wa utambulisho wa kisheria' : 'Government-issued identification',
    },
    {
      type: 'STOREFRONT_PROOF',
      label: language === 'sw' ? 'Picha ya Sehemu ya Biashara / Kibao' : 'Storefront or Premises Photo',
      desc: language === 'sw' ? 'Picha inayoonyesha jengo au bango la mgahawa' : 'Photo of physical shop entrance or signboard',
    },
    {
      type: 'OTHER',
      label: language === 'sw' ? 'Nyaraka Nyingine ya Uthibitisho' : 'Other Supporting Verification Document',
      desc: language === 'sw' ? 'Hati nyingine yoyote ya ziada' : 'Lease agreement, utility bill, or bank proof',
    },
  ];

  // Validation per step
  const validateStep = (step: StepNumber): boolean => {
    const errs: { [key: string]: string } = {};

    if (step === 1) {
      if (!ownerFullName.trim()) errs.ownerFullName = 'Owner full name is required';
      if (!ownerPhone.trim() || ownerPhone.trim().length < 9) {
        errs.ownerPhone = 'Valid phone number is required (+255...)';
      }
      if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
        errs.ownerEmail = 'Valid login email address is required';
      }
      if (!isPasswordValid) {
        if (!passwordChecks.hasMinLength) {
          errs.password = 'Password must be at least 10 characters long';
        } else if (!passwordChecks.hasUppercase || !passwordChecks.hasLowercase) {
          errs.password = 'Password must contain uppercase and lowercase letters';
        } else if (!passwordChecks.hasNumber) {
          errs.password = 'Password must contain at least one digit';
        } else if (!passwordChecks.hasSpecialChar) {
          errs.password = 'Password must contain at least one special symbol';
        } else if (!passwordChecks.matchesConfirm) {
          errs.confirmPassword = 'Passwords do not match';
        }
      }
    }

    if (step === 2) {
      if (!businessName.trim()) errs.businessName = 'Business or stall name is required';
      if (!cuisine.trim()) errs.cuisine = 'Please select a cuisine specialty';
    }

    if (step === 3) {
      if (!neighborhood.trim()) errs.neighborhood = 'Neighborhood is required';
      if (!address.trim()) errs.address = 'Physical operating address or landmark is required';
    }

    if (step === 4) {
      if (hasTinOrLicense && !tinNumber.trim()) {
        errs.tinNumber = 'Please enter your TIN number or uncheck verified tier';
      }
    }

    if (step === 5) {
      if (!agreedToTerms) {
        errs.terms = language === 'sw'
          ? 'Tafadhali ukubali vigezo na masharti ya MloHub kuendelea'
          : 'Please accept MloHub terms and food safety declaration to proceed';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setErrors({});
      const nextStep = (currentStep + 1) as StepNumber;
      setCurrentStep(nextStep);
      saveDraft(nextStep);
    }
  };

  const handleBack = () => {
    setErrors({});
    if (currentStep > 1) {
      const prevStep = (currentStep - 1) as StepNumber;
      setCurrentStep(prevStep);
      saveDraft(prevStep);
    } else {
      router.back();
    }
  };

  // Document Picking
  const handlePickDocument = async () => {
    setIsPickingDoc(true);
    setErrors({});
    try {
      const result = await pickVerificationDocument();
      if (result) {
        const newDoc: StagedDoc = {
          id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          documentType: selectedDocType,
          uri: result.uri,
          mimeType: result.mimeType,
          fileName: result.fileName || `${selectedDocType.toLowerCase()}.jpg`,
        };
        setStagedDocs((prev) => [...prev, newDoc]);
        setHasTinOrLicense(true);
      }
    } catch (err: any) {
      setErrors({ doc: err?.message || 'Failed to select document file.' });
    } finally {
      setIsPickingDoc(false);
    }
  };

  const handleRemoveStagedDoc = (docId: string) => {
    setStagedDocs((prev) => prev.filter((d) => d.id !== docId));
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (!validateStep(5)) return;
    setIsSubmitting(true);
    setErrors({});

    try {
      const opSettings = await PlatformSettingsRepository.getOperationalSettings();
      if (opSettings.maintenanceMode) {
        setErrors({ form: 'The platform is currently under maintenance. Please try again later.' });
        setIsSubmitting(false);
        return;
      }
      if (!opSettings.restaurantApplicationsEnabled) {
        setErrors({ form: 'Vendor applications are temporarily paused by platform administration.' });
        setIsSubmitting(false);
        return;
      }

      const cleanEmail = ownerEmail.trim().toLowerCase();
      let currentUserId = authUser?.id;

      // Ensure merchant user account in Supabase Auth
      if (!currentUserId && isSupabaseConfigured()) {
        try {
          const signupRes = await signUpCustomer({
            email: cleanEmail,
            password,
            fullName: ownerFullName.trim(),
            phone: ownerPhone.trim(),
            location: neighborhood.trim(),
          });
          if (signupRes?.session?.user?.id) {
            currentUserId = signupRes.session.user.id;
          }
        } catch (signupErr: any) {
          const errMsg = (signupErr?.message || '').toLowerCase();
          if (
            errMsg.includes('already registered') ||
            errMsg.includes('already exists') ||
            errMsg.includes('unique constraint') ||
            errMsg.includes('profiles_email_key') ||
            errMsg.includes('tayari ipo')
          ) {
            try {
              const loginRes = await login({ emailOrPhone: cleanEmail, password });
              if (loginRes?.user?.id) {
                currentUserId = loginRes.user.id;
              }
            } catch (loginErr: any) {
              console.warn('[RegisterRestaurant] Existing account login warning:', loginErr?.message);
            }
          }
        }
      }

      // Submit application record
      const app = await ApplicationRepository.submit({
        applicantUserId: currentUserId,
        businessName: businessName.trim(),
        ownerName: ownerFullName.trim(),
        ownerPhone: ownerPhone.trim(),
        ownerEmail: cleanEmail,
        cuisineType: cuisine.trim(),
        neighborhood: neighborhood.trim(),
        address: address.trim(),
        hasTinOrLicense: hasTinOrLicense || stagedDocs.length > 0,
        tinNumber: tinNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setApplicationId(app.id);

      // Upload and record staged verification documents
      if (stagedDocs.length > 0 && currentUserId) {
        for (const doc of stagedDocs) {
          try {
            const uploadRes = await uploadVerificationDocument({
              userId: currentUserId,
              applicationId: app.id,
              documentType: doc.documentType,
              uri: doc.uri,
              mimeType: doc.mimeType,
            });

            await recordVerificationDocument({
              applicationId: app.id,
              ownerUserId: currentUserId,
              documentType: doc.documentType,
              storagePath: uploadRes.path,
            });
          } catch (docErr: any) {
            console.warn(`[RegisterRestaurant] Failed to upload ${doc.documentType}:`, docErr?.message);
          }
        }
      }

      await AsyncStorage.removeItem(DRAFT_KEY);
      setIsSubmitted(true);
    } catch (err: any) {
      console.error('[RegisterRestaurant] Submission error:', err);
      setErrors({ form: err?.message || 'Failed to submit application. Please check your network and try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS SCREEN (Gate A Submission Confirmation)
  if (isSubmitted) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.successContainer}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color="#1d6637" />
            </View>

            <View style={styles.gateABadge}>
              <Ionicons name="shield-checkmark" size={14} color="#1d6637" />
              <Text style={styles.gateABadgeText}>
                {language === 'sw' ? 'HATUA YA 1 (GATE A) • INAKAGULIWA NA ADMIN' : 'GATE A • SUBMITTED FOR MERCHANT REVIEW'}
              </Text>
            </View>

            <Text style={styles.successTitle}>
              {language === 'sw' ? 'Ombi Lako Limetumwa Kikamilifu!' : 'Application Submitted Successfully!'}
            </Text>

            <Text style={styles.successSub}>
              {language === 'sw'
                ? `Asante ${ownerFullName}! Maombi ya "${businessName}" yametumwa kwenye mfumo rasmi wa MloHub. Utaarifiwa pindi msimamizi atakapoidhinisha usajili wako.`
                : `Thank you ${ownerFullName}! Registration details for "${businessName}" have been submitted for administrator verification.`}
            </Text>

            <View style={styles.appRefBox}>
              <Text style={styles.appRefLabel}>Application Reference ID:</Text>
              <Text style={styles.appRefCode}>{applicationId}</Text>
            </View>

            {/* Two-Gate Process Flowchart Explanation */}
            <View style={styles.processFlowBox}>
              <Text style={styles.processFlowTitle}>
                {language === 'sw' ? 'Mfumo wa Idhini Mbili (Two-Gate Process):' : 'Two-Gate Launch Process:'}
              </Text>

              <View style={styles.flowStepRow}>
                <View style={styles.flowStepNumActive}>
                  <Text style={styles.flowStepNumTextActive}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.flowStepTitleActive}>
                    {language === 'sw' ? 'Gate A: Idhini ya Mfanyabiashara (Inakaguliwa)' : 'Gate A: Merchant Approval (Current)'}
                  </Text>
                  <Text style={styles.flowStepDesc}>
                    {language === 'sw'
                      ? 'Admin anakagua taarifa za biashara na nyaraka. Baada ya kuidhinishwa, utafunguliwa Kitchen Portal ya faragha.'
                      : 'Admin verifies business identity and credentials. Once approved, you enter your private Kitchen Portal.'}
                  </Text>
                </View>
              </View>

              <View style={styles.flowStepRow}>
                <View style={styles.flowStepNumPending}>
                  <Text style={styles.flowStepNumTextPending}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.flowStepTitlePending}>
                    {language === 'sw' ? 'Gate B: Idhini ya Kuzindua Mgahawa (Store Launch)' : 'Gate B: Store Launch Review'}
                  </Text>
                  <Text style={styles.flowStepDesc}>
                    {language === 'sw'
                      ? 'Utasanidi tawi, menyu yenye bei, na masaa ya kazi. Kisha utatuma ukaguzi wa kuzindua ili mgahawa uonekane mtandaoni.'
                      : 'You configure branches, menu items with pricing, and hours. Then submit for final live publication review.'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.credentialsCard}>
              <View style={styles.credentialsHeader}>
                <Ionicons name="key-outline" size={16} color="#0f766e" />
                <Text style={styles.credentialsTitle}>
                  {language === 'sw' ? 'Akaunti Yako ya Kuingia' : 'Your Login Account'}
                </Text>
              </View>
              <Text style={styles.credentialsItem}>
                <Text style={{ fontWeight: '700' }}>Email: </Text>
                {ownerEmail.trim().toLowerCase()}
              </Text>
              <Text style={styles.credentialsNote}>
                {language === 'sw'
                  ? 'Tumia barua pepe na nenosiri uliloweka sasa hivi kuingia kwenye Ukurasa wa Mgahawa kuona maendeleo ya ombi lako.'
                  : 'Use this email and your password to sign in at Restaurant Login anytime to check your review status.'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.returnBtn}
              onPress={() => router.replace('/auth/login?type=restaurant')}
              activeOpacity={0.88}
            >
              <Text style={styles.returnBtnText}>
                {language === 'sw' ? 'Ingia Kwenye Akaunti ya Mgahawa' : 'Go to Restaurant Login'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.returnBtn, { backgroundColor: colors.surfaceInteractive, marginTop: 8 }]}
              onPress={() => router.replace('/(tabs)/explore')}
              activeOpacity={0.88}
            >
              <Text style={[styles.returnBtnText, { color: colors.textPrimary }]}>
                {language === 'sw' ? 'Rudi Kwenye Programu' : 'Return to Explore App'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // WIZARD SCREEN (5 Steps)
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.stepHeaderInfo}>
          <Text style={styles.headerTitle}>
            {language === 'sw' ? 'Sajili Mgahawa / Kibanda' : 'Register Food Spot'}
          </Text>
          <Text style={styles.headerStepText}>
            {language === 'sw' ? `Hatua ya ${currentStep} ya 5` : `Step ${currentStep} of 5`} •{' '}
            {currentStep === 1
              ? (language === 'sw' ? 'Akaunti ya Mmiliki' : 'Owner Account')
              : currentStep === 2
              ? (language === 'sw' ? 'Taarifa za Biashara' : 'Business Profile')
              : currentStep === 3
              ? (language === 'sw' ? 'Eneo na Anwani' : 'Location & Address')
              : currentStep === 4
              ? (language === 'sw' ? 'Nyaraka za Uthibitisho' : 'Verification Documents')
              : (language === 'sw' ? 'Kagua na Utume' : 'Review & Submit')}
          </Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* Step Progress Bar */}
      <View style={styles.progressBarContainer}>
        {[1, 2, 3, 4, 5].map((s) => (
          <View
            key={s}
            style={[
              styles.progressSegment,
              s <= currentStep ? styles.progressSegmentActive : styles.progressSegmentInactive,
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isLargeScreen && styles.largeScreenContent]}
        showsVerticalScrollIndicator={false}
      >
        {errors.form && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{errors.form}</Text>
          </View>
        )}

        {/* ================= STEP 1: ACCOUNT ================= */}
        {currentStep === 1 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? '1. Taarifa za Mmiliki na Akaunti' : '1. Owner & Login Account'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Akaunti hii itatumika kusimamia jiko, kuongeza matawi na kupokea malipo.'
                : 'This account will be used to manage your kitchen, add branches, and receive settlements.'}
            </Text>

            <Text style={styles.inputLabel}>
              {language === 'sw' ? 'Jina Kamili la Mmiliki *' : 'Owner Full Name *'}
            </Text>
            <TextInput
              style={[styles.input, errors.ownerFullName && styles.inputError]}
              value={ownerFullName}
              onChangeText={setOwnerFullName}
              placeholder="mf. Amina Juma Bakari"
              placeholderTextColor={colors.inputPlaceholder}
            />
            {errors.ownerFullName && <Text style={styles.fieldError}>{errors.ownerFullName}</Text>}

            <Text style={styles.inputLabel}>
              {language === 'sw'
                ? 'Namba ya Simu ya Mawasiliano (M-Pesa / Mixx by Yas / Airtel Money) *'
                : 'Contact Phone Number (M-Pesa / Mixx by Yas / Airtel Money) *'}
            </Text>
            <TextInput
              style={[styles.input, errors.ownerPhone && styles.inputError]}
              value={ownerPhone}
              onChangeText={setOwnerPhone}
              placeholder="+255 754 123 456"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="phone-pad"
            />
            {errors.ownerPhone && <Text style={styles.fieldError}>{errors.ownerPhone}</Text>}

            <Text style={styles.inputLabel}>
              {language === 'sw' ? 'Barua Pepe ya Kuingia (Login Email) *' : 'Login Email Address *'}
            </Text>
            <TextInput
              style={[styles.input, errors.ownerEmail && styles.inputError]}
              value={ownerEmail}
              onChangeText={setOwnerEmail}
              placeholder="owner@example.com"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.ownerEmail && <Text style={styles.fieldError}>{errors.ownerEmail}</Text>}

            <Text style={styles.inputLabel}>
              {language === 'sw' ? 'Nenosiri Salama (Password) *' : 'Secure Password *'}
            </Text>
            <View style={[styles.passwordInputWrap, errors.password && styles.inputError]}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Angalau herufi 10..."
                placeholderTextColor={colors.inputPlaceholder}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}

            <Text style={[styles.inputLabel, { marginTop: 10 }]}>
              {language === 'sw' ? 'Thibitisha Nenosiri (Confirm Password) *' : 'Confirm Password *'}
            </Text>
            <TextInput
              style={[styles.input, errors.confirmPassword && styles.inputError]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Rudia nenosiri uliloweka"
              placeholderTextColor={colors.inputPlaceholder}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            {errors.confirmPassword && <Text style={styles.fieldError}>{errors.confirmPassword}</Text>}

            {/* Password Policy Checklist */}
            <View style={styles.policyBox}>
              <Text style={styles.policyTitle}>
                {language === 'sw' ? 'Vigezo vya Nenosiri Salama:' : 'Password Security Policy:'}
              </Text>
              <View style={styles.policyGrid}>
                <View style={styles.policyItem}>
                  <Ionicons
                    name={passwordChecks.hasMinLength ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={passwordChecks.hasMinLength ? '#16a34a' : colors.textMuted}
                  />
                  <Text style={[styles.policyText, passwordChecks.hasMinLength && styles.policyTextMet]}>
                    10+ characters
                  </Text>
                </View>
                <View style={styles.policyItem}>
                  <Ionicons
                    name={passwordChecks.hasUppercase ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={passwordChecks.hasUppercase ? '#16a34a' : colors.textMuted}
                  />
                  <Text style={[styles.policyText, passwordChecks.hasUppercase && styles.policyTextMet]}>
                    Uppercase (A-Z)
                  </Text>
                </View>
                <View style={styles.policyItem}>
                  <Ionicons
                    name={passwordChecks.hasLowercase ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={passwordChecks.hasLowercase ? '#16a34a' : colors.textMuted}
                  />
                  <Text style={[styles.policyText, passwordChecks.hasLowercase && styles.policyTextMet]}>
                    Lowercase (a-z)
                  </Text>
                </View>
                <View style={styles.policyItem}>
                  <Ionicons
                    name={passwordChecks.hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={passwordChecks.hasNumber ? '#16a34a' : colors.textMuted}
                  />
                  <Text style={[styles.policyText, passwordChecks.hasNumber && styles.policyTextMet]}>
                    Number (0-9)
                  </Text>
                </View>
                <View style={styles.policyItem}>
                  <Ionicons
                    name={passwordChecks.hasSpecialChar ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={passwordChecks.hasSpecialChar ? '#16a34a' : colors.textMuted}
                  />
                  <Text style={[styles.policyText, passwordChecks.hasSpecialChar && styles.policyTextMet]}>
                    Special character (!@#$)
                  </Text>
                </View>
                <View style={styles.policyItem}>
                  <Ionicons
                    name={passwordChecks.matchesConfirm ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={passwordChecks.matchesConfirm ? '#16a34a' : colors.textMuted}
                  />
                  <Text style={[styles.policyText, passwordChecks.matchesConfirm && styles.policyTextMet]}>
                    Passwords match
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ================= STEP 2: BUSINESS ================= */}
        {currentStep === 2 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? '2. Taarifa za Biashara ya Chakula' : '2. Business Profile'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Jina la mgahawa na aina ya vyakula unavyotayarisha.'
                : 'Brand identity, specialty dishes, and food business format.'}
            </Text>

            <Text style={styles.inputLabel}>
              {language === 'sw' ? 'Jina la Mgahawa / Kibanda (Business Name) *' : 'Food Spot / Business Name *'}
            </Text>
            <TextInput
              style={[styles.input, errors.businessName && styles.inputError]}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="mf. Mama Amina Biryani Spot"
              placeholderTextColor={colors.inputPlaceholder}
            />
            {errors.businessName && <Text style={styles.fieldError}>{errors.businessName}</Text>}

            <Text style={styles.inputLabel}>
              {language === 'sw' ? 'Aina ya Biashara (Business Format)' : 'Business Format'}
            </Text>
            <View style={styles.cuisineRow}>
              {[
                { id: 'RESTAURANT', label: '🏪 Full Restaurant' },
                { id: 'LOCAL_SPOT', label: '🥘 Mama Lishe / Kibanda' },
                { id: 'HOME_KITCHEN', label: '🏡 Home Kitchen' },
                { id: 'BAKERY', label: '🧁 Bakery & Sweets' },
              ].map((fmt) => (
                <TouchableOpacity
                  key={fmt.id}
                  style={[styles.cuisineChip, businessType === fmt.id && styles.cuisineChipActive]}
                  onPress={() => setBusinessType(fmt.id)}
                >
                  <Text style={[styles.cuisineChipText, businessType === fmt.id && styles.cuisineChipTextActive]}>
                    {fmt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>
              {language === 'sw' ? 'Aina Kuu ya Chakula (Specialty Cuisine) *' : 'Specialty Cuisine *'}
            </Text>
            <View style={styles.cuisineRow}>
              {cuisinePresets.map((p) => {
                const isSelected = cuisine === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.cuisineChip, isSelected && styles.cuisineChipActive]}
                    onPress={() => setCuisine(p.id)}
                  >
                    <Text style={[styles.cuisineChipText, isSelected && styles.cuisineChipTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.cuisine && <Text style={styles.fieldError}>{errors.cuisine}</Text>}
          </View>
        )}

        {/* ================= STEP 3: LOCATION ================= */}
        {currentStep === 3 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? '3. Eneo na Anwani ya Uendeshaji' : '3. Location & Operating Area'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Eneo ambalo mgahawa au jiko lako lipo Dar es Salaam.'
                : 'Physical area and street address for dispatch and customer pickup.'}
            </Text>

            <Text style={styles.inputLabel}>
              {language === 'sw' ? 'Mtaa / Eneo Kuu (Neighborhood) *' : 'Neighborhood / Ward *'}
            </Text>
            <TextInput
              style={[styles.input, errors.neighborhood && styles.inputError]}
              value={neighborhood}
              onChangeText={setNeighborhood}
              placeholder="mf. Mikocheni B, Sinza, Masaki, Kariakoo"
              placeholderTextColor={colors.inputPlaceholder}
            />
            {errors.neighborhood && <Text style={styles.fieldError}>{errors.neighborhood}</Text>}

            <Text style={styles.inputLabel}>
              {language === 'sw' ? 'Anwani Kamili / Alama Maarufu (Landmark) *' : 'Physical Address & Landmark *'}
            </Text>
            <TextInput
              style={[styles.input, errors.address && styles.inputError]}
              value={address}
              onChangeText={setAddress}
              placeholder="mf. Mtaa wa Mwinyijuma, Karibu na Stendi ya Daladala"
              placeholderTextColor={colors.inputPlaceholder}
            />
            {errors.address && <Text style={styles.fieldError}>{errors.address}</Text>}

            <Text style={styles.inputLabel}>
              {language === 'sw' ? 'Maelezo ya Ziada (Notes / Operating Info)' : 'Notes & Operating Details'}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Eleza ratiba ya mapishi, uwezo wa oda kubwa, au maelekezo ya jiko..."
              placeholderTextColor={colors.inputPlaceholder}
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        {/* ================= STEP 4: VERIFICATION ================= */}
        {currentStep === 4 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? '4. Nyaraka za Uthibitisho (Gate A)' : '4. Verification Documents (Gate A)'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Nyaraka zote zinahifadhiwa kwenye ghala la siri (merchant-verification) bila kufunguliwa hadharani.'
                : 'All documents are stored in encrypted private storage with zero public exposure.'}
            </Text>

            {/* Verified Tier Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setHasTinOrLicense(!hasTinOrLicense)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={hasTinOrLicense ? 'checkbox' : 'square-outline'}
                size={22}
                color={hasTinOrLicense ? '#1d6637' : colors.textMuted}
              />
              <Text style={styles.checkboxText}>
                {language === 'sw'
                  ? 'Nina namba ya TIN au Leseni ya Biashara (Verified Merchant Upgrade)'
                  : 'I have a TIN number or Business License (Verified Merchant Tier)'}
              </Text>
            </TouchableOpacity>

            {hasTinOrLicense && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.inputLabel}>
                  {language === 'sw' ? 'Namba ya TIN (TRA Tax Identification)' : 'TIN Number (TRA Tax Identification)'}
                </Text>
                <TextInput
                  style={[styles.input, errors.tinNumber && styles.inputError]}
                  value={tinNumber}
                  onChangeText={setTinNumber}
                  placeholder="123-456-789"
                  placeholderTextColor={colors.inputPlaceholder}
                />
                {errors.tinNumber && <Text style={styles.fieldError}>{errors.tinNumber}</Text>}
              </View>
            )}

            {/* Document Type Picker */}
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>
              {language === 'sw' ? 'Chagua Aina ya Hati ya Kupakia:' : 'Select Document Type to Upload:'}
            </Text>
            <View style={styles.docTypeContainer}>
              {docTypeOptions.map((opt) => {
                const isSelected = selectedDocType === opt.type;
                return (
                  <TouchableOpacity
                    key={opt.type}
                    style={[styles.docTypeOption, isSelected && styles.docTypeOptionSelected]}
                    onPress={() => setSelectedDocType(opt.type)}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={isSelected ? '#1d6637' : colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.docTypeOptionLabel, isSelected && styles.docTypeOptionLabelSelected]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.docTypeOptionDesc}>{opt.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Document Upload Button */}
            <TouchableOpacity
              style={styles.uploadDocBtn}
              onPress={handlePickDocument}
              disabled={isPickingDoc}
              activeOpacity={0.8}
            >
              {isPickingDoc ? (
                <ActivityIndicator size="small" color="#1d6637" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color="#1d6637" />
                  <Text style={styles.uploadDocBtnText}>
                    {language === 'sw' ? 'Pakia Nyaraka ya Uthibitisho' : 'Attach Verification Document'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {errors.doc && <Text style={styles.fieldError}>{errors.doc}</Text>}

            {/* Staged Docs List */}
            {stagedDocs.length > 0 && (
              <View style={styles.stagedDocsBox}>
                <Text style={styles.stagedDocsTitle}>
                  {language === 'sw' ? 'Nyaraka Zilizochaguliwa:' : 'Staged Documents for Submission:'}
                </Text>
                {stagedDocs.map((doc) => (
                  <View key={doc.id} style={styles.stagedDocItem}>
                    <Ionicons name="document-text" size={18} color="#0f766e" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stagedDocType}>{doc.documentType}</Text>
                      <Text style={styles.stagedDocName}>{doc.fileName}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveStagedDoc(doc.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ================= STEP 5: REVIEW & SUBMIT ================= */}
        {currentStep === 5 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? '5. Kagua na Utume Maombi' : '5. Review & Submit Application'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Tafadhali kagua taarifa ulizoweka kabla ya kutuma kwa msimamizi.'
                : 'Please verify all details before submitting for Gate A administrator review.'}
            </Text>

            {/* Summary Review Cards */}
            <View style={styles.summaryBlock}>
              <View style={styles.summaryHeader}>
                <Ionicons name="person-outline" size={16} color="#1d6637" />
                <Text style={styles.summaryBlockTitle}>Owner Account</Text>
              </View>
              <Text style={styles.summaryText}><Text style={{ fontWeight: '700' }}>Name: </Text>{ownerFullName}</Text>
              <Text style={styles.summaryText}><Text style={{ fontWeight: '700' }}>Phone: </Text>{ownerPhone}</Text>
              <Text style={styles.summaryText}><Text style={{ fontWeight: '700' }}>Email: </Text>{ownerEmail}</Text>
            </View>

            <View style={styles.summaryBlock}>
              <View style={styles.summaryHeader}>
                <Ionicons name="storefront-outline" size={16} color="#1d6637" />
                <Text style={styles.summaryBlockTitle}>Food Spot Profile</Text>
              </View>
              <Text style={styles.summaryText}><Text style={{ fontWeight: '700' }}>Business: </Text>{businessName}</Text>
              <Text style={styles.summaryText}><Text style={{ fontWeight: '700' }}>Specialty: </Text>{cuisine}</Text>
              <Text style={styles.summaryText}><Text style={{ fontWeight: '700' }}>Format: </Text>{businessType}</Text>
            </View>

            <View style={styles.summaryBlock}>
              <View style={styles.summaryHeader}>
                <Ionicons name="location-outline" size={16} color="#1d6637" />
                <Text style={styles.summaryBlockTitle}>Location</Text>
              </View>
              <Text style={styles.summaryText}><Text style={{ fontWeight: '700' }}>Neighborhood: </Text>{neighborhood}</Text>
              <Text style={styles.summaryText}><Text style={{ fontWeight: '700' }}>Address: </Text>{address}</Text>
            </View>

            <View style={styles.summaryBlock}>
              <View style={styles.summaryHeader}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#1d6637" />
                <Text style={styles.summaryBlockTitle}>Verification</Text>
              </View>
              <Text style={styles.summaryText}>
                <Text style={{ fontWeight: '700' }}>TIN Number: </Text>
                {tinNumber.trim() ? tinNumber : 'None provided (Informal)'}
              </Text>
              <Text style={styles.summaryText}>
                <Text style={{ fontWeight: '700' }}>Documents: </Text>
                {stagedDocs.length > 0 ? `${stagedDocs.length} attached` : 'None staged'}
              </Text>
            </View>

            {/* Terms of Service & Food Safety Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={agreedToTerms ? 'checkbox' : 'square-outline'}
                size={22}
                color={agreedToTerms ? '#1d6637' : colors.textMuted}
              />
              <Text style={styles.checkboxText}>
                {language === 'sw'
                  ? 'Nathibitisha kuwa taarifa hizi ni za kweli na ninakubali Sheria za Usalama wa Chakula na Masharti ya MloHub.'
                  : 'I declare that the information provided is accurate and agree to MloHub Merchant Terms & Food Hygiene Standards.'}
              </Text>
            </TouchableOpacity>
            {errors.terms && <Text style={styles.fieldError}>{errors.terms}</Text>}
          </View>
        )}

        {/* Navigation Buttons (Back / Next / Submit) */}
        <View style={styles.navBtnRow}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.prevBtn} onPress={handleBack} disabled={isSubmitting}>
              <Ionicons name="arrow-back" size={16} color={colors.textPrimary} />
              <Text style={styles.prevBtnText}>
                {language === 'sw' ? 'Nyuma' : 'Back'}
              </Text>
            </TouchableOpacity>
          )}

          {currentStep < 5 ? (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.88}>
              <Text style={styles.nextBtnText}>
                {language === 'sw' ? 'Endelea' : 'Continue'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={colors.onPrimary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.88}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color={colors.onPrimary} />
                  <Text style={styles.submitBtnText}>
                    {language === 'sw' ? 'Tuma Ombi Rasmi (Gate A)' : 'Submit Application (Gate A)'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.loginLinkRow}>
          <Text style={styles.loginLinkMuted}>
            {language === 'sw' ? 'Tayari una akaunti ya mgahawa?' : 'Already have an activated account?'}
          </Text>
          <TouchableOpacity onPress={() => router.push('/auth/login?type=restaurant')}>
            <Text style={styles.loginLinkBold}>
              {language === 'sw' ? ' Ingia Hapa' : ' Sign In Here'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.appBackground,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: Radii.full,
      backgroundColor: colors.appBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepHeaderInfo: {
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    headerStepText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
      marginTop: 1,
    },
    progressBarContainer: {
      flexDirection: 'row',
      height: 4,
      backgroundColor: colors.border,
    },
    progressSegment: {
      flex: 1,
      height: 4,
    },
    progressSegmentActive: {
      backgroundColor: '#1d6637',
    },
    progressSegmentInactive: {
      backgroundColor: 'transparent',
    },
    scrollContent: {
      padding: Spacing.lg,
      gap: 16,
      paddingBottom: 40,
    },
    largeScreenContent: {
      maxWidth: 680,
      alignSelf: 'center',
      width: '100%',
    },
    sectionCard: {
      backgroundColor: colors.card,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.sm,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    sectionSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 6,
      lineHeight: 16,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.danger,
      padding: 10,
      borderRadius: Radii.md,
    },
    errorText: {
      fontSize: 12.5,
      color: colors.danger,
      fontWeight: '600',
      flex: 1,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 4,
    },
    input: {
      backgroundColor: colors.appBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      padding: 12,
      fontSize: 13.5,
      color: colors.textPrimary,
    },
    textArea: {
      height: 75,
      textAlignVertical: 'top',
    },
    inputError: {
      borderColor: colors.danger,
    },
    fieldError: {
      fontSize: 11,
      color: colors.danger,
      fontWeight: '600',
    },
    passwordInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.appBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      paddingRight: 10,
    },
    eyeBtn: {
      padding: 6,
    },
    policyBox: {
      backgroundColor: colors.appBackground,
      borderRadius: Radii.md,
      padding: 12,
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    policyTitle: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    policyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    policyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      width: '48%',
    },
    policyText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    policyTextMet: {
      color: '#16a34a',
      fontWeight: '600',
    },
    cuisineRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    cuisineChip: {
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: Radii.full,
      backgroundColor: colors.appBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cuisineChipActive: {
      backgroundColor: '#1d6637',
      borderColor: '#1d6637',
    },
    cuisineChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cuisineChipTextActive: {
      color: colors.onPrimary,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 6,
    },
    checkboxText: {
      fontSize: 12.5,
      color: colors.textPrimary,
      flex: 1,
      fontWeight: '600',
      lineHeight: 18,
    },
    docTypeContainer: {
      gap: 8,
      marginTop: 4,
    },
    docTypeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      borderRadius: Radii.md,
      backgroundColor: colors.appBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    docTypeOptionSelected: {
      borderColor: '#1d6637',
      backgroundColor: colors.successSoft,
    },
    docTypeOptionLabel: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    docTypeOptionLabelSelected: {
      color: '#1d6637',
    },
    docTypeOptionDesc: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    uploadDocBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: Radii.md,
      backgroundColor: colors.successSoft,
      borderWidth: 1,
      borderColor: '#1d6637',
      borderStyle: 'dashed',
      marginTop: 8,
    },
    uploadDocBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#1d6637',
    },
    stagedDocsBox: {
      backgroundColor: colors.appBackground,
      borderRadius: Radii.md,
      padding: 10,
      marginTop: 8,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stagedDocsTitle: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    stagedDocItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card,
      padding: 8,
      borderRadius: Radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stagedDocType: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    stagedDocName: {
      fontSize: 10.5,
      color: colors.textSecondary,
    },
    summaryBlock: {
      backgroundColor: colors.appBackground,
      borderRadius: Radii.md,
      padding: 10,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    summaryBlockTitle: {
      fontSize: 12.5,
      fontWeight: '800',
      color: '#1d6637',
    },
    summaryText: {
      fontSize: 12,
      color: colors.textPrimary,
    },
    navBtnRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 4,
    },
    prevBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: Radii.xl,
      backgroundColor: colors.surfaceInteractive,
      borderWidth: 1,
      borderColor: colors.border,
    },
    prevBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    nextBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      borderRadius: Radii.xl,
      backgroundColor: '#1d6637',
      ...Shadows.md,
    },
    nextBtnText: {
      fontSize: 14.5,
      fontWeight: '800',
      color: colors.onPrimary,
    },
    submitBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: Radii.xl,
      backgroundColor: '#1d6637',
      ...Shadows.md,
    },
    submitBtnText: {
      fontSize: 14.5,
      fontWeight: '800',
      color: colors.onPrimary,
    },
    loginLinkRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 10,
    },
    loginLinkMuted: {
      fontSize: 12.5,
      color: colors.textSecondary,
    },
    loginLinkBold: {
      fontSize: 12.5,
      fontWeight: '800',
      color: '#1d6637',
    },
    // Success Screen Styles
    successContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xl,
      backgroundColor: colors.appBackground,
    },
    successCard: {
      backgroundColor: colors.card,
      borderRadius: Radii.xxl,
      padding: Spacing.xl,
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.success,
      maxWidth: 520,
      width: '100%',
      ...Shadows.lg,
    },
    successIconWrap: {
      width: 72,
      height: 72,
      borderRadius: Radii.full,
      backgroundColor: colors.successSoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    gateABadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.successSoft,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: Radii.full,
      borderWidth: 1,
      borderColor: '#1d6637',
    },
    gateABadgeText: {
      fontSize: 10.5,
      fontWeight: '900',
      color: '#1d6637',
      letterSpacing: 0.5,
    },
    successTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    successSub: {
      fontSize: 12.5,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 17,
    },
    appRefBox: {
      backgroundColor: colors.appBackground,
      borderRadius: Radii.lg,
      padding: 10,
      alignItems: 'center',
      width: '100%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    appRefLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    appRefCode: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.success,
      marginTop: 2,
      letterSpacing: 0.8,
    },
    processFlowBox: {
      backgroundColor: colors.appBackground,
      borderRadius: Radii.md,
      padding: 12,
      width: '100%',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    processFlowTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    flowStepRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    flowStepNumActive: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#1d6637',
      justifyContent: 'center',
      alignItems: 'center',
    },
    flowStepNumTextActive: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.onPrimary,
    },
    flowStepTitleActive: {
      fontSize: 12,
      fontWeight: '700',
      color: '#1d6637',
    },
    flowStepNumPending: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.surfaceInteractive,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    flowStepNumTextPending: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
    },
    flowStepTitlePending: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    flowStepDesc: {
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 15,
      marginTop: 1,
    },
    credentialsCard: {
      backgroundColor: colors.successSoft,
      borderWidth: 1,
      borderColor: colors.success,
      borderRadius: Radii.lg,
      padding: 10,
      width: '100%',
      gap: 4,
    },
    credentialsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    credentialsTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.success,
    },
    credentialsItem: {
      fontSize: 11.5,
      color: colors.textPrimary,
    },
    credentialsNote: {
      fontSize: 10.5,
      color: colors.success,
      lineHeight: 14,
      marginTop: 2,
    },
    returnBtn: {
      backgroundColor: '#1d6637',
      borderRadius: Radii.xl,
      paddingVertical: 12,
      width: '100%',
      alignItems: 'center',
    },
    returnBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.onPrimary,
    },
  });
