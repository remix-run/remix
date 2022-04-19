import {
  createCookieFactory,
  createCookieSessionStorageFactory,
  createMemorySessionStorageFactory,
  createSessionStorageFactory,
} from "https://esm.sh/@remix-run/server-runtime?pin=v77";

import { sign, unsign } from "./crypto.ts";

export const createCookie = createCookieFactory({ sign, unsign });
export const createCookieSessionStorage =
  createCookieSessionStorageFactory(createCookie);
export const createSessionStorage = createSessionStorageFactory(createCookie);
export const createMemorySessionStorage =
  createMemorySessionStorageFactory(createSessionStorage);
