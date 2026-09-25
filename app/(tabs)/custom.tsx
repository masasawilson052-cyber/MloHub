import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PriceText } from '../../components/ui/PriceText';
import { EmptyState } from '../../components/ui/EmptyState';
import { FloatingCartButton } from '../../components/cart/FloatingCartButton';
import { CartDrawer } from '../../components/cart/CartDrawer';
import { OrderReviewModal } from '../../components/checkout/OrderReviewModal';
import { RealtimeService } from '../../services/RealtimeService';
import { CustomMealRepository } from '../../repositories/customMeals.repository';
import { PaymentCheckoutModal } from '../../components/PaymentCheckoutModal';
import { PaymentTransactionEntity } from '../../db/types';
import {
  CustomMealOccasion,
  BudgetType,
  SpiceLevel,
  CustomMealRequest,
  RestaurantQuote,
} from '../../types/domain';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

const OCCASIONS: { id: CustomMealOccasion; label: string; labelSw: string }[] = [
  { id: 'PERSONAL', label: 'Personal / Daily', labelSw: 'Mlo Binafsi' },
  { id: 'FAMILY', label: 'Family Feast', labelSw: 'Sherehe ya Familia' },
  { id: 'OFFICE', label: 'Office Lunch', labelSw: 'Chakula cha Ofisi' },
  { id: 'EVENT', label: 'Formal Event', labelSw: 'Hafla Rasmi' },
];

const BUDGET_TYPES: { id: BudgetType; label: string }[] = [
  { id: 'FIXED', label: 'Fixed Price' },
  { id: 'RANGE', label: 'Flexible Range' },
  { id: 'OPEN_TO_QUOTES', label: 'Open to Quotes' },
];

const SPICE_LEVELS: { id: SpiceLevel; label: string }[] = [
  { id: 'NONE', label: 'Mild / No Spice' },
  { id: 'MEDIUM', label: 'Medium Spice' },
  { id: 'HOT', label: 'Hot & Spicy' },
  { id: 'EXTRA_HOT', label: 'Extra Hot (Pilipili Kali)' },
];

const DIETARY_OPTIONS = [
  'Halal',
  'Swahili Style',
  'Fresh Coconut',
  'Low Oil',
  'Healthy & Fresh',
  'Vegetarian',
];

const ALLERGEN_OPTIONS = [
  'Peanuts (Karanga)',
  'Dairy (Maziwa)',
  'Seafood (Dagaa/Samaki)',
  'Eggs (Mayai)',
  'Gluten (Ngano)',
];

export default function CustomMealScreen() {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const router = useRouter();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  // Cart & Review Modal State
  const { addToCart, isCartOpen, setIsCartOpen } = useCart();
  const [isOrderReviewOpen, setIsOrderReviewOpen] = useState(false);

  // Flow Step: 'REQUEST' | 'QUOTES'
  const [activeTab, setActiveTab] = useState<'REQUEST' | 'QUOTES'>('REQUEST');
  const [formStep, setFormStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Form Fields - Truthful empty defaults
  const [dishTitle, setDishTitle] = useState('');
  const [description, setDescription] = useState('');
  const [occasion, setOccasion] = useState<CustomMealOccasion>('PERSONAL');
  const [budgetTzs, setBudgetTzs] = useState('');
  const [budgetMaxTzs, setBudgetMaxTzs] = useState('');
  const [budgetType, setBudgetType] = useState<BudgetType>('FIXED');
  const [servings, setServings] = useState('2');
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>('MEDIUM');
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [customerArea, setCustomerArea] = useState(user?.location || '');
  const [landmark, setLandmark] = useState('');
  const [exactAddress, setExactAddress] = useState(user?.location || '');
  const [exactPhone, setExactPhone] = useState(user?.phone || '');
  const [desiredTimeHours, setDesiredTimeHours] = useState('');

  // Active Request & Quotes State
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<CustomMealRequest | null>(null);
  const [quotes, setQuotes] = useState<RestaurantQuote[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLockingQuote, setIsLockingQuote] = useState(false);

  // Payment Modal State for Custom Meal Quote
  const [selectedQuoteForPayment, setSelectedQuoteForPayment] = useState<RestaurantQuote | null>(null);
  const [lockedTotalForPayment, setLockedTotalForPayment] = useState<number>(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isConvertingOrder, setIsConvertingOrder] = useState(false);

  useEffect(() => {
    if (user?.phone && !exactPhone) {
      setExactPhone(user.phone);
    }
    if (user?.location && !customerArea) {
      setCustomerArea(user.location);
    }
    if (user?.location && !exactAddress) {
      setExactAddress(user.location);
    }
  }, [user]);

  // Load existing requests for authenticated user
  const loadUserRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      const reqs = await CustomMealRepository.listUserRequests(user.id);
      if (reqs.length > 0) {
        const latest = reqs[0];
        setActiveRequestId(latest.id);
        setActiveRequest(latest);
        // Load quotes
        setIsLoadingQuotes(true);
        const qList = await CustomMealRepository.listQuotesForRequest(latest.id);
        setQuotes(qList);
      }
    } catch (err) {
      console.warn('[CustomMealScreen] Failed to load user requests:', err);
    } finally {
      setIsLoadingQuotes(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadUserRequests();
  }, [loadUserRequests]);

  useEffect(() => {
    if (!activeRequestId) return;
    const refresh = () => { loadUserRequests(); };
    const quotesOff = RealtimeService.subscribe('customer:quotes:' + activeRequestId, refresh, { table: 'restaurant_quotes', filter: 'request_id=eq.' + activeRequestId });
    const requestOff = RealtimeService.subscribe('customer:request:' + activeRequestId, refresh, { table: 'custom_meal_requests', filter: 'id=eq.' + activeRequestId });
    const resyncOff = RealtimeService.registerResyncCallback('custom-request:' + activeRequestId, loadUserRequests);
    return () => { quotesOff(); requestOff(); resyncOff(); };
  }, [activeRequestId, loadUserRequests]);

  const toggleDietary = (item: string) => {
    setSelectedDietary((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const toggleAllergen = (item: string) => {
    setSelectedAllergens((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const handleNextStep = () => {
    if (formStep === 1) {
      if (!dishTitle.trim()) {
        Alert.alert(
          language === 'sw' ? 'Jina la Chakula Linahitajika' : 'Missing Dish Title',
          language === 'sw'
            ? 'Tafadhali taja chakula unachotaka kuandaliwa.'
            : 'Please specify what dish you would like prepared.'
        );
        return;
      }
      setFormStep(2);
    } else if (formStep === 2) {
      const servingsNum = parseInt(servings.replace(/[^0-9]/g, ''), 10) || 0;
      if (servingsNum < 1) {
        Alert.alert(
          language === 'sw' ? 'Idadi ya Watu Inahitajika' : 'Servings Required',
          language === 'sw' ? 'Tafadhali ingiza idadi ya watu (angalau 1).' : 'Please enter number of servings (at least 1).'
        );
        return;
      }
      setFormStep(3);
    } else if (formStep === 3) {
      setFormStep(4);
    } else if (formStep === 4) {
      if (budgetType === 'FIXED') {
        const clean = budgetTzs.replace(/[^0-9]/g, '');
        const val = parseInt(clean, 10) || 0;
        if (val < 5000) {
          Alert.alert(
            language === 'sw' ? 'Bajeti Inahitajika' : 'Budget Required',
            language === 'sw' ? 'Bajeti ya kudumu lazima iwe angalau TZS 5,000.' : 'Fixed budget must be at least TZS 5,000.'
          );
          return;
        }
      } else if (budgetType === 'RANGE') {
        const minVal = parseInt(budgetTzs.replace(/[^0-9]/g, ''), 10) || 0;
        const maxVal = parseInt(budgetMaxTzs.replace(/[^0-9]/g, ''), 10) || 0;
        if (minVal < 5000) {
          Alert.alert(
            language === 'sw' ? 'Kiwango cha Chini' : 'Minimum Budget',
            language === 'sw' ? 'Kiwango cha chini lazima kiwe angalau TZS 5,000.' : 'Minimum budget must be at least TZS 5,000.'
          );
          return;
        }
        if (maxVal < minVal) {
          Alert.alert(
            language === 'sw' ? 'Kiwango cha Juu' : 'Maximum Budget',
            language === 'sw' ? 'Kiwango cha juu hakiwezi kuwa chini ya kiwango cha chini.' : 'Maximum budget cannot be less than minimum budget.'
          );
          return;
        }
      }
      setFormStep(5);
    }
  };

  const handleSubmitRequest = async () => {
    if (!dishTitle.trim()) {
      setFormStep(1);
      Alert.alert(
        language === 'sw' ? 'Jina la Chakula Linahitajika' : 'Missing Dish Title',
        language === 'sw'
          ? 'Tafadhali taja chakula unachotaka kuandaliwa.'
          : 'Please specify what dish you would like prepared.'
      );
      return;
    }

    const location = customerArea;
    if (!location.trim() || !customerArea.trim()) {
      setFormStep(5);
      Alert.alert(
        language === 'sw' ? 'Eneo Linahitajika' : 'Area Required',
        language === 'sw'
          ? 'Tafadhali ingiza eneo lako (mf. Mikocheni B, Mtaa wa Chuo).'
          : 'Please enter your neighborhood area (e.g. Mikocheni B, Mtaa wa Chuo).'
      );
      return;
    }

    if (!user?.id) {
      Alert.alert(
        language === 'sw' ? 'Unahitaji Kuingia' : 'Authentication Required',
        language === 'sw'
          ? 'Tafadhali ingia kwenye akaunti yako ili kutuma ombi rasmi la chakula maalum.'
          : 'Please sign in to your account to submit an authentic custom meal request.'
      );
      return;
    }

    const cleanBudget = budgetTzs.replace(/[^0-9]/g, '');
    const budgetNum = parseInt(cleanBudget, 10) || 0;
    const cleanMax = budgetMaxTzs.replace(/[^0-9]/g, '');
    const budgetMaxNum = parseInt(cleanMax, 10) || budgetNum;

    if (budgetType === 'FIXED' && budgetNum < 5000) {
      setFormStep(4);
      Alert.alert(
        language === 'sw' ? 'Bajeti Inahitajika' : 'Budget Required',
        language === 'sw'
          ? 'Tafadhali ingiza makadirio halisi ya bajeti ya angalau TZS 5,000 au chagua "Open to Quotes".'
          : 'Please enter a target budget of at least TZS 5,000 or select "Open to Quotes".'
      );
      return;
    }

    if (budgetType === 'RANGE') {
      if (budgetNum < 5000 || budgetMaxNum < budgetNum) {
        setFormStep(4);
        Alert.alert(
          language === 'sw' ? 'Kiwango cha Bajeti' : 'Budget Range Required',
          language === 'sw' ? 'Ingiza kiwango sahihi cha bajeti ya angalau TZS 5,000.' : 'Please enter a valid budget range of at least TZS 5,000.'
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const servingsNum = parseInt(servings.replace(/[^0-9]/g, ''), 10) || 2;
      const hoursNum = parseFloat(desiredTimeHours);
      const desiredAt = !isNaN(hoursNum) && hoursNum > 0
        ? new Date(Date.now() + hoursNum * 3600 * 1000).toISOString()
        : undefined;

      const created = await CustomMealRepository.createRequest({
        customerId: user.id,
        dishName: dishTitle.trim(),
        occasion,
        servingsCount: String(servingsNum),
        budgetTzs: budgetType === 'OPEN_TO_QUOTES' ? 0 : budgetNum,
        budgetMinTzs: budgetType === 'OPEN_TO_QUOTES' ? undefined : budgetNum,
        budgetMaxTzs: budgetType === 'RANGE' ? budgetMaxNum : (budgetType === 'OPEN_TO_QUOTES' ? undefined : budgetNum),
        budgetType,
        spiceLevel,
        dietaryTags: selectedDietary,
        allergens: selectedAllergens,
        customerArea: customerArea.trim(),
        landmark: landmark.trim() || undefined,
        exactDeliveryAddress: exactAddress.trim() || undefined,
        exactDeliveryPhone: exactPhone.trim() || undefined,
        desiredAt,
        specialInstructions: description.trim() || undefined,
      });

      setActiveRequestId(created.id);
      setActiveRequest(created);
      setActiveTab('QUOTES');
      setFormStep(1);

      // Refresh quotes list
      const qList = await CustomMealRepository.listQuotesForRequest(created.id);
      setQuotes(qList);

      Alert.alert(
        language === 'sw' ? 'Ombi Limehifadhiwa' : 'Request Saved',
        language === 'sw'
          ? `${created.orderNumber || created.id}: ${created.statusMessageSw || 'Ombi limehifadhiwa. Angalia hali yake hapa.'}`
          : `${created.orderNumber || created.id}: ${created.statusMessageEn || 'Saved. Check this screen for updates.'}`
      );
    } catch (e: any) {
      Alert.alert('Hitilafu', e?.message || 'Imeshindikana kutuma ombi la chakula.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectQuote = async (quote: RestaurantQuote) => {
    if (!activeRequestId) return;
    setIsLockingQuote(true);
    try {
      const lockResult = await CustomMealRepository.lockQuoteSelection(activeRequestId, quote.id);
      const totalToDisplay = lockResult?.grand_total_tzs || quote.totalTzs || quote.amountTzs || 0;
      setSelectedQuoteForPayment(quote);
      setLockedTotalForPayment(totalToDisplay);
      setShowPaymentModal(true);

      // Reload quotes
      const qList = await CustomMealRepository.listQuotesForRequest(activeRequestId);
      setQuotes(qList);
    } catch (err: any) {
      Alert.alert('Selection Error', err?.message || 'Failed to select quote.');
    } finally {
      setIsLockingQuote(false);
    }
  };

  const handlePaymentSuccess = async (payment: PaymentTransactionEntity) => {
    setShowPaymentModal(false);
    if (!activeRequestId) return;

    setIsConvertingOrder(true);
    try {
      const converted = await CustomMealRepository.convertCustomMealToOrder(
        activeRequestId,
        payment.id
      );

      await loadUserRequests();

      const orderRef = converted?.order_number || converted?.orderNumber || converted?.id || 'Confirmed';
      Alert.alert(
        language === 'sw' ? 'Mlo Maalum Umethibitishwa!' : 'Custom Meal Confirmed',
        language === 'sw'
          ? `Malipo yako yamekamilika na agizo #${orderRef} limeundwa kikamilifu.`
          : `Your payment was verified and canonical order #${orderRef} has been created.`
      );
    } catch (err: any) {
      console.error('Custom meal order conversion error:', err);
      Alert.alert(
        'Order Conversion Error',
        err?.message || 'Payment received, but order conversion could not complete. Please contact support with payment ref.'
      );
    } finally {
      setIsConvertingOrder(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            {language === 'sw' ? 'MIPANGO YA CHAKULA MAALUM' : 'BESPOKE CHEF DINING'}
          </Text>
          <Text style={styles.title}>
            {language === 'sw' ? 'Omba Mlo Maalum' : 'Request a Custom Meal'}
          </Text>
          <Text style={styles.subtitle}>
            {language === 'sw'
              ? 'Weka vigezo vya mlo wako, linganisha ofa za wapishi waliohitimu, na uamuru kwa usalama.'
              : 'Configure your custom meal specifications, receive line-item quotes from qualified kitchens, and order securely.'}
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'REQUEST' && styles.tabBtnActive]}
            onPress={() => setActiveTab('REQUEST')}
          >
            <Text style={[styles.tabText, activeTab === 'REQUEST' && styles.tabTextActive]}>
              1. Meal Request
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'QUOTES' && styles.tabBtnActive]}
            onPress={() => {
              setActiveTab('QUOTES');
              if (activeRequestId) {
                CustomMealRepository.listQuotesForRequest(activeRequestId).then(setQuotes);
              }
            }}
          >
            <Text style={[styles.tabText, activeTab === 'QUOTES' && styles.tabTextActive]}>
              2. Chef Quotes ({quotes.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: MEAL REQUEST FORM (5-STEP WIZARD) */}
        {activeTab === 'REQUEST' && (
          <View style={styles.formCard}>
            {/* Wizard Step Header & Progress */}
            <View style={styles.wizardProgressTrack}>
              <View style={[styles.wizardProgressFill, { width: `${(formStep / 5) * 100}%` }]} />
            </View>
            <View style={styles.wizardHeaderRow}>
              <Text style={styles.wizardStepBadge}>
                {language === 'sw' ? `Hatua ya ${formStep} kati ya 5` : `Step ${formStep} of 5`}
              </Text>
              <Text style={styles.wizardStepTitle}>
                {formStep === 1
                  ? (language === 'sw' ? 'Chakula na Maelezo' : 'Dish & Description')
                  : formStep === 2
                  ? (language === 'sw' ? 'Watu na Muda wa Kuandaa' : 'Servings & Prep Time')
                  : formStep === 3
                  ? (language === 'sw' ? 'Pilipili na Vionjo' : 'Dietary & Preferences')
                  : formStep === 4
                  ? (language === 'sw' ? 'Makadirio ya Bajeti' : 'Budget & Pricing')
                  : (language === 'sw' ? 'Eneo la Kupelekewa' : 'Delivery Area & Privacy')}
              </Text>
            </View>

            {/* STEP 1: Dish & Description */}
            {formStep === 1 && (
              <View style={styles.stepContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {language === 'sw' ? 'Jina la Chakula / Dhana ya Mlo *' : 'Dish Name / Concept *'}
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={dishTitle}
                    onChangeText={setDishTitle}
                    placeholder="e.g. Zanzibar Goat Biryani Pot with Salad & Raita"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {language === 'sw' ? 'Aina ya Tukio' : 'Occasion'}
                  </Text>
                  <View style={styles.chipsRow}>
                    {OCCASIONS.map((occ) => (
                      <TouchableOpacity
                        key={occ.id}
                        style={[styles.chip, occasion === occ.id && styles.chipActive]}
                        onPress={() => setOccasion(occ.id)}
                      >
                        <Text style={[styles.chipText, occasion === occ.id && styles.chipTextActive]}>
                          {language === 'sw' ? occ.labelSw : occ.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {language === 'sw' ? 'Maelekezo Maalum ya Upishi (Hiari)' : 'Special Instructions & Preparation Notes (Optional)'}
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    multiline={true}
                    numberOfLines={3}
                    placeholder="Include custom marinade, portioning preferences, or packaging requirements..."
                  />
                </View>
              </View>
            )}

            {/* STEP 2: Servings & Delivery Time */}
            {formStep === 2 && (
              <View style={styles.stepContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {language === 'sw' ? 'Idadi ya Watu (Walaji) *' : 'Servings (People) *'}
                  </Text>
                  <View style={styles.chipsRow}>
                    {['1', '2', '4', '6', '10', '20+'].map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.chip, servings === s && styles.chipActive]}
                        onPress={() => setServings(s)}
                      >
                        <Text style={[styles.chipText, servings === s && styles.chipTextActive]}>
                          {s} {language === 'sw' ? (s === '1' ? 'Mtu' : 'Watu') : (s === '1' ? 'Person' : 'People')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={[styles.textInput, { marginTop: Spacing.xs }]}
                    value={servings}
                    onChangeText={setServings}
                    keyboardType="numeric"
                    placeholder="2"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {language === 'sw' ? 'Muda Unaohitajika wa Maandalizi (Saa kutoka sasa)' : 'Desired Preparation Lead Time (Hours from now)'}
                  </Text>
                  <View style={styles.chipsRow}>
                    {['2', '4', '8', '24'].map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[styles.chip, desiredTimeHours === h && styles.chipActive]}
                        onPress={() => setDesiredTimeHours(h)}
                      >
                        <Text style={[styles.chipText, desiredTimeHours === h && styles.chipTextActive]}>
                          {h} {language === 'sw' ? 'Saa' : 'Hrs'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={[styles.textInput, { marginTop: Spacing.xs }]}
                    value={desiredTimeHours}
                    onChangeText={setDesiredTimeHours}
                    keyboardType="numeric"
                    placeholder="4"
                  />
                </View>
              </View>
            )}

            {/* STEP 3: Dietary & Preferences */}
            {formStep === 3 && (
              <View style={styles.stepContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {language === 'sw' ? 'Kiwango cha Pilipili' : 'Spice Preference'}
                  </Text>
                  <View style={styles.chipsRow}>
                    {SPICE_LEVELS.map((sp) => (
                      <TouchableOpacity
                        key={sp.id}
                        style={[styles.chip, spiceLevel === sp.id && styles.chipActive]}
                        onPress={() => setSpiceLevel(sp.id)}
                      >
                        <Text style={[styles.chipText, spiceLevel === sp.id && styles.chipTextActive]}>
                          {sp.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {language === 'sw' ? 'Mapendeleo ya Lishe' : 'Dietary Preferences'}
                  </Text>
                  <View style={styles.chipsRow}>
                    {DIETARY_OPTIONS.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={[styles.chip, selectedDietary.includes(tag) && styles.chipActive]}
                        onPress={() => toggleDietary(tag)}
                      >
                        <Text style={[styles.chipText, selectedDietary.includes(tag) && styles.chipTextActive]}>
                          {selectedDietary.includes(tag) ? '✓ ' : ''}{tag}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {language === 'sw' ? 'Vizio vya Chakula (Mzio/Allergies)' : 'Allergies (Chef MUST explicitly acknowledge)'}
                  </Text>
                  <View style={styles.chipsRow}>
                    {ALLERGEN_OPTIONS.map((alg) => (
                      <TouchableOpacity
                        key={alg}
                        style={[
                          styles.chip,
                          selectedAllergens.includes(alg) && styles.chipWarning,
                        ]}
                        onPress={() => toggleAllergen(alg)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedAllergens.includes(alg) && styles.chipWarningText,
                          ]}
                        >
                          {selectedAllergens.includes(alg) ? '⚠️ ' : ''}{alg}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* STEP 4: Budget & Pricing */}
            {formStep === 4 && (
              <View style={styles.stepContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {language === 'sw' ? 'Aina ya Bajeti' : 'Budget Type'}
                  </Text>
                  <View style={styles.chipsRow}>
                    {(['FIXED', 'RANGE', 'OPEN_TO_QUOTES'] as BudgetType[]).map((bt) => (
                      <TouchableOpacity
                        key={bt}
                        style={[styles.chip, budgetType === bt && styles.chipActive]}
                        onPress={() => setBudgetType(bt)}
                      >
                        <Text style={[styles.chipText, budgetType === bt && styles.chipTextActive]}>
                          {bt === 'FIXED' ? (language === 'sw' ? 'Bajeti Kamili' : 'Fixed Target') : bt === 'RANGE' ? (language === 'sw' ? 'Kiwango cha Bajeti' : 'Budget Range') : (language === 'sw' ? 'Subiri Ofa za Wapishi' : 'Open to Quotes')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {budgetType === 'FIXED' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      {language === 'sw' ? 'Lengo la Bajeti (TZS) * (Kuanzia TZS 5,000)' : 'Target Budget (TZS) * (Min TZS 5,000)'}
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={budgetTzs}
                      onChangeText={setBudgetTzs}
                      keyboardType="numeric"
                      placeholder="20000"
                    />
                  </View>
                )}

                {budgetType === 'RANGE' && (
                  <View style={styles.rowTwoCols}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.sm }]}>
                      <Text style={styles.inputLabel}>
                        {language === 'sw' ? 'Kiwango cha Chini (TZS) *' : 'Min Budget (TZS) *'}
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        value={budgetTzs}
                        onChangeText={setBudgetTzs}
                        keyboardType="numeric"
                        placeholder="15000"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>
                        {language === 'sw' ? 'Kiwango cha Juu (TZS) *' : 'Max Budget (TZS) *'}
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        value={budgetMaxTzs}
                        onChangeText={setBudgetMaxTzs}
                        keyboardType="numeric"
                        placeholder="35000"
                      />
                    </View>
                  </View>
                )}

                {budgetType === 'OPEN_TO_QUOTES' && (
                  <View style={styles.openBudgetNotice}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.primaryDark} />
                    <Text style={styles.openBudgetText}>
                      {language === 'sw'
                        ? 'Wapishi na migahawa iliyothibitishwa watatuma makadirio na ofa zao kulingana na viungo na idadi ya watu. Utachagua ofa inayokufaa zaidi bila vikwazo vya bajeti.'
                        : 'No budget constraint specified. Verified partner kitchens will submit custom itemized proposals based on portions and ingredients. You review and select the best offer.'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* STEP 5: Delivery Location & Privacy */}
            {formStep === 5 && (
              <View style={styles.stepContainer}>
                {/* Privacy Guarantee Banner */}
                <View style={styles.privacyBanner}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: Spacing.xs }}>
                    <Text style={styles.privacyHeading}>
                      {language === 'sw' ? '🔒 Faragha ya Anwani Imehakikishwa' : '🔒 Delayed Exact Address Privacy'}
                    </Text>
                    <Text style={styles.privacyText}>
                      {language === 'sw'
                        ? 'Wapishi wanaona eneo lako kuu pekee (mf. Mikocheni B). Namba ya nyumba na simu yako vimefichwa kabisa hadi utakapochagua ofa ya mpishi.'
                        : 'Chefs only see your broad neighborhood (e.g. Mikocheni). Your house address and phone number remain completely hidden until you accept a quote.'}
                    </Text>
                  </View>
                </View>

                {/* Public Area & Landmark */}
                <View style={styles.rowTwoCols}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.sm }]}>
                    <Text style={styles.inputLabel}>
                      {language === 'sw' ? 'Eneo la Mtaa *' : 'Neighborhood Area *'}
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={customerArea}
                      onChangeText={setCustomerArea}
                      placeholder="e.g. Mikocheni B, Mtaa wa Chuo"
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>
                      {language === 'sw' ? 'Kituo / Alama ya Eneo' : 'Landmark (Visible to Chefs)'}
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={landmark}
                      onChangeText={setLandmark}
                      placeholder="Near Shoppers Plaza"
                    />
                  </View>
                </View>

                {/* Optional House / Street Address preview */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {language === 'sw' ? 'Anwani ya Nyumba (Hiari sasa; inathibitishwa wakati wa ofa)' : 'House / Street Address (Optional now; confirmed at quote acceptance)'}
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={exactAddress}
                    onChangeText={setExactAddress}
                    placeholder="House 42, Rose Garden Rd, Mikocheni B"
                  />
                </View>

                {/* Optional Phone preview */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {language === 'sw' ? 'Namba ya Simu ya Mawasiliano' : 'Contact Phone Number (Optional now)'}
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={exactPhone}
                    onChangeText={setExactPhone}
                    keyboardType="phone-pad"
                    placeholder="+255 712 345 678"
                  />
                </View>
              </View>
            )}

            {/* Wizard Navigation Footer */}
            <View style={styles.wizardFooterRow}>
              {formStep > 1 && (
                <TouchableOpacity
                  style={styles.wizardBackBtn}
                  onPress={() => setFormStep((prev) => (prev - 1) as any)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Back to previous step"
                >
                  <Ionicons name="arrow-back" size={16} color={colors.textPrimary} style={{ marginRight: 6 }} />
                  <Text style={styles.wizardBackBtnText}>
                    {language === 'sw' ? 'Nyuma' : 'Back'}
                  </Text>
                </TouchableOpacity>
              )}

              {formStep < 5 ? (
                <TouchableOpacity
                  style={styles.wizardNextBtn}
                  onPress={handleNextStep}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Continue to next step"
                >
                  <Text style={styles.wizardNextBtnText}>
                    {language === 'sw' ? 'Endelea' : 'Next Step'}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.white} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.wizardSubmitBtn, isSubmitting && styles.btnDisabled]}
                  onPress={handleSubmitRequest}
                  disabled={isSubmitting}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Submit meal request"
                >
                  <Text style={styles.wizardSubmitBtnText}>
                    {isSubmitting
                      ? (language === 'sw' ? 'Inatuma kwa Wapishi...' : 'Dispatching to Chefs...')
                      : (language === 'sw' ? 'Tuma Ombi la Chakula' : 'Submit Meal Request')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* TAB 2: CHEF QUOTES RECEIVED */}
        {activeTab === 'QUOTES' && (
          <View style={styles.quotesSection}>
            {isLoadingQuotes && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
            )}

            <View style={styles.quotesHeaderRow}>
              <Text style={styles.quotesEyebrow}>
                {quotes.length} Verified Kitchens Responded:
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (activeRequestId) {
                    setIsLoadingQuotes(true);
                    CustomMealRepository.listQuotesForRequest(activeRequestId)
                      .then(setQuotes)
                      .finally(() => setIsLoadingQuotes(false));
                  }
                }}
              >
                <Ionicons name="refresh" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {quotes.map((q) => {
              const isAccepted = q.status === 'ACCEPTED';
              const isSuperseded = q.status === 'SUPERSEDED';
              const subtotalVal = q.subtotalTzs || q.quotedPriceTzs || 0;
              const deliveryVal = q.deliveryFeeTzs || 0;
              const totalVal = q.totalTzs || q.amountTzs || 0;

              return (
                <View
                  key={q.id}
                  style={[
                    styles.quoteCard,
                    isAccepted && styles.quoteCardAccepted,
                    isSuperseded && styles.quoteCardSuperseded,
                  ]}
                >
                  <View style={styles.quoteCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.quoteRestaurantName}>
                        {q.restaurantName || 'Verified Kitchen'}
                      </Text>
                      {(q as any).restaurantRating ? (
                        <View style={styles.quoteRatingRow}>
                          <Text style={styles.quoteStar}>★ {(q as any).restaurantRating.toFixed(1)}</Text>
                          <Text style={styles.quoteReviews}>
                            • Rev v{q.revisionNumber || 1}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.quoteReviews}>
                          Revision v{q.revisionNumber || 1}
                        </Text>
                      )}
                    </View>

                    <Badge
                      label={q.status}
                      variant={
                        isAccepted
                          ? 'success'
                          : isSuperseded
                          ? 'neutral'
                          : 'info'
                      }
                      size="sm"
                    />
                  </View>

                  {/* Line Items Breakdown */}
                  {q.items && q.items.length > 0 && (
                    <View style={styles.lineItemsCard}>
                      <Text style={styles.lineItemsHeader}>Chef Quote Breakdown:</Text>
                      {q.items.map((it: any, idx: number) => (
                        <View key={idx} style={styles.lineItemRow}>
                          <Text style={styles.lineItemName}>
                            {it.quantity}x {it.name}
                          </Text>
                          <Text style={styles.lineItemPrice}>
                            TZS {(it.lineTotalTzs || it.unitPriceTzs * it.quantity).toLocaleString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Financial Breakdown */}
                  <View style={styles.pricingSummaryRow}>
                    <View>
                      <Text style={styles.subtotalText}>
                        Subtotal: TZS {subtotalVal.toLocaleString()} | Delivery: TZS {deliveryVal.toLocaleString()}
                      </Text>
                      <Text style={styles.grandTotalText}>
                        Grand Total: TZS {totalVal.toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {/* Chef Notes */}
                  {q.chefNotes || q.restaurantNote ? (
                    <Text style={styles.quoteMessage}>
                      "{q.chefNotes || q.restaurantNote}"
                    </Text>
                  ) : null}

                  <View style={styles.quoteFooter}>
                    <Text style={styles.prepTimeText}>
                      ⏱ Prep: ~{q.estimatedPrepMinutes} mins
                    </Text>

                    {isAccepted ? (
                      <View style={styles.acceptedPill}>
                        <Text style={styles.acceptedPillText}>✓ Quote Locked & Won</Text>
                      </View>
                    ) : isSuperseded ? (
                      <Text style={styles.supersededText}>Offer Expired</Text>
                    ) : (
                      <Button
                        title={isLockingQuote ? 'Locking...' : 'Accept Quote & Pay'}
                        onPress={() => handleSelectQuote(q)}
                        variant="primary"
                        size="sm"
                        disabled={isLockingQuote}
                      />
                    )}
                  </View>
                </View>
              );
            })}

            {quotes.length === 0 && !isLoadingQuotes && (
              <EmptyState
                title="No quotes received yet"
                message="Your meal request has been matched with qualified kitchens. Check back in a few minutes as chefs formulate offers."
                icon="flame-outline"
                actionTitle="Create Request"
                onAction={() => setActiveTab('REQUEST')}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Cart Button */}
      <FloatingCartButton />

      {/* Slide-in Cart Drawer */}
      <CartDrawer
        visible={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => setIsOrderReviewOpen(true)}
      />

      {/* Order Review & Placement Modal */}
      <OrderReviewModal
        visible={isOrderReviewOpen}
        onClose={() => setIsOrderReviewOpen(false)}
        onOrderConfirmed={(orderId) => {
          router.push({ pathname: '/(tabs)/orders', params: { orderId } });
        }}
      />

      {/* Custom Meal Quote Payment Modal */}
      {showPaymentModal && selectedQuoteForPayment && activeRequestId && (
        <PaymentCheckoutModal
          visible={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onPaymentSuccess={handlePaymentSuccess}
          restaurantName={selectedQuoteForPayment.restaurantName || 'Restaurant'}
          restaurantId={selectedQuoteForPayment.restaurantId}
          customMealRequestId={activeRequestId}
          quoteId={selectedQuoteForPayment.id}
          amountTzs={lockedTotalForPayment}
          paymentTypeOverride="CUSTOM_MEAL_FULL"
          title={language === 'sw' ? 'Malipo ya Chakula Maalum' : 'Custom Meal Payment'}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  largeScreenContainer: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: Spacing.md,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceInteractive,
    borderRadius: Radii.lg,
    padding: 4,
    marginBottom: Spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radii.md,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    ...Shadows.sm,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoSoft,
    padding: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.info,
    marginBottom: Spacing.md,
    gap: 8,
  },
  privacyText: {
    fontSize: 12,
    color: colors.info,
    flex: 1,
    lineHeight: 16,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: colors.surfaceInteractive,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  rowTwoCols: {
    flexDirection: 'row',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    backgroundColor: colors.surfaceInteractive,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipWarning: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
  chipWarningText: {
    color: colors.danger,
  },
  submitBtn: {
    marginTop: Spacing.md,
  },
  quotesSection: {
    gap: Spacing.md,
  },
  quotesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  quotesEyebrow: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  quoteCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    ...Shadows.sm,
  },
  quoteCardAccepted: {
    borderColor: '#10b981',
    borderWidth: 2,
    backgroundColor: colors.successSoft,
  },
  quoteCardSuperseded: {
    opacity: 0.6,
  },
  quoteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  quoteRestaurantName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  quoteRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  quoteStar: {
    fontSize: 12,
    color: '#eab308',
    fontWeight: '700',
  },
  quoteReviews: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  lineItemsCard: {
    backgroundColor: colors.surfaceInteractive,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  lineItemsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  lineItemName: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  lineItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pricingSummaryRow: {
    marginVertical: 4,
  },
  subtotalText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  grandTotalText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
  },
  quoteMessage: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginVertical: 6,
  },
  quoteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: Spacing.sm,
  },
  prepTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  acceptedPill: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  acceptedPillText: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 12,
  },
  supersededText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  wizardProgressTrack: {
    height: 4,
    backgroundColor: colors.divider,
    borderRadius: 2,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  wizardProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  wizardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  wizardStepBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  wizardStepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stepContainer: {
    marginBottom: Spacing.sm,
  },
  openBudgetNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.infoSoft,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: 8,
    marginTop: Spacing.xs,
  },
  openBudgetText: {
    flex: 1,
    fontSize: 13,
    color: colors.info,
    lineHeight: 18,
  },
  privacyHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  wizardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: Spacing.md,
  },
  wizardBackBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
  },
  wizardBackBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  wizardNextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: colors.primary,
  },
  wizardNextBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  wizardSubmitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: colors.primaryDark,
  },
  wizardSubmitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
let styles = createStyles(lightColors);
