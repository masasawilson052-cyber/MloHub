import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useMloHubDB } from '../../context/DbContext';
import { SPECIALIST_CATEGORIES } from '../../constants/data';
import { OrderPipelineService } from '../../services/OrderPipelineService';
import { RealtimeEventEngine, RealtimeEventPayload } from '../../db/realtime/eventEngine';
import { CustomMealRequestEntity, PaymentTransactionEntity } from '../../db';
import { PaymentCheckoutModal } from '../../components/PaymentCheckoutModal';

type OrderMode = 'order_ahead' | 'available_now';
type TargetSegment = 'solo' | 'family' | 'office';

export default function CustomMealScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { createCustomOrder, user } = useMloHubDB();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  // Form State
  const [orderMode, setOrderMode] = useState<OrderMode>('order_ahead');
  const [targetSegment, setTargetSegment] = useState<TargetSegment>('office');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('Mikocheni');
  const [selectedSpecialist, setSelectedSpecialist] = useState('biryani');
  const [scheduledTime, setScheduledTime] = useState('Tomorrow 1:00 PM');
  
  const [dishDescription, setDishDescription] = useState(
    'Authentic Zanzibar Spiced Beef Pilau & Biryani with grilled kachumbari, plantains, and fresh passion juice.'
  );
  const [servings, setServings] = useState('10');
  const [selectedDietaryTags, setSelectedDietaryTags] = useState<string[]>([
    'High Protein',
    'No Nuts',
    'Extra Vegetables',
  ]);
  const [spiceLevel, setSpiceLevel] = useState<'Mild' | 'Medium' | 'Spicy'>('Medium');

  const [submitted, setSubmitted] = useState(false);
  const [activeCreatedOrder, setActiveCreatedOrder] = useState<CustomMealRequestEntity | null>(null);
  const [acceptedBidId, setAcceptedBidId] = useState<string | null>(null);
  const [liveStatusUpdate, setLiveStatusUpdate] = useState<string | null>(null);
  const [receivedQuote, setReceivedQuote] = useState<{
    restaurantName: string;
    quotedPriceTzs: number;
    estimatedDeliveryTime: string;
    inclusions: string;
  } | null>(null);

  // Payment Checkout Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState<{ chefName: string; quoteTzs: number } | null>(null);

  // Real-time Customer Order Listener
  React.useEffect(() => {
    const userId = user?.id || 'usr-frank';
    const handleOrderEvent = (event: RealtimeEventPayload) => {
      if (event.eventType === 'ORDER_CONFIRMED') {
        const restName = event.data?.restaurantName || 'Mama Amina Biryani House';
        const prepTime = event.data?.prepTimeMinutes || 35;
        if (event.data?.order) {
          setActiveCreatedOrder(event.data.order);
        } else if (activeCreatedOrder) {
          setActiveCreatedOrder((prev) => prev ? { ...prev, status: 'Confirmed' } : null);
        }
        setLiveStatusUpdate(`Confirmed by ${restName}! Kitchen prep started (~${prepTime} mins).`);
        Alert.alert(
          language === 'sw' ? '🍲 Agizo Limethibitishwa!' : '🍲 Kitchen Confirmed Your Order!',
          language === 'sw'
            ? `${restName} amethibitisha agizo lako! Mapishi yameanza jikoni (dk ${prepTime}).`
            : `${restName} has confirmed and locked your order! Cooking prep started (~${prepTime} mins).`
        );
      } else if (event.eventType === 'QUOTE_OFFERED') {
        const restName = event.data?.restaurantName || 'Mama Amina Biryani House';
        const quote = event.data?.quote;
        if (quote) {
          setReceivedQuote({
            restaurantName: restName,
            quotedPriceTzs: quote.quotedPriceTzs,
            estimatedDeliveryTime: quote.estimatedDeliveryTime,
            inclusions: quote.inclusions,
          });
        }
        if (event.data?.order) {
          setActiveCreatedOrder(event.data.order);
        }
        setLiveStatusUpdate(`New Quote: TZS ${quote?.quotedPriceTzs?.toLocaleString()}`);
        Alert.alert(
          language === 'sw' ? '💡 Ofa Mpya ya Bei!' : '💡 New Chef Bid Received!',
          language === 'sw'
            ? `${restName} ametuma ofa ya TZS ${quote?.quotedPriceTzs?.toLocaleString()} kwa agizo lako!`
            : `${restName} quoted TZS ${quote?.quotedPriceTzs?.toLocaleString()} for your order!`
        );
      } else if (event.eventType === 'STATUS_UPDATED') {
        const status = event.data?.status;
        setLiveStatusUpdate(`Status: ${status}`);
        setActiveCreatedOrder((prev) => prev ? { ...prev, status } : null);
      }
    };

    const unsubDirect = OrderPipelineService.subscribeToCustomerOrders(userId, handleOrderEvent);
    const unsubWildcard = RealtimeEventEngine.subscribe('orders:customer:*', handleOrderEvent);
    const unsubAllOrders = RealtimeEventEngine.subscribe('orders:*', (evt: RealtimeEventPayload) => {
      if (activeCreatedOrder && evt.orderId === activeCreatedOrder.id) {
        handleOrderEvent(evt);
      }
    });

    return () => {
      unsubDirect();
      unsubWildcard();
      unsubAllOrders();
    };
  }, [user?.id, language, activeCreatedOrder?.id]);

  const dietaryOptions = [
    { id: 'High Protein', labelEn: '🥩 High Protein Cuts', labelSw: '🥩 Nyama Nyingi ya Protini' },
    { id: 'No Nuts', labelEn: '🥜 No Nuts / Peanut Oil', labelSw: '🥜 Bila Karanga / Mafuta Salama' },
    { id: 'Low Oil', labelEn: '🫒 Low Oil / Healthy Cook', labelSw: '🫒 Mafuta Kidogo / Mapishi Salama' },
    { id: 'Extra Vegetables', labelEn: '🥗 Extra Kachumbari & Greens', labelSw: '🥗 Kachumbari & Mboga za Ziada' },
    { id: 'Gluten-Free', labelEn: '🌾 Gluten-Free Grain', labelSw: '🌾 Nafaka Isiyo na Ngano' },
  ];

  const scheduleOptions = [
    { id: 'Tomorrow 1:00 PM', labelEn: '☀️ Tomorrow Lunch (1:00 PM)', labelSw: '☀️ Chakula cha Mchana Kesho (Saa 7:00 Mchana)' },
    { id: 'Tomorrow 7:30 PM', labelEn: '🌙 Tomorrow Dinner (7:30 PM)', labelSw: '🌙 Chakula cha Usiku Kesho (Saa 1:30 Usiku)' },
    { id: 'Tomorrow 8:00 AM', labelEn: '🌅 Tomorrow Breakfast (8:00 AM)', labelSw: '🌅 Kifungua Kinywa Kesho (Saa 2:00 Asubuhi)' },
    { id: 'Today in 45 min', labelEn: '⚡ Ready Today (in 45 mins)', labelSw: '⚡ Tayari Leo (ndani ya dk 45)' },
  ];

  const toggleDietaryTag = (tag: string) => {
    if (selectedDietaryTags.includes(tag)) {
      setSelectedDietaryTags(selectedDietaryTags.filter((t) => t !== tag));
    } else {
      setSelectedDietaryTags([...selectedDietaryTags, tag]);
    }
  };

  const handleApplyPreset = (segment: TargetSegment) => {
    setTargetSegment(segment);
    if (segment === 'office') {
      setServings('10');
      setSelectedNeighborhood('Mikocheni');
      setScheduledTime('Tomorrow 1:00 PM');
      setSelectedSpecialist('biryani');
      setDishDescription('Authentic Zanzibar Spiced Beef Pilau & Biryani with sweet plantains, tamarind kachumbari, and cold-pressed passion juice.');
    } else if (segment === 'solo') {
      setServings('1');
      setSelectedNeighborhood('Sinza');
      setScheduledTime('Tomorrow 7:30 PM');
      setSelectedSpecialist('mchemsho');
      setDishDescription('Kuku wa Kienyeji Mchemsho with sweet potatoes, simmered carrots, and fresh lemon ginger tea.');
    } else if (segment === 'family') {
      setServings('4');
      setSelectedNeighborhood('Oysterbay');
      setScheduledTime('Tomorrow 1:00 PM');
      setSelectedSpecialist('nyama_choma');
      setDishDescription('Charcoal-grilled goat ribs (1.5kg), chips mayai, ugali, and fresh avocado salad.');
    }
  };

  const handleSubmit = async () => {
    if (!dishDescription.trim()) {
      Alert.alert(language === 'sw' ? 'Tafadhali eleza chakula' : 'Please describe your meal request');
      return;
    }

    const created = await OrderPipelineService.submitCustomMealOrder({
      userId: user?.id || 'usr-frank',
      customerName: user?.fullName || 'Frank Mlaki',
      customerPhone: user?.phone || '+255 754 123 456',
      dishName: dishDescription,
      restaurantName: `Mama Amina Authentic Biryani`,
      targetRestaurantId: 'mama-amina-biryani',
      specialInstructions: `Time: ${scheduledTime} | Area: ${selectedNeighborhood} | Segment: ${targetSegment.toUpperCase()} | Dietary: ${selectedDietaryTags.join(', ')} | Spice: ${spiceLevel}`,
      budgetTzs: 0,
      servingsCount: servings,
      diningOption: 'Delivery',
      neighborhood: selectedNeighborhood,
    });

    setActiveCreatedOrder(created);
    setSubmitted(true);
  };

  const handleAcceptBid = (chefName: string, quoteTzs: number) => {
    setPendingCheckout({ chefName, quoteTzs });
    setShowCheckoutModal(true);
  };

  const handlePaymentSuccess = async (payment: PaymentTransactionEntity) => {
    const chefName = pendingCheckout?.chefName || 'Mama Amina';
    setAcceptedBidId(chefName);
    setShowCheckoutModal(false);

    if (activeCreatedOrder) {
      await OrderPipelineService.acceptAndConfirmOrder(
        activeCreatedOrder.id,
        'mama-amina-biryani',
        chefName,
        35
      );
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
        {/* HERO BANNER */}
        <View style={styles.banner}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {language === 'sw' ? '🎯 SOKO LA WATAALAMU WA VYAKULA' : '🎯 DEMAND-DRIVEN SPECIALIST MARKETPLACE'}
            </Text>
          </View>
          <Text style={styles.heading}>
            {language === 'sw'
              ? 'Agiza Chakula Unachotaka Mapema'
              : 'Demand-Driven Custom Food Engine'}
          </Text>
          <Text style={styles.subheading}>
            {language === 'sw'
              ? 'Taja unachotaka kula, eneo, muda (mfano: Chakula cha watu 10 kesho saa 7 Mchana Mikocheni), na wataalamu wa mapishi watatuma ofa za bei moja kwa moja.'
              : 'Specify your exact meal vision, time, and portions. Nearby verified food specialists prepare it fresh for on-time fulfillment.'}
          </Text>

          {/* MODE SELECTOR (Available Now vs Order Ahead) */}
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                orderMode === 'order_ahead' && styles.modeBtnActive,
              ]}
              onPress={() => setOrderMode('order_ahead')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="calendar"
                size={16}
                color={orderMode === 'order_ahead' ? '#ffffff' : Colors.primaryDark}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  orderMode === 'order_ahead' && styles.modeBtnTextActive,
                ]}
              >
                {language === 'sw' ? '🗓️ Agiza Mapema (Zero-Waste)' : '🗓️ Order Ahead (Zero-Waste)'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeBtn,
                orderMode === 'available_now' && styles.modeBtnActive,
              ]}
              onPress={() => setOrderMode('available_now')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="flash"
                size={16}
                color={orderMode === 'available_now' ? '#ffffff' : Colors.primaryDark}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  orderMode === 'available_now' && styles.modeBtnTextActive,
                ]}
              >
                {language === 'sw' ? '⚡ Tayari Sasa' : '⚡ Available Now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {!submitted ? (
          <View style={styles.formContainer}>
            {/* 1. PRESET USE CASE SELECTOR */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeading}>
                {language === 'sw' ? '1. Chagua Aina ya Agizo' : '1. Select Order Persona / Use-Case'}
              </Text>
              <View style={styles.segmentGrid}>
                <TouchableOpacity
                  style={[
                    styles.segmentCard,
                    targetSegment === 'office' && styles.segmentCardActive,
                  ]}
                  onPress={() => handleApplyPreset('office')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.segmentIcon}>🏢</Text>
                  <Text style={[styles.segmentTitle, targetSegment === 'office' && styles.segmentTitleActive]}>
                    {language === 'sw' ? 'Ofisi / Kikundi' : 'Office / Group'}
                  </Text>
                  <Text style={styles.segmentSub}>
                    {language === 'sw' ? 'Watu 6–30+ (Mikutano)' : '6–30+ people (Workshops)'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentCard,
                    targetSegment === 'solo' && styles.segmentCardActive,
                  ]}
                  onPress={() => handleApplyPreset('solo')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.segmentIcon}>👤</Text>
                  <Text style={[styles.segmentTitle, targetSegment === 'solo' && styles.segmentTitleActive]}>
                    {language === 'sw' ? 'Mtu Mmoja' : 'Solo / Bachelor'}
                  </Text>
                  <Text style={styles.segmentSub}>
                    {language === 'sw' ? 'Mlo wa nyumbani' : 'Daily home-style meal'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentCard,
                    targetSegment === 'family' && styles.segmentCardActive,
                  ]}
                  onPress={() => handleApplyPreset('family')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.segmentIcon}>👥</Text>
                  <Text style={[styles.segmentTitle, targetSegment === 'family' && styles.segmentTitleActive]}>
                    {language === 'sw' ? 'Familia' : 'Family / Feast'}
                  </Text>
                  <Text style={styles.segmentSub}>
                    {language === 'sw' ? 'Watu 2–5 (Wikiendi)' : '2–5 people (Weekend)'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. SCHEDULE TIMING */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeading}>
                {language === 'sw' ? '2. Ratiba ya Kufikishwa' : '2. Fulfillment Schedule Window'}
              </Text>
              <View style={styles.scheduleRow}>
                {scheduleOptions.map((opt) => {
                  const isSelected = scheduledTime === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.schedulePill, isSelected && styles.schedulePillActive]}
                      onPress={() => setScheduledTime(opt.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.scheduleText, isSelected && styles.scheduleTextActive]}>
                        {language === 'sw' ? opt.labelSw : opt.labelEn}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. SPECIALIST & LOCATION TARGETING */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeading}>
                {language === 'sw' ? '3. Eneo na Mtaalamu wa Mapishi' : '3. Delivery Area & Food Specialist'}
              </Text>

              <Text style={styles.fieldSubLabel}>
                {language === 'sw' ? '📍 Chagua Mtaa / Eneo:' : '📍 Target Neighborhood:'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                {['Mikocheni', 'Oysterbay', 'Masaki', 'Sinza', 'City Centre'].map((loc) => {
                  const isSelected = selectedNeighborhood === loc;
                  return (
                    <TouchableOpacity
                      key={loc}
                      style={[styles.areaChip, isSelected && styles.areaChipActive]}
                      onPress={() => setSelectedNeighborhood(loc)}
                    >
                      <Text style={[styles.areaChipText, isSelected && styles.areaChipTextActive]}>
                        📍 {loc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.fieldSubLabel, { marginTop: 12 }]}>
                {language === 'sw' ? '👨‍🍳 Aina ya Mtaalamu Unayemtaka:' : '👨‍🍳 Preferred Specialist Category:'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                {SPECIALIST_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => {
                  const isSelected = selectedSpecialist === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.specialistChip, isSelected && styles.specialistChipActive]}
                      onPress={() => setSelectedSpecialist(cat.id)}
                    >
                      <Text style={styles.specialistChipEmoji}>{cat.emoji}</Text>
                      <Text
                        style={[
                          styles.specialistChipText,
                          isSelected && styles.specialistChipTextActive,
                        ]}
                      >
                        {language === 'sw' ? cat.nameSw : cat.nameEn}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 4. MEAL DETAILS & DIETARY PREFERENCES */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeading}>
                {language === 'sw' ? '4. Maelezo ya Chakula na Viungo' : '4. Meal Vision & Dietary Preferences'}
              </Text>

              <Text style={styles.fieldSubLabel}>
                {language === 'sw' ? 'Eleza mlo unaoutamani kwa usahihi:' : 'Describe your custom dish:'}
              </Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={3}
                value={dishDescription}
                onChangeText={setDishDescription}
                placeholder="e.g. 10 portions of Zanzibar Beef Pilau with fresh passion juice for our Mikocheni office workshop."
              />

              <Text style={[styles.fieldSubLabel, { marginTop: 10 }]}>
                {language === 'sw' ? 'Vigezo Maalum vya Afya na Mapishi:' : 'Dietary & Cooking Instructions:'}
              </Text>
              <View style={styles.dietaryWrap}>
                {dietaryOptions.map((opt) => {
                  const isSelected = selectedDietaryTags.includes(opt.id);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.dietaryChip, isSelected && styles.dietaryChipActive]}
                      onPress={() => toggleDietaryTag(opt.id)}
                    >
                      <Text style={[styles.dietaryChipText, isSelected && styles.dietaryChipTextActive]}>
                        {language === 'sw' ? opt.labelSw : opt.labelEn}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 5. PORTIONS / NUMBER OF PEOPLE */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeading}>
                {language === 'sw' ? '5. Idadi ya Walaji (Watu)' : '5. Portions / Number of People'}
              </Text>

              <View style={styles.portionsBox}>
                <Text style={styles.fieldSubLabel}>
                  {language === 'sw' ? 'Idadi ya Watu / Sahani zitakazopikwa:' : 'Portions (People / Plates):'}
                </Text>
                <View style={styles.portionsInputWrap}>
                  <TextInput
                    style={styles.portionsInput}
                    keyboardType="numeric"
                    value={servings}
                    onChangeText={setServings}
                    placeholder="10"
                  />
                  <View style={styles.portionsBadge}>
                    <Text style={styles.portionsBadgeText}>
                      {language === 'sw' ? 'Walaji' : 'People'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.portionsInfoText}>
                  {language === 'sw'
                    ? '✨ Wataalamu wa mapishi watapokea idadi ya watu na kutuma ofa ya bei moja kwa moja.'
                    : '✨ Specialist restaurants will review your portions and submit custom price quotes.'}
                </Text>
              </View>

              {/* BROADCAST CTA BUTTON */}
              <TouchableOpacity
                style={styles.broadcastBtn}
                onPress={handleSubmit}
                activeOpacity={0.88}
              >
                <Ionicons name="megaphone" size={18} color="#ffffff" />
                <Text style={styles.broadcastBtnText}>
                  {language === 'sw'
                    ? `Tuma Ombi kwa Wataalamu wa ${selectedNeighborhood} →`
                    : `Broadcast Request to ${selectedNeighborhood} Specialists →`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* LIVE SPECIALIST BIDS & QUOTATIONS FEED */
          <View style={styles.bidsContainer}>
            <View style={styles.bidsHeader}>
              <Text style={styles.bidsSuccessIcon}>🎉</Text>
              <Text style={styles.bidsSuccessTitle}>
                {language === 'sw' ? 'Ombi Limerushwa kwa Wataalamu!' : 'Broadcast Live to Rated Specialists!'}
              </Text>
              <Text style={styles.bidsSuccessSub}>
                {language === 'sw'
                  ? `Wataalamu walioidhinishwa eneo la ${selectedNeighborhood} wamepokea ombi lako la watu ${servings} (${scheduledTime}).`
                  : `Verified specialists in ${selectedNeighborhood} received your request for ${servings} people (${scheduledTime}).`}
              </Text>
            </View>

            {/* REAL-TIME ORDER STATUS TRACKER CARD */}
            {activeCreatedOrder && (
              <View style={[styles.bidCard, { borderColor: '#113a26', backgroundColor: '#f5faf6' }]}>
                <View style={styles.bidTopRow}>
                  <View>
                    <Text style={styles.bidChefName}>📋 Order #{activeCreatedOrder.orderNumber}</Text>
                    <Text style={styles.bidSpecialtyBadge}>
                      {activeCreatedOrder.dishName.slice(0, 50)}...
                    </Text>
                    <Text style={styles.bidArea}>
                      👥 {activeCreatedOrder.servingsCount} People • 📍 {selectedNeighborhood}
                    </Text>
                  </View>
                  <View style={[
                    styles.portionsBadge,
                    { backgroundColor: activeCreatedOrder.status === 'Confirmed' || activeCreatedOrder.status === 'Cooking' ? '#113a26' : '#fef3c7' }
                  ]}>
                    <Text style={[
                      styles.portionsBadgeText,
                      { color: activeCreatedOrder.status === 'Confirmed' || activeCreatedOrder.status === 'Cooking' ? '#ffffff' : '#92400e' }
                    ]}>
                      {activeCreatedOrder.status}
                    </Text>
                  </View>
                </View>

                {liveStatusUpdate ? (
                  <View style={{ backgroundColor: '#eaf4ed', padding: 8, borderRadius: Radii.md, marginTop: 8 }}>
                    <Text style={{ fontSize: 11, color: '#113a26', fontWeight: '800' }}>
                      ⚡ Live Status: {liveStatusUpdate}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* DYNAMIC REAL-TIME QUOTE FROM CHEF (IF RECEIVED) */}
            {receivedQuote && (
              <View style={[styles.bidCard, { borderColor: '#e8c468', borderWidth: 2, backgroundColor: '#fffdf5' }]}>
                <View style={styles.bidTopRow}>
                  <View>
                    <Text style={styles.bidChefName}>👑 {receivedQuote.restaurantName} (Live Bid)</Text>
                    <Text style={styles.bidSpecialtyBadge}>⭐ Direct Kitchen Quotation</Text>
                    <Text style={styles.bidArea}>⏰ Delivery: {receivedQuote.estimatedDeliveryTime}</Text>
                  </View>
                  <Text style={[styles.bidPrice, { color: '#113a26', fontSize: 16 }]}>
                    TZS {receivedQuote.quotedPriceTzs.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.bidDetailsBox}>
                  <Text style={styles.bidMenuTitle}>Chef's Inclusions & Guarantee:</Text>
                  <Text style={styles.bidMenuItem}>• {receivedQuote.inclusions}</Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.acceptBidBtn,
                    acceptedBidId === receivedQuote.restaurantName && styles.acceptBidBtnDone,
                  ]}
                  onPress={() => handleAcceptBid(receivedQuote.restaurantName, receivedQuote.quotedPriceTzs)}
                  disabled={acceptedBidId === receivedQuote.restaurantName}
                >
                  <Text style={styles.acceptBidBtnText}>
                    {acceptedBidId === receivedQuote.restaurantName
                      ? '✓ Live Quote Accepted & Locked'
                      : `Accept Chef's Quote (TZS ${receivedQuote.quotedPriceTzs.toLocaleString()}) →`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.quotesSectionTitle}>
              {language === 'sw' ? 'Ofa za Wapishi Zilizoingia:' : 'Incoming Specialist Bids:'}
            </Text>

            {/* BID 1: MAMA AMINA */}
            <View style={[styles.bidCard, acceptedBidId === 'Mama Amina' && styles.bidCardAccepted]}>
              <View style={styles.bidTopRow}>
                <View>
                  <Text style={styles.bidChefName}>👑 Mama Amina Swahili Kitchen</Text>
                  <Text style={styles.bidSpecialtyBadge}>👑 Swahili Pilau Master • 4.9★ (640 reviews)</Text>
                  <Text style={styles.bidArea}>📍 Mikocheni B • 0.8 km</Text>
                </View>
                <Text style={styles.bidPrice}>TZS 110,000</Text>
              </View>

              <View style={styles.bidDetailsBox}>
                <Text style={styles.bidMenuTitle}>Proposed Menu & Inclusions:</Text>
                <Text style={styles.bidMenuItem}>• 10x Slow-Cooked Zanzibar Beef Pilau (Individual boxes)</Text>
                <Text style={styles.bidMenuItem}>• Fresh Tamarind Kachumbari & Fried Sweet Plantains</Text>
                <Text style={styles.bidMenuItem}>• 10x Cold-Pressed Passion Ginger Juice (500ml)</Text>
                <Text style={styles.bidMenuItem}>• Delivery guaranteed by 12:45 PM in Mikocheni</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.acceptBidBtn,
                  acceptedBidId === 'Mama Amina' && styles.acceptBidBtnDone,
                ]}
                onPress={() => handleAcceptBid('Mama Amina', 110000)}
                disabled={acceptedBidId === 'Mama Amina'}
              >
                <Text style={styles.acceptBidBtnText}>
                  {acceptedBidId === 'Mama Amina'
                    ? '✓ Bid Accepted (Preparing Batch)'
                    : 'Accept Mama Amina\'s Bid (TZS 110,000) →'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* BID 2: SPICE BOWL */}
            <View style={[styles.bidCard, acceptedBidId === 'Spice Bowl' && styles.bidCardAccepted]}>
              <View style={styles.bidTopRow}>
                <View>
                  <Text style={styles.bidChefName}>🍲 Kibo Mchemsho & Supu Hub</Text>
                  <Text style={styles.bidSpecialtyBadge}>🍲 Traditional Food Specialist • 4.8★</Text>
                  <Text style={styles.bidArea}>📍 Sinza / Mikocheni • 1.2 km</Text>
                </View>
                <Text style={styles.bidPrice}>TZS 125,000</Text>
              </View>

              <View style={styles.bidDetailsBox}>
                <Text style={styles.bidMenuTitle}>Proposed Menu:</Text>
                <Text style={styles.bidMenuItem}>• 10x Kuku Kienyeji Simmered Portions + Spiced Rice</Text>
                <Text style={styles.bidMenuItem}>• Delivery at 1:00 PM</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.acceptBidBtn,
                  acceptedBidId === 'Spice Bowl' && styles.acceptBidBtnDone,
                ]}
                onPress={() => handleAcceptBid('Spice Bowl', 125000)}
                disabled={acceptedBidId === 'Spice Bowl'}
              >
                <Text style={styles.acceptBidBtnText}>
                  {acceptedBidId === 'Spice Bowl'
                    ? '✓ Bid Accepted'
                    : 'Accept Kibo Hub\'s Bid (TZS 125,000) →'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.newRequestBtn}
              onPress={() => {
                setSubmitted(false);
                setAcceptedBidId(null);
              }}
            >
              <Text style={styles.newRequestBtnText}>
                {language === 'sw' ? 'Tengeneza Ombi Jingine' : 'Submit Another Demand Request'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ONLINE PAYMENT CHECKOUT MODAL */}
      <PaymentCheckoutModal
        visible={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
        restaurantName="Mama Amina Authentic Biryani"
        restaurantId="mama-amina-biryani"
        orderId={activeCreatedOrder?.id || undefined}
        amountTzs={pendingCheckout?.quoteTzs || 110000}
        itemDescription={activeCreatedOrder?.dishName || dishDescription}
        deliveryFee={0}
        serviceFee={1500}
        title={language === 'sw' ? 'Malipo ya Mlo Maalum' : 'Custom Meal Checkout'}
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
    paddingBottom: 40,
  },
  largeScreenContainer: {
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  banner: {
    backgroundColor: '#113a26',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8c468',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
    marginBottom: Spacing.sm,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#113a26',
    letterSpacing: 0.5,
  },
  heading: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.white,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    lineHeight: 30,
    marginBottom: Spacing.xs,
  },
  subheading: {
    fontSize: 12,
    color: '#d1e0d7',
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: Radii.xl,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: Radii.lg,
  },
  modeBtnActive: {
    backgroundColor: '#1d6637',
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b7d5c3',
  },
  modeBtnTextActive: {
    color: Colors.white,
    fontWeight: '900',
  },
  formContainer: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  sectionBox: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xxl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '900',
    color: '#113a26',
    marginBottom: Spacing.md,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  segmentGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radii.xl,
    padding: 10,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentCardActive: {
    borderColor: '#113a26',
    backgroundColor: '#eaf4ed',
  },
  segmentIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  segmentTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  segmentTitleActive: {
    color: '#113a26',
    fontWeight: '900',
  },
  segmentSub: {
    fontSize: 8.5,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: 2,
  },
  scheduleRow: {
    gap: 6,
  },
  schedulePill: {
    backgroundColor: Colors.background,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  schedulePillActive: {
    backgroundColor: '#113a26',
    borderColor: '#113a26',
  },
  scheduleText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text,
  },
  scheduleTextActive: {
    color: Colors.white,
  },
  fieldSubLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.muted,
    marginBottom: 6,
  },
  chipsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  areaChip: {
    backgroundColor: Colors.background,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  areaChipActive: {
    backgroundColor: '#113a26',
    borderColor: '#113a26',
  },
  areaChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text,
  },
  areaChipTextActive: {
    color: Colors.white,
  },
  specialistChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  specialistChipActive: {
    backgroundColor: '#113a26',
    borderColor: '#113a26',
  },
  specialistChipEmoji: {
    fontSize: 12,
  },
  specialistChipText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.text,
  },
  specialistChipTextActive: {
    color: '#e8c468',
  },
  textArea: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    padding: 10,
    fontSize: 12,
    color: Colors.text,
    textAlignVertical: 'top',
    minHeight: 65,
  },
  dietaryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  dietaryChip: {
    backgroundColor: Colors.background,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  dietaryChipActive: {
    backgroundColor: '#113a26',
    borderColor: '#113a26',
  },
  dietaryChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.text,
  },
  dietaryChipTextActive: {
    color: Colors.white,
  },
  portionsBox: {
    gap: 8,
  },
  portionsInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    overflow: 'hidden',
  },
  portionsInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  portionsBadge: {
    backgroundColor: '#eaf4ed',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  portionsBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#113a26',
  },
  portionsInfoText: {
    fontSize: 11,
    color: Colors.muted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  broadcastBtn: {
    backgroundColor: '#113a26',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radii.xl,
    marginTop: 16,
    ...Shadows.md,
  },
  broadcastBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  bidsContainer: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  bidsHeader: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  bidsSuccessIcon: {
    fontSize: 36,
    marginBottom: 4,
  },
  bidsSuccessTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#113a26',
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    textAlign: 'center',
  },
  bidsSuccessSub: {
    fontSize: 11.5,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  quotesSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#113a26',
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    marginTop: 4,
  },
  bidCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xxl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  bidCardAccepted: {
    borderColor: '#1d6637',
    backgroundColor: '#f5faf6',
  },
  bidTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bidChefName: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.text,
  },
  bidSpecialtyBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400e',
    marginTop: 1,
  },
  bidArea: {
    fontSize: 10,
    color: Colors.muted,
    marginTop: 1,
  },
  bidPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#113a26',
  },
  bidDetailsBox: {
    backgroundColor: Colors.background,
    borderRadius: Radii.lg,
    padding: 8,
    marginVertical: 10,
  },
  bidMenuTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  bidMenuItem: {
    fontSize: 10,
    color: Colors.muted,
    lineHeight: 14,
  },
  acceptBidBtn: {
    backgroundColor: '#113a26',
    paddingVertical: 10,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBidBtnDone: {
    backgroundColor: '#1d6637',
  },
  acceptBidBtnText: {
    color: Colors.white,
    fontSize: 11.5,
    fontWeight: '900',
  },
  newRequestBtn: {
    backgroundColor: Colors.primaryMuted,
    paddingVertical: 12,
    borderRadius: Radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  newRequestBtnText: {
    color: '#113a26',
    fontSize: 12,
    fontWeight: '800',
  },
});
