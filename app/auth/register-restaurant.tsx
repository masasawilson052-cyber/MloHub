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
import { PlatformSettingsRepository } from '../../repositories/platformSettings.repository';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { runtimeConfig } from '../../lib/runtimeConfig';
import { RestaurantCredentialsService } from '../../lib/restaurantCredentials';
import AsyncStorage from '@react-native-async-storage/async-storage';
const DRAFT_KEY = 'mlohub.restaurant-application-draft.v1';

export default function RegisterRestaurantScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const { user: authUser, signUpCustomer, login } = useAuth();

  const isCurrentUserAdmin =
    authUser?.role === 'ADMIN' ||
    authUser?.role === 'SUPER_ADMIN' ||
    authUser?.accountType === 'ADMIN';

  // Form Fields
  const [businessName, setBusinessName] = useState('');
  const [ownerFullName, setOwnerFullName] = useState(!isCurrentUserAdmin ? authUser?.fullName || '' : '');
  const [ownerPhone, setOwnerPhone] = useState(!isCurrentUserAdmin && authUser?.phone ? authUser.phone : '+255 ');
  const [ownerEmail, setOwnerEmail] = useState(!isCurrentUserAdmin ? authUser?.email || '' : '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (Date.now() - draft.savedAt > 24 * 3600 * 1000) {
        AsyncStorage.removeItem(DRAFT_KEY);
        return;
      }
      setBusinessName(draft.businessName || '');
      setOwnerFullName(draft.ownerFullName || '');
      setOwnerPhone(draft.ownerPhone || '+255 ');
      setOwnerEmail(draft.ownerEmail || '');
      setCuisine(draft.cuisine || '');
      setNeighborhood(draft.neighborhood || '');
      setAddress(draft.address || '');
      setHasTinOrLicense(!!draft.hasTinOrLicense);
      setTinNumber(draft.tinNumber || '');
      setNotes(draft.notes || '');
    }).catch(() => {});
  }, []);

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
    if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
      errs.ownerEmail = 'Valid email is required for your restaurant login account';
    }
    if (!password.trim() || password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }
    if (!address.trim()) errs.address = 'Physical operating address is required';
    if (!neighborhood.trim()) errs.neighborhood = 'Neighborhood is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const opSettings = await PlatformSettingsRepository.getOperationalSettings();
      if (opSettings.maintenanceMode) {
        setErrors({ form: 'The platform is currently under maintenance. Please try again later.' });
        setIsSubmitting(false);
        return;
      }
      if (!opSettings.restaurantApplicationsEnabled) {
        setErrors({ form: 'Vendor applications are temporarily paused by administration.' });
        setIsSubmitting(false);
        return;
      }

      const cleanEmail = ownerEmail.trim().toLowerCase();
      const passwordHash = RestaurantCredentialsService.computeHash(cleanEmail, password);

      const draft = {
        businessName,
        ownerFullName,
        ownerPhone,
        ownerEmail: cleanEmail,
        cuisine,
        neighborhood,
        address,
        hasTinOrLicense,
        tinNumber,
        notes,
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

      // Save credential record immediately so restaurant login with this email + password always works
      await RestaurantCredentialsService.saveCredentialRecord({
        email: cleanEmail,
        passwordHash,
        businessName: businessName.trim(),
        ownerName: ownerFullName.trim(),
        ownerPhone: ownerPhone.trim(),
        cuisineType: cuisine,
        neighborhood: neighborhood.trim(),
        address: address.trim(),
        hasTinOrLicense,
        tinNumber: hasTinOrLicense ? tinNumber.trim() : undefined,
        notes: notes.trim() || undefined,
        status: 'PENDING',
        syncedToServer: false,
      });

      let currentUserId = authUser?.id;
      let priorSession: any = null;

      if (isSupabaseConfigured()) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          priorSession = session;
          if (priorSession?.user) {
            currentUserId = priorSession.user.id;
            await RestaurantCredentialsService.saveConfirmedBridge({
              accessToken: priorSession.access_token,
              refreshToken: priorSession.refresh_token,
              userId: priorSession.user.id,
              email: priorSession.user.email,
            });
          }
        } catch {}
      }

      // If no session is currently active, attempt to sign up or sign in the restaurant owner in Supabase Auth
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
            await RestaurantCredentialsService.saveConfirmedBridge({
              email: cleanEmail,
              password,
              accessToken: signupRes.session.access_token,
              refreshToken: signupRes.session.refresh_token,
              userId: currentUserId,
            });
          }
        } catch (signupErr: any) {
          const errMsg = (signupErr?.message || '').toLowerCase();
          if (
            errMsg.includes('already registered') ||
            errMsg.includes('already exists') ||
            errMsg.includes('database error saving new user') ||
            errMsg.includes('unique constraint') ||
            errMsg.includes('profiles_email_key') ||
            errMsg.includes('tayari ipo')
          ) {
            try {
              const loginRes = await login({ emailOrPhone: cleanEmail, password });
              if (loginRes?.user?.id) {
                currentUserId = loginRes.user.id;
              }
            } catch {}
          }
        }

        // If Supabase Cloud email confirmation or rate limit prevented a direct session,
        // restore our confirmed bridge session so RLS insert succeeds seamlessly
        if (!currentUserId) {
          const bridgeSession = await RestaurantCredentialsService.ensureSupabaseBridgeSession(supabase);
          if (bridgeSession?.user?.id) {
            currentUserId = bridgeSession.user.id;
          }
        }
      } else if (
        currentUserId &&
        priorSession?.user?.email?.toLowerCase() === cleanEmail &&
        password &&
        !runtimeConfig.allowLocalDataFallbacks &&
        isSupabaseConfigured()
      ) {
        // Only update password on current Supabase user if the email matches the applicant's email
        try {
          await supabase.auth.updateUser({ password });
          await RestaurantCredentialsService.saveConfirmedBridge({
            email: cleanEmail,
            password,
            userId: currentUserId,
          });
        } catch (pwErr: any) {
          console.warn('[RegisterRestaurant] Could not update password on auth user:', pwErr?.message);
        }
      }

      // Submit application (binds to authenticated session or queues for automatic sync)
      const app = await ApplicationRepository.submit({
        applicantUserId: currentUserId,
        businessName: businessName.trim(),
        ownerName: ownerFullName.trim(),
        ownerPhone: ownerPhone.trim(),
        ownerEmail: cleanEmail,
        cuisineType: cuisine,
        neighborhood: neighborhood.trim(),
        address: address.trim(),
        hasTinOrLicense,
        tinNumber: hasTinOrLicense ? tinNumber.trim() : undefined,
        notes: notes.trim() || undefined,
        passwordHash,
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

            <View style={styles.credentialsCard}>
              <View style={styles.credentialsHeader}>
                <Ionicons name="key-outline" size={17} color="#0f766e" />
                <Text style={styles.credentialsTitle}>
                  {language === 'sw' ? 'Taarifa Zako za Kuingia Jikoni' : 'Your Kitchen Login Credentials'}
                </Text>
              </View>
              <Text style={styles.credentialsItem}>
                <Text style={{ fontWeight: '700', color: Colors.text }}>
                  {language === 'sw' ? 'Barua Pepe (Email): ' : 'Login Email: '}
                </Text>
                {ownerEmail.trim().toLowerCase()}
              </Text>
              <Text style={styles.credentialsItem}>
                <Text style={{ fontWeight: '700', color: Colors.text }}>
                  {language === 'sw' ? 'Nenosiri: ' : 'Password: '}
                </Text>
                {'•••••••• (Nenosiri uliloweka sasa hivi)'}
              </Text>
              <Text style={styles.credentialsNote}>
                {language === 'sw'
                  ? 'Unaweza kuingia wakati wowote kupitia ukurasa wa Kuingia Mgahawa (/auth/login?type=restaurant) kwa kutumia barua pepe na nenosiri hili ili kuona hali ya ombi lako au kufungua Kitchen Portal pindi msimamizi atakapoidhinisha.'
                  : 'You can sign in anytime at Restaurant Login (/auth/login?type=restaurant) using this email and password to check your application status or open the Kitchen Portal once approved.'}
              </Text>
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
              style={[styles.returnBtn, { marginBottom: 10 }]}
              onPress={() => router.replace('/auth/login?type=restaurant')}
              activeOpacity={0.88}
            >
              <Text style={styles.returnBtnText}>
                {language === 'sw' ? 'Ingia Kwenye Akaunti ya Mgahawa' : 'Go to Restaurant Login'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.returnBtn, { backgroundColor: '#f1f5f9' }]}
              onPress={() => router.replace('/(tabs)/explore')}
              activeOpacity={0.88}
            >
              <Text style={[styles.returnBtnText, { color: Colors.text }]}>
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
          <Text style={styles.sectionTitle}>2. Taarifa za Mmiliki na Kuingia / Owner & Login Credentials</Text>

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
            Barua Pepe ya Kuingia Mgahawa (Restaurant Login Email) *
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

          <Text style={styles.inputLabel}>Nenosiri la Akaunti ya Mgahawa (Password) *</Text>
          <View style={styles.passwordInputWrap}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }, errors.password && styles.inputError]}
              value={password}
              onChangeText={setPassword}
              placeholder="Weka nenosiri salama (angalau herufi 6)"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#64748b" />
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}

          <Text style={[styles.inputLabel, { marginTop: 10 }]}>Thibitisha Nenosiri (Confirm Password) *</Text>
          <TextInput
            style={[styles.input, errors.confirmPassword && styles.inputError]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Rudia nenosiri uliloweka"
            placeholderTextColor="#94a3b8"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          {errors.confirmPassword && <Text style={styles.fieldError}>{errors.confirmPassword}</Text>}

          <View style={styles.verifiedBadgeRow}>
            <Ionicons name="information-circle-outline" size={15} color="#0f766e" />
            <Text style={styles.verifiedBadgeText}>
              {language === 'sw'
                ? 'Utatumia barua pepe na nenosiri hili kuingia kwenye ukurasa wa Mgahawa ili kuona hali ya ombi lako na kusimamia Kitchen Portal.'
                : 'You will use this email and password to sign in at Restaurant Login to view your application status and manage the Kitchen Portal.'}
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
  authLinkedCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: Radii.lg,
    padding: 12,
    marginBottom: 12,
  },
  authLinkedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  authLinkedTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#166534',
  },
  authLinkedDesc: {
    fontSize: 12,
    color: '#15803d',
    lineHeight: 17,
  },
  toggleCustomPassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 4,
  },
  toggleCustomPassText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingRight: 10,
  },
  eyeBtn: {
    padding: 6,
  },
  credentialsCard: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#99f6e4',
    borderRadius: Radii.lg,
    padding: 12,
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
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f766e',
  },
  credentialsItem: {
    fontSize: 12,
    color: '#134e4a',
  },
  credentialsNote: {
    fontSize: 11,
    color: '#0f766e',
    lineHeight: 15,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
