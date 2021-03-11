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
} from "@remix-run/node";

export type {
  Cookie,
  CookieOptions,
  SessionData,
  Session,
  SessionStorage,
  SessionIdStorageStrategy
} from "@remix-run/node";

export { Headers, Request, Response } from "@remix-run/node";

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
} from "@remix-run/node";
