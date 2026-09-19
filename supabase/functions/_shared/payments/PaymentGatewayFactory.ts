/**
 * Payment Gateway Factory
 * Resolves active payment gateway instance based on environment configuration.
 */

import { PaymentGateway } from './PaymentGateway';
import { PaymentProvider } from './paymentTypes';
import { ClickPesaGateway } from './ClickPesaGateway';
import { SelcomGateway } from './SelcomGateway';
import { SandboxPaymentGateway } from './SandboxPaymentGateway';

export class PaymentGatewayFactory {
  private static instances: Map<PaymentProvider, PaymentGateway> = new Map();

  /**
   * Get configured payment gateway instance
   */
  public static getGateway(overrideProvider?: PaymentProvider): PaymentGateway {
    const rawProvider = (
      overrideProvider ||
      process.env.PAYMENT_PROVIDER ||
      'sandbox'
    ).toLowerCase() as PaymentProvider;

    const provider: PaymentProvider =
      rawProvider === 'clickpesa'
        ? 'clickpesa'
        : rawProvider === 'selcom'
        ? 'selcom'
        : 'sandbox';

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
