import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { PaymentApi, PaymentInitiationResult } from '../../services/api/PaymentApi';
import {
  PaymentMethodCode,
  PaymentType,
  PaymentTransactionEntity,
} from '../../db/types';
import {
  MOBILE_MONEY_METHODS,
  MobileMoneyMethodConfig,
  getMobileMoneyMethodConfig,
} from '../../constants/paymentMethods';
import {
  PaymentFlowStep,
  ClassifiedPaymentFailure,
  classifyPaymentFailure,
  generatePaymentAttemptId,
  generatePaymentIdempotencyKey,
} from '../payments/paymentFlow';
import {
  formatAsYouTypeTanzaniaPhone,
  isValidLocalTanzaniaPhone,
  toGatewayTanzaniaPhone,
} from '../../utils/phone';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { PAYMENT_PROMPT_SECONDS } from './PaymentWaiting';

export interface UsePaymentFlowProps {
  visible: boolean;
  orderId?: string;
  reservationId?: string;
  customMealRequestId?: string;
  quoteId?: string;
  paymentType: PaymentType;
  initialMethodCode?: PaymentMethodCode;
  initialPhone?: string;
  onPaymentVerified?: (payment: PaymentTransactionEntity) => void;
}

export function usePaymentFlow({
  visible,
  orderId,
  reservationId,
  customMealRequestId,
  quoteId,
  paymentType,
  initialMethodCode = 'MPESA',
  initialPhone,
  onPaymentVerified,
}: UsePaymentFlowProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [step, setStep] = useState<PaymentFlowStep>('METHOD');
  const [enabledMethods, setEnabledMethods] = useState<PaymentMethodCode[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<MobileMoneyMethodConfig>(
    getMobileMoneyMethodConfig(initialMethodCode) || MOBILE_MONEY_METHODS[0]
  );
  const [payerPhone, setPayerPhone] = useState(
    formatAsYouTypeTanzaniaPhone(initialPhone || user?.phone || '')
  );
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [currentAttemptId, setCurrentAttemptId] = useState<string>(generatePaymentAttemptId());
  const [initiationResult, setInitiationResult] = useState<PaymentInitiationResult | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(PAYMENT_PROMPT_SECONDS);
  const [classifiedFailure, setClassifiedFailure] = useState<ClassifiedPaymentFailure | null>(null);
  const [verifiedPayment, setVerifiedPayment] = useState<PaymentTransactionEntity | null>(null);
  const [stillPendingNotice, setStillPendingNotice] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const pollIntervalRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);

  // Load server-enabled payment methods
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const methods = await PaymentApi.getEnabledPaymentMethods();
      if (isMounted && methods && methods.length > 0) {
        setEnabledMethods(methods);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setStep('METHOD');
      setSelectedMethod(getMobileMoneyMethodConfig(initialMethodCode) || MOBILE_MONEY_METHODS[0]);
      setPayerPhone(formatAsYouTypeTanzaniaPhone(initialPhone || user?.phone || ''));
      setPhoneError(null);
      setInitiationResult(null);
      setClassifiedFailure(null);
      setVerifiedPayment(null);
      setStillPendingNotice(false);
      setCurrentAttemptId(generatePaymentAttemptId());
    } else {
      clearTimers();
    }
  }, [visible, initialMethodCode, initialPhone, user?.phone, clearTimers]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const performStatusQuery = useCallback(async (paymentId: string) => {
    try {
      const payment = await PaymentApi.getPaymentStatus(paymentId);
      if (payment?.status === 'PAID') {
        clearTimers();
        setVerifiedPayment(payment);
        setStep('SUCCESS');
        onPaymentVerified?.(payment);
        return payment;
      }
      if (payment?.status === 'PROCESSING' && step !== 'VERIFYING') {
        setStep('VERIFYING');
        return payment;
      }
      if (payment?.status === 'FAILED' || payment?.status === 'CANCELLED') {
        clearTimers();
        setStep('FAILED');
        setClassifiedFailure(
          classifyPaymentFailure(payment.failureReason || 'Payment rejected.', payment.status)
        );
        return payment;
      }
      return payment;
    } catch {
      return null;
    }
  }, [clearTimers, onPaymentVerified, step]);

  useEffect(() => {
    const isPollingStep = step === 'AWAITING_APPROVAL' || step === 'VERIFYING';
    if (!visible || !isPollingStep || !initiationResult?.paymentId) return;

    if (step === 'AWAITING_APPROVAL' && !countdownTimerRef.current) {
      setCountdownSeconds(PAYMENT_PROMPT_SECONDS);

      countdownTimerRef.current = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    pollIntervalRef.current = setInterval(() => {
      if (initiationResult?.paymentId) {
        performStatusQuery(initiationResult.paymentId);
      }
    }, 3200);

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && initiationResult?.paymentId) {
        performStatusQuery(initiationResult.paymentId);
      }
    });

    return () => {
      clearTimers();
      appStateSub.remove();
    };
  }, [step, initiationResult?.paymentId, visible, clearTimers, performStatusQuery]);

  const handleTriggerPaymentRequest = async () => {
    if (!payerPhone.trim()) {
      setPhoneError(t('paymentPhoneEmpty'));
      return;
    }
    if (!isValidLocalTanzaniaPhone(payerPhone)) {
      setPhoneError(t('paymentPhoneInvalid'));
      return;
    }
    const gatewayPhone = toGatewayTanzaniaPhone(payerPhone);
    if (!gatewayPhone) {
      setPhoneError(t('paymentPhoneInvalid'));
      return;
    }

    setPhoneError(null);
    setStep('REQUESTING');

    const attemptId = generatePaymentAttemptId();
    setCurrentAttemptId(attemptId);

    const targetIdentifier =
      orderId || reservationId || customMealRequestId || quoteId || `cart_${Date.now()}`;
    const idempotencyKey = generatePaymentIdempotencyKey(
      user?.id || 'guest',
      targetIdentifier,
      attemptId
    );

    try {
      const res = await PaymentApi.createPayment({
        orderId,
        reservationId,
        customMealRequestId,
        quoteId,
        methodCode: selectedMethod.id,
        paymentType,
        payerPhone: gatewayPhone,
        idempotencyKey,
      });

      setInitiationResult(res);

      if (!res.success) {
        setStep('FAILED');
        setClassifiedFailure(
          classifyPaymentFailure(res.error || 'Payment initiation failed.', 'FAILED')
        );
        return;
      }

      setStep('AWAITING_APPROVAL');
    } catch (err: any) {
      setStep('FAILED');
      setClassifiedFailure(
        classifyPaymentFailure(err?.message || 'Payment network error.', 'NETWORK_ERROR')
      );
    }
  };

  const handleImmediateStatusCheck = async () => {
    if (!initiationResult?.paymentId) return;
    setIsCheckingStatus(true);
    try {
      const payment = await performStatusQuery(initiationResult.paymentId);
      if (payment && payment.status === 'PENDING') {
        setStillPendingNotice(true);
        setTimeout(() => setStillPendingNotice(false), 4500);
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleRetrySameAction = async () => {
    if (initiationResult?.paymentId) {
      setIsCheckingStatus(true);
      const payment = await performStatusQuery(initiationResult.paymentId);
      setIsCheckingStatus(false);

      if (payment?.status === 'PAID') return;
      if (payment?.status === 'PENDING') {
        setStillPendingNotice(true);
        setTimeout(() => setStillPendingNotice(false), 4500);
        return;
      }
    }
    handleTriggerPaymentRequest();
  };

  const handleChangeMethodAction = async () => {
    if (initiationResult?.paymentId) {
      const payment = await performStatusQuery(initiationResult.paymentId);
      if (payment?.status === 'PAID') return;
    }
    clearTimers();
    setStep('METHOD');
    setClassifiedFailure(null);
  };

  return {
    step,
    setStep,
    enabledMethods,
    selectedMethod,
    setSelectedMethod,
    payerPhone,
    setPayerPhone,
    phoneError,
    countdownSeconds,
    initiationResult,
    verifiedPayment,
    classifiedFailure,
    stillPendingNotice,
    isCheckingStatus,
    clearTimers,
    handleTriggerPaymentRequest,
    handleImmediateStatusCheck,
    handleRetrySameAction,
    handleChangeMethodAction,
  };
}
