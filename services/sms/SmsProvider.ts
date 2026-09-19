/**
 * MloHub SMS Provider Interface & Gateway Adapters (Hardened Stage 8)
 * Backward-compatible facade delegating directly to SmsFactory, NextSmsGateway,
 * and BeemGateway. All EXPO_PUBLIC_ secret leaks have been permanently eliminated.
 */

import { SmsGateway, SmsSendResult as BaseSmsSendResult } from './SmsGateway';
import { SmsFactory } from './SmsFactory';
import { NextSmsGateway } from './NextSmsGateway';
import { BeemGateway } from './BeemGateway';
import { SandboxSmsGateway } from './SandboxSmsGateway';

export type SmsSendResult = BaseSmsSendResult;

export interface SmsProvider {
  name: string;
  sendOtp(phone: string, otp: string, purpose?: string): Promise<SmsSendResult>;
  sendNotification(phone: string, message: string): Promise<SmsSendResult>;
}

/**
 * 1. Sandbox / Development Provider
 */
export class SandboxSmsProvider implements SmsProvider {
  public readonly name = 'SANDBOX_SMS_PROVIDER';
  private gateway: SandboxSmsGateway;

  constructor() {
    this.gateway = SmsFactory.getSandbox();
  }

  async sendOtp(phone: string, otp: string, purpose: string = 'Activation'): Promise<SmsSendResult> {
    return this.gateway.sendOtp(phone, otp, purpose, 'sw');
  }

  async sendNotification(phone: string, message: string): Promise<SmsSendResult> {
    return this.gateway.sendNotification(phone, message);
  }
}

/**
 * 2. NextSMS Tanzania Gateway Adapter
 */
export class NextSmsProvider implements SmsProvider {
  public readonly name = 'NEXTSMS_TANZANIA';
  private gateway: NextSmsGateway;

  constructor(username?: string, password?: string, senderId?: string) {
    this.gateway = new NextSmsGateway(username, password, senderId);
  }

  async sendOtp(phone: string, otp: string, purpose: string = 'Verification'): Promise<SmsSendResult> {
    return this.gateway.sendOtp(phone, otp, purpose, 'sw');
  }

  async sendNotification(phone: string, message: string): Promise<SmsSendResult> {
    return this.gateway.sendNotification(phone, message);
  }
}

/**
 * 3. Beem Africa SMS Gateway Adapter (Tanzania & East Africa)
 */
export class BeemSmsProvider implements SmsProvider {
  public readonly name = 'BEEM_AFRICA';
  private gateway: BeemGateway;

  constructor(apiKey?: string, secretKey?: string, senderId?: string) {
    this.gateway = new BeemGateway(apiKey, secretKey, senderId);
  }

  async sendOtp(phone: string, otp: string, purpose: string = 'Uthibitisho'): Promise<SmsSendResult> {
    return this.gateway.sendOtp(phone, otp, purpose, 'sw');
  }

  async sendNotification(phone: string, message: string): Promise<SmsSendResult> {
    return this.gateway.sendNotification(phone, message);
  }
}

/**
 * Active SMS Gateway Factory
 * Strictly inspects backend variables. No EXPO_PUBLIC_ credentials ever read.
 */
export const getSmsProvider = (): SmsProvider => {
  const gateway = SmsFactory.getGateway();
  if (gateway.name === 'BEEM_AFRICA') {
    return new BeemSmsProvider();
  }
  if (gateway.name === 'NEXTSMS') {
    return new NextSmsProvider();
  }
  return new SandboxSmsProvider();
};
