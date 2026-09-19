import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Restaurant, ReservationSlot, AreaPreference } from '../types/domain';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ReservationRepository } from '../repositories/reservations.repository';
import { BranchRepository } from '../repositories/branches.repository';
import { PaymentCheckoutModal } from './PaymentCheckoutModal';
import { PaymentTransactionEntity } from '../db/types';

interface ReservationModalProps {
  visible: boolean;
  restaurant: Restaurant | null;
  onClose: () => void;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  visible,
  restaurant,
  onClose,
}) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [guests, setGuests] = useState('2');
  const [dateStr, setDateStr] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [dateLabel, setDateLabel] = useState<string>('Today');
  const [availableSlots, setAvailableSlots] = useState<ReservationSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<ReservationSlot | null>(null);
  const [areaPref, setAreaPref] = useState<AreaPreference>('ANY');
  const [specialRequests, setSpecialRequests] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [confirmed, setConfirmed] = useState(false);
  const [createdReference, setCreatedReference] = useState<string | null>(null);
  const [createdReservationId, setCreatedReservationId] = useState<string | null>(null);
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paidPayment, setPaidPayment] = useState<PaymentTransactionEntity | null>(null);

  // Load branches when restaurant opens
  useEffect(() => {
    if (!restaurant?.id || !visible) return;

    BranchRepository.listByRestaurant(restaurant.id)
      .then((brList) => {
        setBranches(brList);
        if (brList.length > 0) {
          setSelectedBranchId(brList[0].id);
        }
      })
      .catch((err) => console.error('Failed to load branches', err));
  }, [restaurant?.id, visible]);

  // Query server availability whenever branch, date, or guests change
  useEffect(() => {
    if (!restaurant?.id || !selectedBranchId || !visible) return;

    const numGuests = Math.max(1, parseInt(guests.replace('+', ''), 10) || 2);
    setLoadingSlots(true);
    setSelectedSlot(null);

    ReservationRepository.getAvailability({
      restaurantId: restaurant.id,
      branchId: selectedBranchId,
      date: dateStr,
      partySize: numGuests,
    })
      .then((slots) => {
        setAvailableSlots(slots);
        const firstAvail = slots.find((s) => s.isAvailable);
        if (firstAvail) setSelectedSlot(firstAvail);
      })
      .catch((err) => {
        console.error('Availability check error', err);
        setAvailableSlots([]);
      })
      .finally(() => setLoadingSlots(false));
  }, [restaurant?.id, selectedBranchId, dateStr, guests, visible]);

  if (!restaurant) return null;

  const handleDateSelect = (offsetDays: number, label: string) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setDateStr(d.toISOString().split('T')[0]);
    setDateLabel(label);
  };

  const handleProceed = async () => {
    if (!user?.id) {
      Alert.alert(
        language === 'sw' ? 'Ingia Kwanza' : 'Sign In Required',
        language === 'sw'
          ? 'Tafadhali ingia au jisajili ili kukamilisha uhifadhi wa meza.'
          : 'Please sign in or register to complete your table reservation.'
      );
      return;
    }

    if (!selectedBranchId || !selectedSlot) {
      Alert.alert(
        language === 'sw' ? 'Chagua Muda' : 'Select Time Slot',
        language === 'sw' ? 'Tafadhali chagua muda unaopatikana.' : 'Please select an available time slot.'
      );
      return;
    }

    const numGuests = Math.max(1, parseInt(guests.replace('+', ''), 10) || 2);
    setSubmitting(true);

    try {
      const result = await ReservationRepository.createSecure({
        restaurantId: restaurant.id,
        branchId: selectedBranchId,
        scheduledAt: selectedSlot.slotStart,
        partySize: numGuests,
        areaPreference: areaPref,
        specialRequests: specialRequests || undefined,
      });

      setCreatedReservationId(result.reservationId);
      setCreatedReference(result.reference);
      setDepositRequired(result.depositRequired);
      setDepositAmount(result.depositAmountTzs);

      if (result.depositRequired && result.depositAmountTzs > 0) {
        setShowCheckoutModal(true);
      } else {
        setConfirmed(true);
      }
    } catch (e: any) {
      console.error('Reservation creation error', e);
      Alert.alert('Reservation Error', e?.message || 'Failed to create reservation');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = (payment: PaymentTransactionEntity) => {
    setPaidPayment(payment);
    setShowCheckoutModal(false);
    setConfirmed(true);
  };

  const handleClose = () => {
    setConfirmed(false);
    setShowCheckoutModal(false);
    setCreatedReservationId(null);
    setCreatedReference(null);
    setPaidPayment(null);
    onClose();
  };

  const formatSlotTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return isoString;
    }
  };

  return (
    <>
      <Modal visible={visible && !showCheckoutModal} transparent animationType="fade" onRequestClose={handleClose}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>

            {!confirmed ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.tagWrap}>
                  <Text style={styles.tagText}>🪑 {t('tableReservationTitle').toUpperCase()}</Text>
                </View>

                <Text style={styles.title}>{t('tableReservationTitle')}</Text>
                <Text style={styles.subtitle}>
                  {restaurant.name}
                </Text>

                {/* Branch Selector if multiple branches */}
                {branches.length > 1 && (
                  <View style={{ marginBottom: Spacing.sm }}>
                    <Text style={styles.label}>{language === 'sw' ? 'Tawi la Mgahawa' : 'Branch Location'}</Text>
                    <View style={styles.pillRow}>
                      {branches.map((b) => (
                        <TouchableOpacity
                          key={b.id}
                          style={[styles.pill, selectedBranchId === b.id && styles.pillActive]}
                          onPress={() => setSelectedBranchId(b.id)}
                        >
                          <Text style={[styles.pillText, selectedBranchId === b.id && styles.pillTextActive]}>
                            {b.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Guest Selector */}
                <Text style={styles.label}>{t('numGuestsLabel')}</Text>
                <View style={styles.pillRow}>
                  {['1', '2', '4', '6', '8+'].map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.pill, guests === g && styles.pillActive]}
                      onPress={() => setGuests(g)}
                    >
                      <Text style={[styles.pillText, guests === g && styles.pillTextActive]}>
                        {g} {language === 'sw' ? (g === '1' ? 'Mgeni' : 'Wageni') : (g === '1' ? 'Guest' : 'Guests')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Date Selector */}
                <Text style={styles.label}>{t('dateLabel')}</Text>
                <View style={styles.pillRow}>
                  <TouchableOpacity
                    style={[styles.pill, dateLabel === 'Today' && styles.pillActive]}
                    onPress={() => handleDateSelect(0, 'Today')}
                  >
                    <Text style={[styles.pillText, dateLabel === 'Today' && styles.pillTextActive]}>
                      {language === 'sw' ? 'Leo' : 'Today'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pill, dateLabel === 'Tomorrow' && styles.pillActive]}
                    onPress={() => handleDateSelect(1, 'Tomorrow')}
                  >
                    <Text style={[styles.pillText, dateLabel === 'Tomorrow' && styles.pillTextActive]}>
                      {language === 'sw' ? 'Kesho' : 'Tomorrow'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pill, dateLabel === '+2 Days' && styles.pillActive]}
                    onPress={() => handleDateSelect(2, '+2 Days')}
                  >
                    <Text style={[styles.pillText, dateLabel === '+2 Days' && styles.pillTextActive]}>
                      {language === 'sw' ? 'Keshokutwa' : '+2 Days'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Area Preference */}
                <Text style={styles.label}>{language === 'sw' ? 'Eneo la Meza (Hiari)' : 'Seating Area Preference'}</Text>
                <View style={styles.pillRow}>
                  {(['ANY', 'INDOOR', 'OUTDOOR', 'WINDOW', 'QUIET'] as AreaPreference[]).map((pref) => (
                    <TouchableOpacity
                      key={pref}
                      style={[styles.pill, areaPref === pref && styles.pillActive]}
                      onPress={() => setAreaPref(pref)}
                    >
                      <Text style={[styles.pillText, areaPref === pref && styles.pillTextActive]}>
                        {pref}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Server-calculated Available Slots */}
                <Text style={styles.label}>{language === 'sw' ? 'Muda Unaopatikana' : 'Available Time Slots'}</Text>
                {loadingSlots ? (
                  <View style={{ padding: Spacing.md, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                  </View>
                ) : availableSlots.length === 0 ? (
                  <Text style={{ fontSize: 12, color: Colors.muted, marginVertical: Spacing.xs }}>
                    {language === 'sw' ? 'Hakuna meza zilizopo kwa tarehe hii.' : 'No available slots for this date/party size.'}
                  </Text>
                ) : (
                  <View style={styles.pillRow}>
                    {availableSlots.map((slot) => {
                      const isSelected = selectedSlot?.slotStart === slot.slotStart;
                      return (
                        <TouchableOpacity
                          key={slot.slotStart}
                          disabled={!slot.isAvailable}
                          style={[
                            styles.pill,
                            isSelected && styles.pillActive,
                            !slot.isAvailable && { backgroundColor: '#f1f1f1', opacity: 0.5 },
                          ]}
                          onPress={() => setSelectedSlot(slot)}
                        >
                          <Text
                            style={[
                              styles.pillText,
                              isSelected && styles.pillTextActive,
                              !slot.isAvailable && { color: '#999' },
                            ]}
                          >
                            {formatSlotTime(slot.slotStart)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Deposit Notice Box */}
                {selectedSlot && (
                  <View style={styles.depositNoticeBox}>
                    <View style={styles.depositNoticeRow}>
                      <Text style={styles.depositNoticeTitle}>
                        {selectedSlot.depositRequired
                          ? (language === 'sw' ? 'Amana ya Meza Inahitajika:' : 'Table Deposit Required:')
                          : (language === 'sw' ? 'Hakuna Amana Inayohitajika' : 'No Deposit Required')}
                      </Text>
                      {selectedSlot.depositRequired && (
                        <Text style={styles.depositNoticeAmount}>
                          TZS {selectedSlot.depositAmountTzs.toLocaleString()}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.depositNoticeSub}>
                      {selectedSlot.depositRequired
                        ? (language === 'sw'
                            ? `Mgahawa unahitaji amana ya TZS ${selectedSlot.depositAmountTzs.toLocaleString()} ili kufunga nafasi ya meza yako.`
                            : `The restaurant requires a TZS ${selectedSlot.depositAmountTzs.toLocaleString()} deposit to confirm your table.`)
                        : (selectedSlot.confirmationMode === 'MANUAL'
                            ? (language === 'sw' ? 'Ombi lako litakaguliwa na mgahawa mara moja.' : 'Your booking will be reviewed and confirmed by the restaurant.')
                            : (language === 'sw' ? 'Meza yako itathibitishwa mara moja bure.' : 'Your table will be instantly confirmed at no upfront charge.'))}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.submitBtn, (!selectedSlot || submitting) && { opacity: 0.5 }]}
                  disabled={!selectedSlot || submitting}
                  onPress={handleProceed}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {selectedSlot?.depositRequired
                        ? (language === 'sw'
                            ? `Lipa Amana (TZS ${selectedSlot.depositAmountTzs.toLocaleString()}) & Hifadhi →`
                            : `Pay Deposit (TZS ${selectedSlot.depositAmountTzs.toLocaleString()}) & Book →`)
                        : (language === 'sw' ? 'Thibitisha Nafasi ya Meza →' : 'Confirm Table Booking →')}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <View style={styles.successBox}>
                <View style={styles.successCircle}>
                  <Text style={styles.successIcon}>🎉</Text>
                </View>
                <Text style={styles.successTitle}>{t('bookingSuccessTitle')}</Text>
                <Text style={styles.successMsg}>
                  {language === 'sw' ? (
                    <>
                      Meza ya <Text style={styles.boldText}>wageni {guests}</Text> katika{' '}
                      <Text style={styles.boldText}>{restaurant.name}</Text> imehifadhiwa.{'\n'}
                      Rejea: <Text style={styles.boldText}>{createdReference || createdReservationId}</Text>
                      {paidPayment ? (
                        <Text style={{ color: '#113a26', fontWeight: '800' }}>
                          {'\n\n'}✓ Amana ya TZS {paidPayment.amountTzs.toLocaleString()} imethibitishwa kupitia {paidPayment.paymentMethod}.
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <>
                      A table for <Text style={styles.boldText}>{guests} guests</Text> at{' '}
                      <Text style={styles.boldText}>{restaurant.name}</Text> has been booked.{'\n'}
                      Reference: <Text style={styles.boldText}>{createdReference || createdReservationId}</Text>
                      {paidPayment ? (
                        <Text style={{ color: '#113a26', fontWeight: '800' }}>
                          {'\n\n'}✓ Deposit of TZS {paidPayment.amountTzs.toLocaleString()} verified via {paidPayment.paymentMethod}.
                        </Text>
                      ) : null}
                    </>
                  )}
                </Text>
                <TouchableOpacity style={styles.submitBtn} onPress={handleClose}>
                  <Text style={styles.submitBtnText}>{t('doneBtn')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* CLICKPESA PAYMENT CHECKOUT MODAL */}
      <PaymentCheckoutModal
        visible={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
        restaurantName={restaurant.name}
        restaurantId={restaurant.id}
        reservationId={createdReservationId || undefined}
        amountTzs={depositAmount}
        isReservation={true}
        guestCount={guests}
        title={language === 'sw' ? 'Amana ya Meza (ClickPesa)' : 'Table Deposit Checkout'}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalBox: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xxl,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    padding: Spacing.xl,
    ...Shadows.lg,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    zIndex: 10,
    padding: 6,
  },
  closeText: {
    fontSize: 16,
    color: Colors.subtle,
    fontWeight: 'bold',
  },
  tagWrap: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryMuted,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
    marginBottom: Spacing.xs,
  },
  tagText: {
    color: Colors.primaryDark,
    fontSize: 9,
    fontWeight: '900',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  subtitle: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.full,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  pillTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  depositNoticeBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: Radii.md,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  depositNoticeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  depositNoticeTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  depositNoticeAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
  },
  depositNoticeSub: {
    fontSize: 10,
    color: '#047857',
    lineHeight: 14,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radii.full,
    alignItems: 'center',
    marginTop: Spacing.md,
    ...Shadows.sm,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  successCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  successIcon: {
    fontSize: 28,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  successMsg: {
    fontSize: 12,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  boldText: {
    fontWeight: '800',
    color: Colors.text,
  },
});
