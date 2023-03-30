import {
  createCookieFactory,
  createCookieSessionStorageFactory,
  createMemorySessionStorageFactory,
  createRedisSessionStorageFactory,
  createSessionStorageFactory,
} from "@remix-run/server-runtime";

import { sign, unsign } from "./crypto";

export const createCookie = createCookieFactory({ sign, unsign });
export const createCookieSessionStorage =
  createCookieSessionStorageFactory(createCookie);
export const createSessionStorage = createSessionStorageFactory(createCookie);
export const createMemorySessionStorage =
  createMemorySessionStorageFactory(createSessionStorage);
export const createRedisSessionStorage =
  createRedisSessionStorageFactory(createSessionStorage);
