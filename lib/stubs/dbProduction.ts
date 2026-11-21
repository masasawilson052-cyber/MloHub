export * from '../../db/types';
export * from '../../db/auth/crypto';
export * from '../../db/auth/guards';
export * from '../../db/realtime/eventEngine';

const createNoopDb = (): any =>
  new Proxy(
    {},
    {
      get: () => () => Promise.resolve(null),
    }
  );

export const MloHubDB: any = createNoopDb();
