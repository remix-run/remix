import type {
  Cookie,
  CookieOptions,
  HeadersFunction,
  MetaFunction,
  ActionFunction,
  LoaderFunction,
  RouteComponent,
  ErrorBoundaryComponent,
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
  LoaderFunction,
  ActionFunction,
  LoaderFunction as Loader, // shorthand
  ActionFunction as Action, // shorthand
  RouteComponent,
  ErrorBoundaryComponent,
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
