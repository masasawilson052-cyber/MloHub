/**
 * Payment Gateway Factory
 * Resolves active payment gateway instance based on environment configuration.
 *
 * Migration Strategy:
 * - Default Target: 'selcom'
 * - Legacy Fallback: 'clickpesa' (strictly requires ALLOW_LEGACY_CLICKPESA='true')
 * - Isolated Testing: 'sandbox' (strictly requires NODE_ENV='test' or MLOHUB_ALLOW_SANDBOX_PAYMENTS='true')
 */

import { PaymentGateway } from './PaymentGateway.ts';
import { PaymentProvider } from './paymentTypes.ts';
import { ClickPesaGateway } from './ClickPesaGateway.ts';
import { SelcomGateway } from './SelcomGateway.ts';
import { SandboxPaymentGateway } from './SandboxPaymentGateway.ts';
import { readPaymentEnvironment } from './environment.ts';

export class PaymentGatewayFactory {
  private static instances: Map<PaymentProvider, PaymentGateway> = new Map();

  /**
   * Get configured payment gateway instance
   */
  public static getGateway(overrideProvider?: PaymentProvider): PaymentGateway {
    const rawProvider = (
      overrideProvider ||
      readPaymentEnvironment('PAYMENT_PROVIDER') ||
      (readPaymentEnvironment('NODE_ENV') === 'test' ? 'sandbox' : '')
    )?.toLowerCase() as PaymentProvider;

    if (!['clickpesa', 'selcom', 'sandbox'].includes(rawProvider)) {
      throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED: Configure PAYMENT_PROVIDER explicitly: selcom, clickpesa, or sandbox.');
    }

    if (
      rawProvider === 'sandbox' &&
      readPaymentEnvironment('NODE_ENV') !== 'test' &&
      readPaymentEnvironment('MLOHUB_ALLOW_SANDBOX_PAYMENTS') !== 'true'
    ) {
      throw new Error('SANDBOX_PROVIDER_NOT_ALLOWED: Sandbox payments require MLOHUB_ALLOW_SANDBOX_PAYMENTS=true on an isolated demo backend.');
    }

    const provider: PaymentProvider = rawProvider;

    if (!this.instances.has(provider)) {
      switch (provider) {
        case 'selcom':
          this.instances.set(provider, new SelcomGateway());
          break;

        case 'clickpesa':
          if (readPaymentEnvironment('ALLOW_LEGACY_CLICKPESA') !== 'true') {
            throw new Error('CLICKPESA_LEGACY_DISABLED: Legacy ClickPesa gateway is disabled. Set ALLOW_LEGACY_CLICKPESA=true to enable rollback during migration.');
          }
          this.instances.set(provider, new ClickPesaGateway());
          break;

        case 'sandbox':
        default:
          this.instances.set(provider, new SandboxPaymentGateway());
          break;
      }
    }

    return this.instances.get(provider)!;
  }

  /**
   * Reset cached instances (useful in test runner)
   */
  public static resetInstances(): void {
    this.instances.clear();
  }
}
