import type {
  Cookie,
  CookieOptions,
  HeadersFunction,
  MetaFunction,
  ActionFunction,
  LoaderFunction,
  SessionData,
  Session,
  SessionStorage,
  SessionIdStorageStrategy
} from "@remix-run/core";
import {
  Headers,
  Request,
  Response,
  createCookie,
  isCookie,
  createSession,
  isSession,
  createSessionStorage,
  createCookieSessionStorage,
  createFileSessionStorage,
  createMemorySessionStorage,
  json,
  redirect
} from "@remix-run/core";

export type {
  Cookie,
  CookieOptions,
  HeadersFunction,
  MetaFunction,
  ActionFunction as Action,
  LoaderFunction as Loader,
  SessionData,
  Session,
  SessionStorage,
  SessionIdStorageStrategy
};

// These are already global, but just re-export them here for convenience.
export { Headers, Request, Response };

export {
  createCookie,
  isCookie,
  createSession,
  isSession,
  createSessionStorage,
  createCookieSessionStorage,
  createFileSessionStorage,
  createMemorySessionStorage,
  json,
  redirect
};
