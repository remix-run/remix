/* eslint-disable import/no-extraneous-dependencies */

import * as cloudflare from "@remix-run/cloudflare";

const warn = <T extends Function>(fn: T, message: string): T =>
  ((...args: unknown[]) => {
    console.warn(message);

    return fn(...args);
  }) as unknown as T;

const getDeprecatedMessage = (functionName: string, packageName: string) =>
  `All \`remix\` exports are considered deprecated as of v1.3.3. Please import \`${functionName}\` from \`@remix-run/${packageName}\` instead. You can run \`remix migrate --migration replace-remix-imports\` to automatically migrate your code.`;

// Re-export everything from this package that is available in `remix`.

/** @deprecated Import `createCloudflareKVSessionStorage` from `@remix-run/cloudflare` instead. */
export const createCloudflareKVSessionStorage = warn(
  cloudflare.createCloudflareKVSessionStorage,
  getDeprecatedMessage("createCloudflareKVSessionStorage", "cloudflare")
);
/** @deprecated Import `createCookie` from `@remix-run/cloudflare` instead. */
export const createCookie = warn(
  cloudflare.createCookie,
  getDeprecatedMessage("createCookie", "cloudflare")
);
/** @deprecated Import `createSessionStorage` from `@remix-run/cloudflare` instead. */
export const createSessionStorage = warn(
  cloudflare.createSessionStorage,
  getDeprecatedMessage("createSessionStorage", "cloudflare")
);
/** @deprecated Import `createCookieSessionStorage` from `@remix-run/cloudflare` instead. */
export const createCookieSessionStorage = warn(
  cloudflare.createCookieSessionStorage,
  getDeprecatedMessage("createCookieSessionStorage", "cloudflare")
);
/** @deprecated Import `createMemorySessionStorage` from `@remix-run/cloudflare` instead. */
export const createMemorySessionStorage = warn(
  cloudflare.createMemorySessionStorage,
  getDeprecatedMessage("createMemorySessionStorage", "cloudflare")
);
