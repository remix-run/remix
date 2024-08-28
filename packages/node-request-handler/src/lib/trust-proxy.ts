import proxyAddr from 'proxy-addr';

export type TrustArg = Parameters<typeof proxyAddr>[1];

export interface TrustProxy {
  (addr: string, i: number): boolean;
}

/**
 * Creates a function that determines whether to trust a proxy server.
 */
export function createTrustProxy(trustArg?: boolean | TrustArg): TrustProxy {
  if (typeof trustArg === 'boolean') return () => trustArg as boolean;
  if (typeof trustArg === 'function') return trustArg;
  if (typeof trustArg === 'string') trustArg = trustArg.split(',').map((s) => s.trim());
  return proxyAddr.compile(trustArg || []);
}
