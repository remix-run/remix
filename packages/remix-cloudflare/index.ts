import "./globals";

import { createWorkersKVSessionStorage } from "./sessions/workersKVStorage";

const warn = <T extends Function>(fn: T, message: string): T =>
  ((...args: unknown[]) => {
    console.warn(message);

    return fn(...args);
  }) as unknown as T;

/** @deprecated Use `createWorkersKVSessionStorage` instead. */
export const createCloudflareKVSessionStorage = warn(
  createWorkersKVSessionStorage,
  "`createCloudflareKVSessionStorage` is deprecated. Please use `createWorkersKVSessionStorage` instead."
);

export { createWorkersKVSessionStorage } from "./sessions/workersKVStorage";

export {
  createCookie,
  createCookieSessionStorage,
  createMemorySessionStorage,
  createSessionStorage,
} from "./implementations";

export {
  createRequestHandler,
  createSession,
  defer,
  broadcastDevReady,
  logDevReady,
  isCookie,
  isSession,
  json,
  MaxPartSizeExceededError,
  redirect,
  unstable_composeUploadHandlers,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/server-runtime";

export type {
  ActionArgs,
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
  HeadersArgs,
  HeadersFunction,
  HtmlLinkDescriptor,
  HtmlMetaDescriptor,
  JsonFunction,
  LinkDescriptor,
  LinksFunction,
  LoaderArgs,
  LoaderFunction,
  MemoryUploadHandlerFilterArgs,
  MemoryUploadHandlerOptions,
  MetaDescriptor,
  MetaFunction,
  HandleErrorFunction,
  PageLinkDescriptor,
  RequestHandler,
  RouteComponent,
  RouteHandle,
  SerializeFrom,
  ServerBuild,
  ServerEntryModule,
  V2_ServerRuntimeMetaArgs as V2_MetaArgs,
  V2_ServerRuntimeMetaDescriptor as V2_MetaDescriptor,
  // TODO: Remove in v2
  V2_ServerRuntimeMetaDescriptor as V2_HtmlMetaDescriptor,
  V2_ServerRuntimeMetaFunction as V2_MetaFunction,
  Session,
  SessionData,
  SessionIdStorageStrategy,
  SessionStorage,
  SignFunction,
  TypedDeferredData,
  TypedResponse,
  UnsignFunction,
  UploadHandler,
  UploadHandlerPart,
} from "@remix-run/server-runtime";
