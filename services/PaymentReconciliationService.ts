/**
 * MloHub Payment Reconciliation Service
 * Server-side audit & recovery mechanism for stranded, timed out, or unconfirmed payments.
 *
 * Rules:
 * 1. Identifies transactions stranded in PENDING status past threshold (e.g. 15 mins).
 * 2. Queries authoritative gateway status via active PaymentGateway instance.
 * 3. Safely transitions stranded payments to PAID or FAILED with immutable ledger logging.
 * 4. Produces financial audit discrepancies reports.
 */

import { MloHubDB } from '../db';
import { PaymentTransactionEntity } from '../db/types';
import { PaymentGatewayFactory } from './payments';

export interface ReconciliationResult {
  runTimestamp: string;
  totalPendingScanned: number;
  reconciledToPaid: number;
  reconciledToFailed: number;
  stillPending: number;
  unresolvedCount: number;
  actions: {
    paymentId: string;
    merchantReference?: string;
    previousStatus: string;
    newStatus: string;
    amountTzs: number;
    reason: string;
  }[];
}

export class PaymentReconciliationService {
  /**
   * Run automated reconciliation for stale pending payments
   * @param maxAgeMinutes Payments older than this will be verified against the gateway (default 15 mins)
   */
  public static async reconcileStaleTransactions(maxAgeMinutes: number = 15): Promise<ReconciliationResult> {
    await MloHubDB.init();

    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
    const allPayments = MloHubDB.payments.getAll();
    const stalePending = allPayments.filter(
      (p) => p.status === 'PENDING' && p.createdAt <= cutoffTime
    );

    const result: ReconciliationResult = {
      runTimestamp: new Date().toISOString(),
      totalPendingScanned: stalePending.length,
      reconciledToPaid: 0,
      reconciledToFailed: 0,
      stillPending: 0,
      unresolvedCount: 0,
      actions: [],
    };

    const gateway = PaymentGatewayFactory.getGateway();

    for (const payment of stalePending) {
      try {
        const queryRes = await gateway.queryStatus(
          payment.providerTransactionId || payment.providerReference,
          payment.merchantReference
        );

        if (queryRes.success) {
          if (queryRes.status === 'PAID') {
            // Amount match validation before reconciliation
            if (queryRes.amountTzs > 0 && queryRes.amountTzs < payment.amountTzs) {
              // Fraud / underpayment attempt detected
              await MloHubDB.payments.update(payment.id, {
                status: 'FAILED',
                failedAt: new Date().toISOString(),
                failureReason: `Reconciliation underpayment mismatch: expected ${payment.amountTzs}, gateway reported ${queryRes.amountTzs}`,
              });

              await MloHubDB.paymentEvents.create({
                paymentId: payment.id,
                eventId: `recon_mismatch_${Date.now()}`,
                eventType: 'AMOUNT_MISMATCH',
                provider: gateway.provider,
                status: 'FAILED',
                amountTzs: queryRes.amountTzs,
                currency: 'TZS',
                merchantReference: payment.merchantReference,
                providerReference: payment.providerReference,
                actorType: 'SYSTEM',
              });

              result.reconciledToFailed++;
              result.actions.push({
                paymentId: payment.id,
                merchantReference: payment.merchantReference,
                previousStatus: 'PENDING',
                newStatus: 'FAILED',
                amountTzs: payment.amountTzs,
                reason: 'Reconciliation amount mismatch underpayment detected',
              });
            } else {
              // Valid payment confirmed by gateway
              await MloHubDB.payments.update(payment.id, {
                status: 'PAID',
                paidAt: queryRes.paidAt || new Date().toISOString(),
                confirmedAt: new Date().toISOString(),
              });

              await MloHubDB.paymentEvents.create({
                paymentId: payment.id,
                eventId: `recon_paid_${Date.now()}`,
                eventType: 'PAYMENT_CONFIRMED',
                provider: gateway.provider,
                status: 'PAID',
                amountTzs: payment.amountTzs,
                currency: 'TZS',
                merchantReference: payment.merchantReference,
                providerReference: payment.providerReference,
                actorType: 'SYSTEM',
              });

              if (payment.orderId) {
                await MloHubDB.customOrders.update(payment.orderId, {
                  status: 'Confirmed',
                  paymentStatus: 'PAID',
                  statusMessageEn: 'Payment verified via automated reconciliation. Kitchen prep locked!',
                  statusMessageSw: 'Malipo yamethibitishwa kupitia mfumo wa upatanisho. Mapishi yamefungwa!',
                });
              }

              result.reconciledToPaid++;
              result.actions.push({
                paymentId: payment.id,
                merchantReference: payment.merchantReference,
                previousStatus: 'PENDING',
                newStatus: 'PAID',
                amountTzs: payment.amountTzs,
                reason: 'Authoritative gateway inquiry confirmed transaction success',
              });
            }
          } else if (queryRes.status === 'FAILED' || queryRes.status === 'CANCELLED') {
            await MloHubDB.payments.update(payment.id, {
              status: 'FAILED',
              failedAt: new Date().toISOString(),
              failureReason: queryRes.failureReason || 'Gateway marked transaction as expired/failed',
            });

            await MloHubDB.paymentEvents.create({
              paymentId: payment.id,
              eventId: `recon_fail_${Date.now()}`,
              eventType: 'PAYMENT_FAILED',
              provider: gateway.provider,
              status: 'FAILED',
              amountTzs: payment.amountTzs,
              currency: 'TZS',
              merchantReference: payment.merchantReference,
              providerReference: payment.providerReference,
              actorType: 'SYSTEM',
            });

            result.reconciledToFailed++;
            result.actions.push({
              paymentId: payment.id,
              merchantReference: payment.merchantReference,
              previousStatus: 'PENDING',
              newStatus: 'FAILED',
              amountTzs: payment.amountTzs,
              reason: 'Gateway confirmed payment expired or was cancelled by user',
            });
          } else {
            result.stillPending++;
          }
        } else {
          result.unresolvedCount++;
        }
      } catch (err: any) {
        result.unresolvedCount++;
      }
    }

    return result;
  }
}
