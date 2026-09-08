import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Restaurant } from '../constants/data';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useMloHubDB } from '../context/DbContext';
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
  const { user, createReservation } = useMloHubDB();
  const [guests, setGuests] = useState('2');
  const [date, setDate] = useState(language === 'sw' ? 'Leo' : 'Today');
  const [time, setTime] = useState('07:30 PM');
  const [confirmed, setConfirmed] = useState(false);
  const [createdReservationId, setCreatedReservationId] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paidPayment, setPaidPayment] = useState<PaymentTransactionEntity | null>(null);

  if (!restaurant) return null;

  const numGuests = Math.max(1, parseInt(guests.replace('+', ''), 10) || 2);
  const avgPricePerPerson = restaurant.minPrice && restaurant.minPrice > 0 ? restaurant.minPrice : 15000;
  const estimatedBill = numGuests * avgPricePerPerson;
  const deposit50 = Math.round(estimatedBill * 0.5);

  const handleProceedToPayment = async () => {
    try {
      const newRes = await createReservation({
        userId: user?.id || 'usr-frank',
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        guestsCount: guests,
        reservationDate: date,
        timeSlot: time,
        address: restaurant.address || 'Dar es Salaam, Tanzania',
        status: 'pending',
        depositOption: 'deposit_50',
        depositAmountTzs: deposit50,
        totalBillTzs: estimatedBill,
        remainingBalanceTzs: estimatedBill - deposit50,
      });

      setCreatedReservationId(newRes.id);
      setShowCheckoutModal(true);
    } catch (e) {
      console.error('Reservation creation error', e);
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
    setPaidPayment(null);
    onClose();
  };

  const dateOptions = language === 'sw'
    ? ['Leo', 'Kesho', 'Wikendi']
    : ['Today', 'Tomorrow', 'Weekend'];

  return (
    <>
      <Modal visible={visible && !showCheckoutModal} transparent animationType="fade" onRequestClose={handleClose}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>

            {!confirmed ? (
              <View>
                <View style={styles.tagWrap}>
                  <Text style={styles.tagText}>🪑 {t('tableReservationTitle').toUpperCase()}</Text>
                </View>

                <Text style={styles.title}>{t('tableReservationTitle')}</Text>
                <Text style={styles.subtitle}>
                  {t('instantReservationSub')}{' '}
                  <Text style={styles.boldText}>{restaurant.name}</Text>
                </Text>

                {/* Guest Selector */}
                <Text style={styles.label}>{t('numGuestsLabel')}</Text>
                <View style={styles.pillRow}>
                  {['1', '2', '4', '6+'].map((g) => (
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
                  {dateOptions.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.pill, date === d && styles.pillActive]}
                      onPress={() => setDate(d)}
                    >
                      <Text style={[styles.pillText, date === d && styles.pillTextActive]}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Time Slot */}
                <Text style={styles.label}>{t('timeSlotLabel')}</Text>
                <View style={styles.pillRow}>
                  {['12:30 PM', '01:30 PM', '07:30 PM', '08:30 PM'].map((tVal) => (
                    <TouchableOpacity
                      key={tVal}
                      style={[styles.pill, time === tVal && styles.pillActive]}
                      onPress={() => setTime(tVal)}
                    >
                      <Text style={[styles.pillText, time === tVal && styles.pillTextActive]}>
                        {tVal}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 50% Deposit Estimate Box */}
                <View style={styles.depositNoticeBox}>
                  <View style={styles.depositNoticeRow}>
                    <Text style={styles.depositNoticeTitle}>
                      {language === 'sw' ? 'Amana ya Meza (50% Deposit):' : 'Table Deposit (50% Required):'}
                    </Text>
                    <Text style={styles.depositNoticeAmount}>
                      TZS {deposit50.toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.depositNoticeSub}>
                    {language === 'sw'
                      ? `Makadirio ya bili ni TZS ${estimatedBill.toLocaleString()} (kwa wageni ${guests}). Lipa amana ya 50% kwa ClickPesa M-Pesa kufunga meza yako.`
                      : `Estimated total bill: TZS ${estimatedBill.toLocaleString()} (${guests} guests). Pay 50% deposit via ClickPesa M-Pesa to lock your table.`}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleProceedToPayment}
                  activeOpacity={0.85}
                >
                  <Text style={styles.submitBtnText}>
                    {language === 'sw'
                      ? `Lipa Amana (TZS ${deposit50.toLocaleString()}) & Hifadhi Meza →`
                      : `Pay Deposit (TZS ${deposit50.toLocaleString()}) & Book Table →`}
                  </Text>
                </TouchableOpacity>
              </View>
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
                      <Text style={styles.boldText}>{restaurant.name}</Text> imehifadhiwa kwa{' '}
                      {date} saa {time}.
                      {paidPayment ? (
                        <Text style={{ color: '#113a26', fontWeight: '800' }}>
                          {'\n\n'}✓ Amana ya TZS {paidPayment.amountTzs.toLocaleString()} imethibitishwa kupitia {paidPayment.paymentMethod}.
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <>
                      A table for <Text style={styles.boldText}>{guests} guests</Text> at{' '}
                      <Text style={styles.boldText}>{restaurant.name}</Text> has been reserved for{' '}
                      {date} at {time}.
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
        amountTzs={estimatedBill}
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
    maxWidth: 420,
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
  boldText: {
    fontWeight: '800',
    color: Colors.text,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text,
    marginTop: Spacing.sm,
    marginBottom: 6,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  pill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radii.lg,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  pillTextActive: {
    color: Colors.white,
    fontWeight: '800',
  },
  depositNoticeBox: {
    backgroundColor: '#f5faf6',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: '#cde4d4',
  },
  depositNoticeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  depositNoticeTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#113a26',
  },
  depositNoticeAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#113a26',
  },
  depositNoticeSub: {
    fontSize: 10,
    color: Colors.muted,
    marginTop: 4,
    lineHeight: 14,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radii.xl,
    alignItems: 'center',
    marginTop: Spacing.md,
    ...Shadows.md,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  successCircle: {
    width: 60,
    height: 60,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  successIcon: {
    fontSize: 30,
  },
  successTitle: {
    fontSize: 20,
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
});
