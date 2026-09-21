/**
 * Payment Gateway Factory
 * Resolves active payment gateway instance based on environment configuration.
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
    ).toLowerCase() as PaymentProvider;

    if (!['clickpesa', 'selcom', 'sandbox'].includes(rawProvider)) {
      throw new Error('Configure PAYMENT_PROVIDER explicitly: clickpesa, selcom, or sandbox.');
    }
    if (rawProvider === 'sandbox' && readPaymentEnvironment('NODE_ENV') !== 'test' &&
        readPaymentEnvironment('MLOHUB_ALLOW_SANDBOX_PAYMENTS') !== 'true') {
      throw new Error('Sandbox payments require MLOHUB_ALLOW_SANDBOX_PAYMENTS=true on an isolated demo backend.');
    }
    const provider: PaymentProvider = rawProvider;
    if (readPaymentEnvironment('NODE_ENV') !== 'test' && provider !== 'clickpesa') {
      throw new Error('This production release supports ClickPesa only. Simulated and unfinished gateways are disabled.');
    }

    if (!this.instances.has(provider)) {
      switch (provider) {
        case 'clickpesa':
          this.instances.set(provider, new ClickPesaGateway());
          break;
        case 'selcom':
          this.instances.set(provider, new SelcomGateway());
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
