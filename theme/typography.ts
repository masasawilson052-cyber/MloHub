import type { TextStyle } from 'react-native';
import { Colors } from './colors';

const baseFont =
  typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent || '')
    ? 'System'
    : typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent || '')
    ? 'Roboto'
    : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export type SemanticTypographyKey =
  | 'displayLarge'
  | 'displayMedium'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bodyLarge'
  | 'body'
  | 'bodyMedium'
  | 'bodySemiBold'
  | 'bodySmall'
  | 'caption'
  | 'labelLarge'
  | 'label'
  | 'labelSmall'
  | 'priceLarge'
  | 'price'
  | 'metadata';

export type LegacyTypographyKey =
  | 'Display'
  | 'H1'
  | 'H2'
  | 'H3'
  | 'Body'
  | 'BodyMedium'
  | 'BodySemiBold'
  | 'Caption'
  | 'CaptionMedium'
  | 'Label'
  | 'PriceLarge'
  | 'PriceMedium'
  | 'PriceSmall';

export type TypographyKey = SemanticTypographyKey | LegacyTypographyKey;

const semanticStyles: Record<SemanticTypographyKey, TextStyle> = {
  displayLarge: {
    fontFamily: baseFont,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.6,
  },
  displayMedium: {
    fontFamily: baseFont,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  heading1: {
    fontFamily: baseFont,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  heading2: {
    fontFamily: baseFont,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  heading3: {
    fontFamily: baseFont,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  bodyLarge: {
    fontFamily: baseFont,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  body: {
    fontFamily: baseFont,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  bodyMedium: {
    fontFamily: baseFont,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  bodySemiBold: {
    fontFamily: baseFont,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  bodySmall: {
    fontFamily: baseFont,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: Colors.textMuted,
  },
  caption: {
    fontFamily: baseFont,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: Colors.textMuted,
  },
  labelLarge: {
    fontFamily: baseFont,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  label: {
    fontFamily: baseFont,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontFamily: baseFont,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  priceLarge: {
    fontFamily: baseFont,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: Colors.brandInk,
    letterSpacing: -0.2,
  },
  price: {
    fontFamily: baseFont,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: Colors.brandInk,
  },
  metadata: {
    fontFamily: baseFont,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: Colors.textMuted,
  },
};

export const Typography: Record<TypographyKey, TextStyle> = {
  ...semanticStyles,

  // Legacy mappings for backward compatibility
  Display: semanticStyles.displayLarge,
  H1: semanticStyles.heading1,
  H2: semanticStyles.heading2,
  H3: semanticStyles.heading3,
  Body: semanticStyles.body,
  BodyMedium: {
    ...semanticStyles.body,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  BodySemiBold: {
    ...semanticStyles.body,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  Caption: semanticStyles.bodySmall,
  CaptionMedium: {
    ...semanticStyles.bodySmall,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  Label: semanticStyles.label,
  PriceLarge: semanticStyles.priceLarge,
  PriceMedium: semanticStyles.price,
  PriceSmall: {
    fontFamily: baseFont,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: Colors.brandInk,
  },
};
