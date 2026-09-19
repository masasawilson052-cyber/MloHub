import { PushDevicesRepository } from '../../../repositories/pushDevices.repository';

export interface PushSendResult {
  success: boolean;
  providerMessageId?: string;
  statusCode?: string;
  error?: string;
  isDeviceNotRegistered?: boolean;
}

export class PushProvider {
  /**
   * Validate Expo Push Token format: ExponentPushToken[...] or ExpoPushToken[...]
   */
  public static isValidExpoToken(token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    return (
      (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) &&
      token.endsWith(']')
    );
  }

  public static async sendPush(params: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    priority?: 'default' | 'normal' | 'high';
  }): Promise<PushSendResult> {
    const { token, title, body, data = {}, priority = 'high' } = params;

    // Sandbox / Test Mode bypass or invalid token handling
    if (process.env.NODE_ENV === 'test' || !process.env.EXPO_ACCESS_TOKEN) {
      if (token.includes('invalid') || token.includes('device_not_registered')) {
        await PushDevicesRepository.deactivateToken(token, 'DeviceNotRegistered');
        return {
          success: false,
          error: 'DeviceNotRegistered',
          statusCode: '400',
          isDeviceNotRegistered: true,
        };
      }

      return {
        success: true,
        providerMessageId: `expo_msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        statusCode: '200',
      };
    }

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to: token,
          sound: 'default',
          title,
          body,
          data,
          priority,
        }),
      });

      const resJson = await response.json();
      const ticket = resJson.data;

      if (ticket?.status === 'error') {
        if (ticket.details?.error === 'DeviceNotRegistered') {
          await PushDevicesRepository.deactivateToken(token, 'DeviceNotRegistered');
          return {
            success: false,
            error: 'DeviceNotRegistered',
            statusCode: '400',
            isDeviceNotRegistered: true,
          };
        }
        return {
          success: false,
          error: ticket.message || ticket.details?.error,
          statusCode: '400',
        };
      }

      return {
        success: true,
        providerMessageId: ticket?.id,
        statusCode: '200',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        statusCode: '500',
      };
    }
  }
}
