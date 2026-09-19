import { SmsGateway, SmsGatewayHealth } from './SmsGateway';
import { NextSmsGateway } from './NextSmsGateway';
import { BeemGateway } from './BeemGateway';
import { SandboxSmsGateway } from './SandboxSmsGateway';

export class SmsFactory {
  private static cachedGateway: SmsGateway | null = null;
  private static sandboxInstance: SandboxSmsGateway = new SandboxSmsGateway();

  /**
   * Resolve active SMS Gateway based strictly on backend environment variables.
   * Never exposes credentials to client bundle.
   */
  public static getGateway(overrideProvider?: 'nextsms' | 'beem' | 'sandbox'): SmsGateway {
    if (overrideProvider === 'sandbox') {
      return this.sandboxInstance;
    }
    if (overrideProvider === 'nextsms') {
      return new NextSmsGateway();
    }
    if (overrideProvider === 'beem') {
      return new BeemGateway();
    }

    if (this.cachedGateway) {
      return this.cachedGateway;
    }

    const providerChoice = (process.env.SMS_PROVIDER || '').toLowerCase();
    const hasNextSmsCreds = !!(process.env.NEXTSMS_USERNAME && process.env.NEXTSMS_PASSWORD);
    const hasBeemCreds = !!(process.env.BEEM_API_KEY && process.env.BEEM_SECRET_KEY);

    if (providerChoice === 'nextsms' && hasNextSmsCreds) {
      this.cachedGateway = new NextSmsGateway();
    } else if (providerChoice === 'beem' && hasBeemCreds) {
      this.cachedGateway = new BeemGateway();
    } else if (hasNextSmsCreds) {
      this.cachedGateway = new NextSmsGateway();
    } else if (hasBeemCreds) {
      this.cachedGateway = new BeemGateway();
    } else {
      this.cachedGateway = this.sandboxInstance;
    }

    return this.cachedGateway;
  }

  public static getSandbox(): SandboxSmsGateway {
    return this.sandboxInstance;
  }

  public static resetCache(): void {
    this.cachedGateway = null;
    this.sandboxInstance.clearHistory();
  }

  /**
   * Check status of configured gateways without sending SMS
   */
  public static async getGatewayHealth(): Promise<SmsGatewayHealth> {
    const gateway = this.getGateway();
    return gateway.checkHealth();
  }
}
