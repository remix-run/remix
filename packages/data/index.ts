// TODO: Does this belong here or in @remix-run/react?
export type {
  RouteComponent,
  ErrorBoundaryComponent,
  HeadersFunction,
  MetaFunction,
  LinksFunction,
  LoaderFunction,
  ActionFunction,
  // shorthand
  LoaderFunction as Loader,
  ActionFunction as Action
} from "@remix-run/core";

export type {
  Cookie,
  CookieOptions,
  SessionData,
  Session,
  SessionStorage,
  SessionIdStorageStrategy
} from "@remix-run/core";

export { Headers, Request, Response } from "@remix-run/core";

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
} from "@remix-run/core";
