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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { ApplicationRepository } from '../../repositories/applications.repository';
import AsyncStorage from '@react-native-async-storage/async-storage';
const DRAFT_KEY = 'mlohub.restaurant-application-draft.v1';

export default function RegisterRestaurantScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const { user: authUser, signUpCustomer } = useAuth();

  // Form Fields
  const [businessName, setBusinessName] = useState('');
  const [ownerFullName, setOwnerFullName] = useState(authUser?.fullName || '');
  const [ownerPhone, setOwnerPhone] = useState(authUser?.phone || '+255 ');
  const [ownerEmail, setOwnerEmail] = useState(authUser?.email || '');
  const [password, setPassword] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [hasTinOrLicense, setHasTinOrLicense] = useState(false);
  const [tinNumber, setTinNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [confirmationPending, setConfirmationPending] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (Date.now() - draft.savedAt > 24 * 3600 * 1000) { AsyncStorage.removeItem(DRAFT_KEY); return; }
      if (authUser && draft.ownerEmail.toLowerCase() !== authUser.email.toLowerCase()) return;
      setBusinessName(draft.businessName || ''); setOwnerFullName(draft.ownerFullName || '');
      setOwnerPhone(draft.ownerPhone || ''); setOwnerEmail(draft.ownerEmail || '');
      setCuisine(draft.cuisine || ''); setNeighborhood(draft.neighborhood || ''); setAddress(draft.address || '');
      setHasTinOrLicense(!!draft.hasTinOrLicense); setTinNumber(draft.tinNumber || ''); setNotes(draft.notes || '');
      setConfirmationPending(!authUser && !!draft.confirmationPending);
    }).catch(() => setErrors({ form: 'Your saved draft could not be loaded. Please enter the application details.' }));
  }, []);

  // Sync with authUser when available
  useEffect(() => {
    if (authUser) {
      if (authUser.fullName && !ownerFullName) setOwnerFullName(authUser.fullName);
      if (authUser.phone && ownerPhone === '+255 ') setOwnerPhone(authUser.phone);
      if (authUser.email && !ownerEmail) setOwnerEmail(authUser.email);
    }
  }, [authUser]);

  const cuisinePresets = [
    { id: 'Swahili', label: '🥘 Traditional Swahili' },
    { id: 'Biryani', label: '🍚 Biryani & Pilau' },
    { id: 'Mchemsho', label: '🥣 Mchemsho & Soups' },
    { id: 'Nyama Choma', label: '🥩 Nyama Choma Grill' },
    { id: 'Breakfast', label: '☕ Breakfast & Tea Spot' },
    { id: 'Healthy', label: '🥗 Healthy & Veg' },
  ];

  const validate = (): boolean => {
    const errs: { [key: string]: string } = {};
    if (!businessName.trim()) errs.businessName = 'Business or stall name is required';
    if (!cuisine.trim()) errs.cuisine = 'Please select a cuisine specialty';
    if (!ownerFullName.trim()) errs.ownerFullName = 'Owner full name is required';
    if (!ownerPhone.trim() || ownerPhone.length < 9) {
      errs.ownerPhone = 'Valid phone number is required (+255...)';
    }
    if (!authUser) {
      if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
        errs.ownerEmail = 'Valid email is required to create your owner account';
      }
      if (!password.trim() || password.length < 6) {
        errs.password = 'Password must be at least 6 characters';
      }
    }
    if (!address.trim()) errs.address = 'Physical operating address is required';
    if (!neighborhood.trim()) errs.neighborhood = 'Neighborhood is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (confirmationPending && !authUser) {
      setErrors({ form: 'Confirm your email, then use Sign In Here below to return to this application.' });
      return;
    }
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const draft = { businessName, ownerFullName, ownerPhone, ownerEmail, cuisine, neighborhood, address, hasTinOrLicense, tinNumber, notes, savedAt: Date.now(), confirmationPending: false };
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      let currentUserId = authUser?.id;

      // If user is not authenticated yet, register account in Supabase
      if (!currentUserId) {
        const signupRes = await signUpCustomer({
          email: ownerEmail.trim(),
          password: password,
          fullName: ownerFullName.trim(),
          phone: ownerPhone.trim(),
          location: neighborhood.trim(),
        });
        if (!signupRes.session) {
          await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, confirmationPending: true }));
          setConfirmationPending(true);
          setErrors({ form: 'Check your email to confirm the account, then use Sign In Here below. Your application draft is saved; it has not yet been sent to the administrator.' });
          return;
        }
        currentUserId = signupRes.session.user.id;
      }

      if (!currentUserId) {
        throw new Error('Could not establish authenticated owner identity. Please log in or verify credentials.');
      }

      // Submit application with authentic user ID
      const app = await ApplicationRepository.submit({
        applicantUserId: currentUserId,
        businessName: businessName.trim(),
        ownerName: ownerFullName.trim(),
        ownerPhone: ownerPhone.trim(),
        ownerEmail: ownerEmail.trim() || undefined,
        cuisineType: cuisine,
        neighborhood: neighborhood.trim(),
        address: address.trim(),
        hasTinOrLicense,
        tinNumber: hasTinOrLicense ? tinNumber.trim() : undefined,
        notes: notes.trim() || undefined,
      });

      setApplicationId(app.id);
      setIsSubmitted(true);

      await AsyncStorage.removeItem(DRAFT_KEY);

    } catch (e: any) {
      setErrors({ form: e?.message || 'Failed to submit application. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.successContainer}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color="#1d6637" />
            </View>
            <Text style={styles.successBadge}>
              {language === 'sw' ? 'OMBI LIMEPOKELEWA • LINAKAGULIWA NA ADMIN' : 'APPLICATION RECEIVED • UNDER ADMIN REVIEW'}
            </Text>
            <Text style={styles.successTitle}>
              {language === 'sw' ? 'Ombi Lako Limetumwa Kikamilifu!' : 'Application Submitted Successfully!'}
            </Text>
            <Text style={styles.successSub}>
              {language === 'sw'
                ? `Asante ${ownerFullName}! Maombi ya "${businessName}" yametumwa kwenye mfumo rasmi wa MloHub. Utaarifiwa pindi msimamizi atakapoidhinisha mgahawa wako.`
                : `Thank you ${ownerFullName}! Details for "${businessName}" have been submitted for administrator review. You will be notified once reviewed and approved.`}
            </Text>

            <View style={styles.appRefBox}>
              <Text style={styles.appRefLabel}>Application Reference:</Text>
              <Text style={styles.appRefCode}>{applicationId}</Text>
            </View>

            <View style={styles.nextStepsBox}>
              <Text style={styles.nextStepsTitle}>Hatua Zinazofuata / Next Steps:</Text>
              <Text style={styles.nextStepItem}>
                {language === 'sw'
                  ? '1. Usimamizi wa MloHub unakagua taarifa na eneo la mgahawa.'
                  : '1. MloHub administration verifies business credentials and location.'}
              </Text>
              <Text style={styles.nextStepItem}>
                {language === 'sw'
                  ? '2. Baada ya kuidhinishwa, utaingia kwenye Kitchen Portal kuongeza tawi na menyu yenye bei.'
                  : '2. Once approved, you can access the Kitchen Portal to set up branches, menu items, and pricing.'}
              </Text>
              <Text style={styles.nextStepItem}>
                {language === 'sw'
                  ? '3. Zindua mgahawa wako ili uonekane kwa wateja wote wa Dar es Salaam mtandaoni.'
                  : '3. Publish your restaurant to make it discoverable to customers across Dar es Salaam.'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.returnBtn}
              onPress={() => router.replace('/(tabs)/explore')}
              activeOpacity={0.88}
            >
              <Text style={styles.returnBtnText}>
                {language === 'sw' ? 'Rudi Kwenye Programu' : 'Return to Explore App'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.stepHeaderInfo}>
          <Text style={styles.headerTitle}>
            {language === 'sw' ? 'Sajili Mgahawa / Kibanda' : 'Register Food Spot'}
          </Text>
          <Text style={styles.headerStepText}>
            {language === 'sw' ? 'Hatua 1 ya 1 • Usajili Rasmi' : 'Step 1 of 1 • Official Onboarding'}
          </Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isLargeScreen && styles.largeScreenContent]}
        showsVerticalScrollIndicator={false}
      >
        {/* Value Proposition Intro */}
        <View style={styles.introCard}>
          <View style={styles.introHeader}>
            <Ionicons name="storefront" size={24} color="#1d6637" />
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>
                {language === 'sw' ? 'Jiunge na Mtandao wa MloHub' : 'Join the MloHub Network'}
              </Text>
              <Text style={styles.introSub}>
                {language === 'sw'
                  ? 'Unganisha mgahawa wako na wateja wa Dar es Salaam wanaotafuta vyakula halisi kupitia mfumo wa MloHub.'
                  : 'Connect your food spot with diners in Dar es Salaam discovering local food spots, home kitchens, and restaurants.'}
              </Text>
            </View>
          </View>
        </View>

        {errors.form && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{errors.form}</Text>
          </View>
        )}

        {/* 1. BUSINESS DETAILS */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. Taarifa za Biashara / Food Spot</Text>
          
          <Text style={styles.inputLabel}>Jina la Mgahawa / Kibanda (Business Name) *</Text>
          <TextInput
            style={[styles.input, errors.businessName && styles.inputError]}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="mf. Mama Amina Biryani Spot"
            placeholderTextColor="#94a3b8"
          />
          {errors.businessName && <Text style={styles.fieldError}>{errors.businessName}</Text>}

          <Text style={styles.inputLabel}>Aina ya Chakula (Food Specialty) *</Text>
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

        {/* 2. OWNER CONTACT DETAILS */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2. Taarifa za Mmiliki / Owner Contact</Text>

          {authUser && (
            <View style={styles.sessionBadgeRow}>
              <Ionicons name="person-circle" size={16} color="#0f766e" />
              <Text style={styles.sessionBadgeText}>
                {language === 'sw'
                  ? `Umeingia kama: ${authUser.fullName || authUser.email}`
                  : `Signed in as: ${authUser.fullName || authUser.email}`}
              </Text>
            </View>
          )}

          <Text style={styles.inputLabel}>Jina Kamili la Mmiliki (Owner Full Name) *</Text>
          <TextInput
            style={[styles.input, errors.ownerFullName && styles.inputError]}
            value={ownerFullName}
            onChangeText={setOwnerFullName}
            placeholder="mf. Amina Juma Bakari"
            placeholderTextColor="#94a3b8"
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
            placeholderTextColor="#94a3b8"
            keyboardType="phone-pad"
          />
          {errors.ownerPhone && <Text style={styles.fieldError}>{errors.ownerPhone}</Text>}

          <Text style={styles.inputLabel}>
            Barua Pepe (Email) {authUser ? '(Hiari)' : '*'}
          </Text>
          <TextInput
            style={[styles.input, errors.ownerEmail && styles.inputError]}
            value={ownerEmail}
            onChangeText={setOwnerEmail}
            placeholder="owner@example.com"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {errors.ownerEmail && <Text style={styles.fieldError}>{errors.ownerEmail}</Text>}

          {!authUser && (
            <>
              <Text style={styles.inputLabel}>Nenosiri la Akaunti ya Mmiliki (Password) *</Text>
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                value={password}
                onChangeText={setPassword}
                placeholder="Weka nenosiri salama (angalau herufi 6)"
                placeholderTextColor="#94a3b8"
                secureTextEntry
              />
              {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
            </>
          )}

          <View style={styles.verifiedBadgeRow}>
            <Ionicons name="information-circle-outline" size={15} color="#0f766e" />
            <Text style={styles.verifiedBadgeText}>
              {language === 'sw'
                ? 'Nambari itatumika kupokea arifa za oda na kumbukumbu za malipo ya biashara.'
                : 'Phone number will be used for order dispatch alerts and settlement records.'}
            </Text>
          </View>
        </View>

        {/* 3. LOCATION & OPERATING AREA */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>3. Eneo la Biashara / Location</Text>

          <Text style={styles.inputLabel}>Mtaa / Eneo (Neighborhood) *</Text>
          <TextInput
            style={[styles.input, errors.neighborhood && styles.inputError]}
            value={neighborhood}
            onChangeText={setNeighborhood}
            placeholder="mf. Mikocheni B, Sinza, Masaki, Kinondoni"
            placeholderTextColor="#94a3b8"
          />
          {errors.neighborhood && <Text style={styles.fieldError}>{errors.neighborhood}</Text>}

          <Text style={styles.inputLabel}>Anwani Kamili (Physical Address / Landmark) *</Text>
          <TextInput
            style={[styles.input, errors.address && styles.inputError]}
            value={address}
            onChangeText={setAddress}
            placeholder="mf. Mtaa wa Mwinyijuma, Karibu na Stendi ya Daladala"
            placeholderTextColor="#94a3b8"
          />
          {errors.address && <Text style={styles.fieldError}>{errors.address}</Text>}

          <Text style={styles.inputLabel}>Maelezo ya Ziada (Notes / Special Menu)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Eleza chakula unachopika, muda wa kufungua, au maelezo mengine..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* 4. FORMAL DOCS (OPTIONAL) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {language === 'sw' ? '4. Taarifa za Uthibitisho wa Kibiashara (Hiari)' : '4. Business Verification Details (Optional)'}
          </Text>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setHasTinOrLicense(!hasTinOrLicense)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={hasTinOrLicense ? 'checkbox' : 'square-outline'}
              size={22}
              color={hasTinOrLicense ? '#1d6637' : '#94a3b8'}
            />
            <Text style={styles.checkboxText}>
              Nina namba ya TIN au Leseni ya Biashara (Verified Seller Upgrade)
            </Text>
          </TouchableOpacity>

          {hasTinOrLicense && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.inputLabel}>Namba ya TIN (TIN Number)</Text>
              <TextInput
                style={styles.input}
                value={tinNumber}
                onChangeText={setTinNumber}
                placeholder="123-456-789"
                placeholderTextColor="#94a3b8"
              />
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.88}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <Ionicons name="paper-plane" size={18} color="#ffffff" />
              <Text style={styles.submitBtnText}>
                {language === 'sw' ? 'Tuma Ombi la Kujiunga' : 'Submit Application'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.loginLinkRow}>
          <Text style={styles.loginLinkMuted}>
            {language === 'sw' ? 'Tayari una akaunti ya mgahawa?' : 'Already have an activated account?'}
          </Text>
          <TouchableOpacity onPress={() => router.push('/auth/login?returnTo=restaurant-registration')}>
            <Text style={styles.loginLinkBold}>
              {language === 'sw' ? ' Ingia Hapa' : ' Sign In Here'}
            </Text>
          </TouchableOpacity>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radii.full,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepHeaderInfo: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  headerStepText: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: '600',
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
  introCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  introHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065f46',
  },
  introSub: {
    fontSize: 12.5,
    color: '#047857',
    marginTop: 2,
    lineHeight: 17,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 10,
    borderRadius: Radii.md,
  },
  errorText: {
    fontSize: 12.5,
    color: '#991b1b',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 6,
    marginBottom: 4,
  },
  sessionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdfa',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    marginBottom: 6,
  },
  sessionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f766e',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    padding: 12,
    fontSize: 13.5,
    color: Colors.text,
  },
  textArea: {
    height: 75,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  fieldError: {
    fontSize: 11,
    color: '#ef4444',
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
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cuisineChipActive: {
    backgroundColor: '#1d6637',
    borderColor: '#1d6637',
  },
  cuisineChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  cuisineChipTextActive: {
    color: '#ffffff',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  checkboxText: {
    fontSize: 12.5,
    color: Colors.text,
    flex: 1,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#1d6637',
    borderRadius: Radii.xl,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    ...Shadows.md,
  },
  submitBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  loginLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginLinkMuted: {
    fontSize: 12.5,
    color: Colors.muted,
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
    backgroundColor: Colors.background,
  },
  successCard: {
    backgroundColor: Colors.card,
    borderRadius: Radii.xxl,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    maxWidth: 500,
    width: '100%',
    ...Shadows.lg,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: Radii.full,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successBadge: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 0.8,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  appRefBox: {
    backgroundColor: Colors.background,
    borderRadius: Radii.lg,
    padding: 12,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  appRefLabel: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: '600',
  },
  appRefCode: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1d6637',
    marginTop: 2,
    letterSpacing: 1,
  },
  nextStepsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: Radii.md,
    padding: 12,
    width: '100%',
    gap: 4,
  },
  nextStepsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  nextStepItem: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16,
  },
  returnBtn: {
    backgroundColor: '#1d6637',
    borderRadius: Radii.xl,
    paddingVertical: 13,
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
  },
  returnBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  verifiedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdfa',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radii.md,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f766e',
  },
});
