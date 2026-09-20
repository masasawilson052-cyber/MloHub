/**
 * MloHub Bilingual Transactional SMS Templates (Swahili & English)
 * Ensures high carrier delivery rates, clear branding, and localized clarity.
 */

export type SmsLanguage = 'sw' | 'en';

export type OtpPurpose =
  | 'CUSTOMER_VERIFICATION'
  | 'VENDOR_ACTIVATION'
  | 'PASSWORD_RESET'
  | 'ORDER_CONFIRMATION';

export interface OrderTemplateParams {
  orderNumber: string;
  restaurantName: string;
  customerName?: string;
  totalTzs?: number;
  deliveryAddress?: string;
  estimatedMinutes?: number;
}

export interface ReservationTemplateParams {
  restaurantName: string;
  guestName: string;
  partySize: number;
  date: string;
  time: string;
}

export class SmsTemplates {
  /**
   * 1. OTP Verification Messages
   */
  public static otpMessage(
    otp: string,
    purpose: OtpPurpose = 'CUSTOMER_VERIFICATION',
    language: SmsLanguage = 'sw'
  ): string {
    const purposeMapSw: Record<OtpPurpose, string> = {
      CUSTOMER_VERIFICATION: 'Uthibitisho wa akaunti ya MloHub',
      VENDOR_ACTIVATION: 'Kuanzisha akaunti ya MloHub',
      PASSWORD_RESET: 'Kurejesha nenosiri la MloHub',
      ORDER_CONFIRMATION: 'Kuthibitisha oda ya MloHub',
    };

    const purposeMapEn: Record<OtpPurpose, string> = {
      CUSTOMER_VERIFICATION: 'MloHub account verification',
      VENDOR_ACTIVATION: 'MloHub vendor account activation',
      PASSWORD_RESET: 'MloHub password reset',
      ORDER_CONFIRMATION: 'MloHub order confirmation',
    };

    if (language === 'sw') {
      return `Habari! Namba yako ya uthibitisho ya MloHub (${purposeMapSw[purpose]}) ni [ ${otp} ]. Inatumika kwa dakika 5 tu. Usitoe kwa mtu yeyote.`;
    }

    return `Hello! Your MloHub verification code (${purposeMapEn[purpose]}) is [ ${otp} ]. Valid for 5 minutes only. Do not share with anyone.`;
  }

  /**
   * 2. Vendor Activation / Invitation SMS
   */
  public static vendorActivationInvitation(
    businessName: string,
    ownerName: string,
    activationCode: string,
    language: SmsLanguage = 'sw'
  ): string {
    if (language === 'sw') {
      return `Hongera ${ownerName}! Biashara yako "${businessName}" imewashwa kwenye MloHub. Tumia msimbo huu [ ${activationCode} ] kuthibitisha simu na kuweka nenosiri lako salama.`;
    }
    return `Congratulations ${ownerName}! Your business "${businessName}" is now active on MloHub. Use verification code [ ${activationCode} ] to verify your phone and set your secure password.`;
  }

  /**
   * 3. Order Lifecycle Alerts
   */
  public static orderPlaced(params: OrderTemplateParams, language: SmsLanguage = 'sw'): string {
    if (language === 'sw') {
      return `Oda #${params.orderNumber} ya MloHub imepokelewa! Jikoni "${params.restaurantName}" inaiandaa sasa. Tutakuarifu itakapokuwa tayari.`;
    }
    return `MloHub order #${params.orderNumber} received! "${params.restaurantName}" kitchen is now preparing it. We'll alert you when ready.`;
  }

  public static orderAcceptedKitchen(params: OrderTemplateParams, language: SmsLanguage = 'sw'): string {
    const mins = params.estimatedMinutes || 25;
    if (language === 'sw') {
      return `Chakula chako kinapikwa! Oda #${params.orderNumber} kutoka ${params.restaurantName} itakuwa tayari ndani ya takriban dakika ${mins}.`;
    }
    return `Your meal is cooking! Order #${params.orderNumber} from ${params.restaurantName} will be ready in ~${mins} mins.`;
  }

  public static orderReadyForPickup(params: OrderTemplateParams, language: SmsLanguage = 'sw'): string {
    if (language === 'sw') {
      return `Oda #${params.orderNumber} iko tayari kuchukuliwa ${params.restaurantName}! Karibu uichukue ikiwa moto.`;
    }
    return `Order #${params.orderNumber} is ready for pickup at ${params.restaurantName}! Please pick up while fresh and hot.`;
  }

  public static orderOutForDelivery(params: OrderTemplateParams, language: SmsLanguage = 'sw'): string {
    if (language === 'sw') {
      return `Oda #${params.orderNumber} iko njiani! Mgahawa wako umeweka oda yako kuwa njiani kuletwa kwako.`;
    }
    return `Order #${params.orderNumber} is on the way! Your restaurant has marked your order as on the way for delivery.`;
  }

  public static orderDelivered(params: OrderTemplateParams, language: SmsLanguage = 'sw'): string {
    if (language === 'sw') {
      return `Oda #${params.orderNumber} imefikishwa kikamilifu. Furahia chakula chako! Asante kwa kutumia MloHub.`;
    }
    return `Order #${params.orderNumber} has been delivered. Enjoy your meal! Thank you for dining with MloHub.`;
  }

  /**
   * 4. Table Reservation Alerts
   */
  public static reservationConfirmed(params: ReservationTemplateParams, language: SmsLanguage = 'sw'): string {
    if (language === 'sw') {
      return `Nafasi ya meza imethibitishwa! Watu ${params.partySize} pale ${params.restaurantName} mnamo ${params.date} saa ${params.time}. Tunakukaribisha sana.`;
    }
    return `Table reservation confirmed! Party of ${params.partySize} at ${params.restaurantName} on ${params.date} at ${params.time}. We look forward to hosting you.`;
  }

  public static reservationCancelled(restaurantName: string, date: string, language: SmsLanguage = 'sw'): string {
    if (language === 'sw') {
      return `Nafasi yako ya meza pale ${restaurantName} kwa tarehe ${date} imefutwa. Karibu tena MloHub wakati mwingine.`;
    }
    return `Your table reservation at ${restaurantName} on ${date} has been cancelled. Welcome back to MloHub anytime.`;
  }
}
