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
import { CustomMealRepository } from '../../repositories/customMeals.repository';
import {
  CustomMealOccasion,
  BudgetType,
  SpiceLevel,
  CustomMealRequest,
  RestaurantQuote,
} from '../../types/domain';

const OCCASIONS: { id: CustomMealOccasion; label: string; labelSw: string }[] = [
  { id: 'PERSONAL', label: 'Personal / Daily', labelSw: 'Mlo Binafsi' },
  { id: 'FAMILY', label: 'Family Feast', labelSw: 'Sherehe ya Familia' },
  { id: 'OFFICE', label: 'Office Lunch', labelSw: 'Chakula cha Ofisi' },
  { id: 'EVENT', label: 'Formal Event', labelSw: 'Hafla Rasmi' },
  { id: 'PARTY', label: 'Celebration / Party', labelSw: 'Sherehe' },
  { id: 'OTHER', label: 'Other', labelSw: 'Nyingine' },
];

const SPICE_LEVELS: { id: SpiceLevel; label: string; emoji: string }[] = [
  { id: 'NONE', label: 'None', emoji: '🌱' },
  { id: 'MILD', label: 'Mild', emoji: '🥗' },
  { id: 'MEDIUM', label: 'Medium', emoji: '🌶️' },
  { id: 'HOT', label: 'Hot', emoji: '🌶️🌶️' },
  { id: 'EXTRA_HOT', label: 'Extra Hot', emoji: '🔥' },
];

const AVAILABLE_DIETARY: string[] = [
  'Halal',
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Keto',
  'Low-Sodium',
  'Nut-Free',
];

const AVAILABLE_ALLERGENS: string[] = [
  'Peanuts',
  'Tree Nuts',
  'Dairy',
  'Eggs',
  'Seafood / Fish',
  'Shellfish',
  'Wheat / Gluten',
  'Soy',
];

export default function CustomMealScreen() {
  const { t, language } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const { user } = useAuth();
  const { addToCart, isCartOpen, setIsCartOpen } = useCart();
  const [isOrderReviewOpen, setIsOrderReviewOpen] = useState(false);

  // Flow Step: 'REQUEST' | 'QUOTES'
  const [activeTab, setActiveTab] = useState<'REQUEST' | 'QUOTES'>('REQUEST');

  // Form Fields
  const [dishTitle, setDishTitle] = useState('');
  const [description, setDescription] = useState('');
  const [occasion, setOccasion] = useState<CustomMealOccasion>('PERSONAL');
  const [budgetTzs, setBudgetTzs] = useState('20000');
  const [budgetType, setBudgetType] = useState<BudgetType>('FIXED');
  const [servings, setServings] = useState('2');
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>('MEDIUM');
  const [selectedDietary, setSelectedDietary] = useState<string[]>(['Halal']);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [customerArea, setCustomerArea] = useState('Mikocheni');
  const [landmark, setLandmark] = useState('Near Shoppers Plaza');
  const [exactAddress, setExactAddress] = useState('House 42, Rose Garden Rd');
  const [exactPhone, setExactPhone] = useState('+255712345678');
  const [desiredTimeHours, setDesiredTimeHours] = useState('4');

  // Active Request & Quotes State
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<CustomMealRequest | null>(null);
  const [quotes, setQuotes] = useState<RestaurantQuote[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLockingQuote, setIsLockingQuote] = useState(false);

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

  const handleSubmitRequest = async () => {
    if (!dishTitle.trim()) {
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
      Alert.alert(
        language === 'sw' ? 'Eneo Linahitajika' : 'Area Required',
        language === 'sw'
          ? 'Tafadhali ingiza eneo lako (mf. Mikocheni, Sinza).'
          : 'Please enter your neighborhood area (e.g. Mikocheni, Sinza).'
      );
      return;
    }
    if (!exactAddress.trim() || !exactPhone.trim()) {
      Alert.alert(
        language === 'sw' ? 'Anwani na Simu Vinahitajika' : 'Exact Address & Phone Required',
        language === 'sw'
          ? 'Ingiza anwani kamili na namba ya simu. Hizi zitafichwa kwa wapishi hadi utakapolipa.'
          : 'Please enter exact address and phone. These remain strictly hidden from chefs until quote is accepted.'
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

    setIsSubmitting(true);
    try {
      const budgetNum = parseInt(budgetTzs.replace(/[^0-9]/g, ''), 10) || 20000;
      const servingsNum = parseInt(servings.replace(/[^0-9]/g, ''), 10) || 2;
      const hoursNum = parseFloat(desiredTimeHours) || 4;
      const desiredAt = new Date(Date.now() + hoursNum * 3600 * 1000).toISOString();

      const created = await CustomMealRepository.createRequest({
        customerId: user.id,
        dishName: dishTitle.trim(),
        occasion,
        servingsCount: String(servingsNum),
        budgetTzs: budgetNum,
        budgetType,
        spiceLevel,
        dietaryTags: selectedDietary,
        allergens: selectedAllergens,
        customerArea: customerArea.trim(),
        landmark: landmark.trim() || undefined,
        exactDeliveryAddress: exactAddress.trim(),
        exactDeliveryPhone: exactPhone.trim(),
        desiredAt,
        specialInstructions: description.trim() || undefined,
      });

      setActiveRequestId(created.id);
      setActiveRequest(created);
      setActiveTab('QUOTES');

      // Refresh quotes list
      const qList = await CustomMealRepository.listQuotesForRequest(created.id);
      setQuotes(qList);

      Alert.alert(
        language === 'sw' ? 'Ombi Limetumwa!' : 'Custom Request Dispatched!',
        language === 'sw'
          ? `Ombi lako (${created.orderNumber || created.id}) limepelekwa kwa wapishi 5 bora wanaofaa katika eneo lako. Utapokea ofa za bei muda mfupi ujao.`
          : `Your request (${created.orderNumber || created.id}) has been matched and dispatched to qualified local kitchens. Quotes will appear here.`
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
      const totalToDisplay = lockResult.grand_total_tzs || quote.totalTzs || quote.amountTzs;
      Alert.alert(
        language === 'sw' ? 'Ofa Imethibitishwa!' : 'Quote Selected!',
        language === 'sw'
          ? `Umechagua ofa ya ${quote.restaurantName || 'Mpishi'}. Jumla: TZS ${totalToDisplay.toLocaleString()}. Endelea kukamilisha malipo.`
          : `You selected ${quote.restaurantName || 'Chef'}'s offer. Total: TZS ${totalToDisplay.toLocaleString()}. Complete payment to confirm your order.`
      );
      // Reload quotes
      const qList = await CustomMealRepository.listQuotesForRequest(activeRequestId);
      setQuotes(qList);
    } catch (err: any) {
      Alert.alert('Selection Error', err?.message || 'Failed to select quote.');
    } finally {
      setIsLockingQuote(false);
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

        {/* TAB 1: MEAL REQUEST FORM */}
        {activeTab === 'REQUEST' && (
          <View style={styles.formCard}>
            {/* Privacy Guarantee Banner */}
            <View style={styles.privacyBanner}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
              <Text style={styles.privacyText}>
                {language === 'sw'
                  ? '🔒 Anwani na simu yako vimefichwa kwa wapishi hadi utakapochagua ofa na kulipa.'
                  : '🔒 Address Privacy: Your exact house address & phone remain strictly hidden from chefs until you select a winning quote.'}
              </Text>
            </View>

            {/* Dish Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Dish Name / Concept *</Text>
              <TextInput
                style={styles.textInput}
                value={dishTitle}
                onChangeText={setDishTitle}
                placeholder="e.g. Zanzibar Goat Biryani Pot with Salad & Raita"
              />
            </View>

            {/* Occasion */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Occasion</Text>
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

            {/* Budget & Servings */}
            <View style={styles.rowTwoCols}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.sm }]}>
                <Text style={styles.inputLabel}>Target Budget (TZS)</Text>
                <TextInput
                  style={styles.textInput}
                  value={budgetTzs}
                  onChangeText={setBudgetTzs}
                  keyboardType="numeric"
                  placeholder="20000"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Servings (People)</Text>
                <TextInput
                  style={styles.textInput}
                  value={servings}
                  onChangeText={setServings}
                  keyboardType="numeric"
                  placeholder="2"
                />
              </View>
            </View>

            {/* Budget Flexibility */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Budget Type</Text>
              <View style={styles.chipsRow}>
                {(['FIXED', 'RANGE', 'OPEN_TO_QUOTES'] as BudgetType[]).map((bt) => (
                  <TouchableOpacity
                    key={bt}
                    style={[styles.chip, budgetType === bt && styles.chipActive]}
                    onPress={() => setBudgetType(bt)}
                  >
                    <Text style={[styles.chipText, budgetType === bt && styles.chipTextActive]}>
                      {bt === 'FIXED' ? 'Fixed Target' : bt === 'RANGE' ? 'Budget Range' : 'Open to Quotes'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Spice Level */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Spice Preference</Text>
              <View style={styles.chipsRow}>
                {SPICE_LEVELS.map((sp) => (
                  <TouchableOpacity
                    key={sp.id}
                    style={[styles.chip, spiceLevel === sp.id && styles.chipActive]}
                    onPress={() => setSpiceLevel(sp.id)}
                  >
                    <Text style={[styles.chipText, spiceLevel === sp.id && styles.chipTextActive]}>
                      {sp.emoji} {sp.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Dietary Tags */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Dietary Preferences</Text>
              <View style={styles.chipsRow}>
                {AVAILABLE_DIETARY.map((tag) => (
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

            {/* Allergen Declarations */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Allergies (Chef MUST explicitly acknowledge)</Text>
              <View style={styles.chipsRow}>
                {AVAILABLE_ALLERGENS.map((alg) => (
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

            {/* Desired Lead Time */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Desired Preparation Lead Time (Hours from now)</Text>
              <TextInput
                style={styles.textInput}
                value={desiredTimeHours}
                onChangeText={setDesiredTimeHours}
                keyboardType="numeric"
                placeholder="4"
              />
            </View>

            {/* Delivery Neighborhood & Landmark (Public to Chefs) */}
            <View style={styles.rowTwoCols}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.sm }]}>
                <Text style={styles.inputLabel}>Neighborhood Area *</Text>
                <TextInput
                  style={styles.textInput}
                  value={customerArea}
                  onChangeText={setCustomerArea}
                  placeholder="e.g. Mikocheni B, Mtaa wa Chuo"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Landmark (Visible to Chefs)</Text>
                <TextInput
                  style={styles.textInput}
                  value={landmark}
                  onChangeText={setLandmark}
                  placeholder="Near Shoppers Plaza"
                />
              </View>
            </View>

            {/* Exact Address & Phone (Concealed until Quote Selection) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Exact Delivery Address * (Concealed until order confirmed)
              </Text>
              <TextInput
                style={styles.textInput}
                value={exactAddress}
                onChangeText={setExactAddress}
                placeholder="House 42, Rose Garden Rd, Mikocheni B"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Phone Number * (Concealed until order confirmed)
              </Text>
              <TextInput
                style={styles.textInput}
                value={exactPhone}
                onChangeText={setExactPhone}
                keyboardType="phone-pad"
                placeholder="+255 712 345 678"
              />
            </View>

            {/* Special Instructions */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Special Instructions & Preparation Notes</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                multiline={true}
                numberOfLines={3}
                placeholder="Include custom marinade, portioning preferences, or packaging requirements..."
              />
            </View>

            <Button
              title={isSubmitting ? 'Dispatching to Chefs...' : 'Submit Meal Request'}
              onPress={handleSubmitRequest}
              variant="primary"
              size="lg"
              fullWidth={true}
              disabled={isSubmitting}
              style={styles.submitBtn}
            />
          </View>
        )}

        {/* TAB 2: CHEF QUOTES RECEIVED */}
        {activeTab === 'QUOTES' && (
          <View style={styles.quotesSection}>
            {isLoadingQuotes && (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
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
                <Ionicons name="refresh" size={18} color={Colors.primary} />
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
        onOrderConfirmed={() => {}}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSecondary,
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
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: Spacing.md,
    gap: 8,
  },
  privacyText: {
    fontSize: 12,
    color: '#1e40af',
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
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
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
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipWarning: {
    backgroundColor: '#fef2f2',
    borderColor: '#f87171',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  chipTextActive: {
    color: Colors.white,
  },
  chipWarningText: {
    color: '#b91c1c',
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
    color: Colors.textPrimary,
  },
  quoteCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  quoteCardAccepted: {
    borderColor: '#10b981',
    borderWidth: 2,
    backgroundColor: '#f0fdf4',
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
    color: Colors.textPrimary,
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
    color: Colors.textSecondary,
  },
  lineItemsCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  lineItemsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
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
    color: Colors.textPrimary,
  },
  lineItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  pricingSummaryRow: {
    marginVertical: 4,
  },
  subtotalText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  grandTotalText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginTop: 2,
  },
  quoteMessage: {
    fontSize: 13,
    fontStyle: 'italic',
    color: Colors.textSecondary,
    marginVertical: 6,
  },
  quoteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.sm,
  },
  prepTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  acceptedPill: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  acceptedPillText: {
    color: '#065f46',
    fontWeight: '700',
    fontSize: 12,
  },
  supersededText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
  },
});
