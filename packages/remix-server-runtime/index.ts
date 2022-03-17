// Default implementations for the Remix server runtime interface
export { createCookie, isCookie } from "./cookies";
export { json, redirect } from "./responses";
export { createRequestHandler } from "./server";
export { createSession, isSession, createSessionStorage } from "./sessions";
export { createCookieSessionStorage } from "./sessions/cookieStorage";
export { createMemorySessionStorage } from "./sessions/memoryStorage";

// Types for the Remix server runtime interface
export type {
  CreateCookieFunction,
  CreateCookieSessionStorageFunction,
  CreateMemorySessionStorageFunction,
  CreateRequestHandlerFunction,
  CreateSessionFunction,
  CreateSessionStorageFunction,
  IsCookieFunction,
  IsSessionFunction,
  JsonFunction,
  RedirectFunction,
} from "./interface";

// Remix server runtime packages should re-export these types
export type {
  ActionFunction,
  AppData,
  AppLoadContext,
  Cookie,
  CookieOptions,
  CookieParseOptions,
  CookieSerializeOptions,
  CookieSignatureOptions,
  DataFunctionArgs,
  EntryContext,
  ErrorBoundaryComponent,
  HandleDataRequestFunction,
  HandleDocumentRequestFunction,
  HeadersFunction,
  HtmlLinkDescriptor,
  HtmlMetaDescriptor,
  LinkDescriptor,
  LinksFunction,
  LoaderFunction,
  MetaDescriptor,
  MetaFunction,
  PageLinkDescriptor,
  RequestHandler,
  RouteComponent,
  RouteHandle,
  ServerBuild,
  ServerEntryModule,
  ServerPlatform,
  Session,
  SessionData,
  SessionIdStorageStrategy,
  SessionStorage,
} from "./reexport";
