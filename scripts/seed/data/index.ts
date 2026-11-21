import { SeedRestaurant } from './types';
import { mamaAminaRestaurant } from './mama-amina';
import { mamaAshaRestaurant } from './mama-asha';
import { zanzibarSpiceRestaurant } from './zanzibar-spice';
import { kiboGrillRestaurant } from './kibo-grill';
import { samakiExpressRestaurant } from './samaki-express';
import { kahawaChapatiRestaurant } from './kahawa-chapati';
import { matundaFreshRestaurant } from './matunda-fresh';
import { palmBistroRestaurant } from './palm-bistro';

export * from './types';
export * from './accounts';

export {
  mamaAminaRestaurant,
  mamaAshaRestaurant,
  zanzibarSpiceRestaurant,
  kiboGrillRestaurant,
  samakiExpressRestaurant,
  kahawaChapatiRestaurant,
  matundaFreshRestaurant,
  palmBistroRestaurant,
};

export const STAGING_RESTAURANTS: SeedRestaurant[] = [
  mamaAminaRestaurant,
  mamaAshaRestaurant,
  zanzibarSpiceRestaurant,
  kiboGrillRestaurant,
  samakiExpressRestaurant,
  kahawaChapatiRestaurant,
  matundaFreshRestaurant,
  palmBistroRestaurant,
];
