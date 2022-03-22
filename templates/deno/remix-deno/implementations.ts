import {
  createCookieFactory,
  createCookieSessionStorageFactory,
  createMemorySessionStorageFactory,
  createSessionStorageFactory,
} from "./deps/@remix-run/server-runtime.ts";

import { sign, unsign } from "./crypto.ts";

export const createCookie = createCookieFactory({ sign, unsign });
export const createCookieSessionStorage = createCookieSessionStorageFactory(createCookie);
export const createSessionStorage = createSessionStorageFactory(createCookie);
export const createMemorySessionStorage = createMemorySessionStorageFactory(createSessionStorage);
