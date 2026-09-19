/**
 * MloHub Centralized zIndex Tokens - Design System V2
 */

export const ZIndex = {
  base: 0,
  elevated: 1,
  card: 2,
  stickyHeader: 10,
  cartAccessory: 50,
  bottomNav: 100,
  modalBackdrop: 200,
  modalContent: 201,
  toast: 300,
} as const;

export type ZIndexToken = keyof typeof ZIndex;
