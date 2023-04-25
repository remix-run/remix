import {
  createCookieFactory,
  createCookieSessionStorageFactory,
  createMemorySessionStorageFactory,
  createSessionStorageFactory,
} from "@remix-run/server-runtime";

import { sign, unsign, encrypt, decrypt } from "./crypto.ts";

export const createCookie = createCookieFactory({
  sign,
  unsign,
  encrypt,
  decrypt,
});
export const createCookieSessionStorage =
  createCookieSessionStorageFactory(createCookie);
export const createSessionStorage = createSessionStorageFactory(createCookie);
export const createMemorySessionStorage =
  createMemorySessionStorageFactory(createSessionStorage);
