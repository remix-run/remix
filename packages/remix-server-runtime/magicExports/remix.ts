/* eslint-disable import/no-extraneous-dependencies */

import * as runtime from "@remix-run/server-runtime";
import type * as RuntimeTypes from "@remix-run/server-runtime";

const warn = <T extends Function>(fn: T, message: string): T =>
  ((...args: unknown[]) => {
    console.warn(message);

    return fn(...args);
  }) as unknown as T;

const getDeprecatedMessage = (functionName: string, packageName: string) =>
  `All \`remix\` exports are considered deprecated as of v1.3.3. Please import \`${functionName}\` from \`@remix-run/${packageName}\` instead. You can run \`remix migrate --migration replace-remix-imports\` to automatically migrate your code.`;

// Re-export everything from this package that is available in `remix`.

/** @deprecated Import `createSession` from `@remix-run/{cloudflare|node}` instead. */
export const createSession = warn(
  runtime.createSession,
  getDeprecatedMessage("createSession", "{cloudflare|node}")
);
/** @deprecated Import `isCookie` from `@remix-run/{cloudflare|node}` instead. */
export const isCookie = warn(
  runtime.isCookie,
  getDeprecatedMessage("isCookie", "{cloudflare|node}")
);
/** @deprecated Import `isSession` from `@remix-run/{cloudflare|node}` instead. */
export const isSession = warn(
  runtime.isSession,
  getDeprecatedMessage("isSession", "{cloudflare|node}")
);
/** @deprecated Import `json` from `@remix-run/{cloudflare|node}` instead. */
export const json = warn(
  runtime.json,
  getDeprecatedMessage("json", "{cloudflare|node}")
);
/** @deprecated Import `redirect` from `@remix-run/{cloudflare|node}` instead. */
export const redirect = warn(
  runtime.redirect,
  getDeprecatedMessage("redirect", "{cloudflare|node}")
);

/** @deprecated Import type `ActionFunction` from `@remix-run/{cloudflare|node}` instead. */
export type ActionFunction = RuntimeTypes.ActionFunction;
/** @deprecated Import type `AppData` from `@remix-run/{cloudflare|node}` instead. */
export type AppData = RuntimeTypes.AppData;
/** @deprecated Import type `AppLoadContext` from `@remix-run/{cloudflare|node}` instead. */
export type AppLoadContext = RuntimeTypes.AppLoadContext;
/** @deprecated Import type `Cookie` from `@remix-run/{cloudflare|node}` instead. */
export type Cookie = RuntimeTypes.Cookie;
/** @deprecated Import type `CookieOptions` from `@remix-run/{cloudflare|node}` instead. */
export type CookieOptions = RuntimeTypes.CookieOptions;
/** @deprecated Import type `CookieParseOptions` from `@remix-run/{cloudflare|node}` instead. */
export type CookieParseOptions = RuntimeTypes.CookieParseOptions;
/** @deprecated Import type `CookieSerializeOptions` from `@remix-run/{cloudflare|node}` instead. */
export type CookieSerializeOptions = RuntimeTypes.CookieSerializeOptions;
/** @deprecated Import type `CookieSignatureOptions` from `@remix-run/{cloudflare|node}` instead. */
export type CookieSignatureOptions = RuntimeTypes.CookieSignatureOptions;
/** @deprecated Import type `EntryContext` from `@remix-run/{cloudflare|node}` instead. */
export type EntryContext = RuntimeTypes.EntryContext;
/** @deprecated Import type `ErrorBoundaryComponent` from `@remix-run/{cloudflare|node}` instead. */
export type ErrorBoundaryComponent = RuntimeTypes.ErrorBoundaryComponent;
/** @deprecated Import type `HandleDataRequestFunction` from `@remix-run/{cloudflare|node}` instead. */
export type HandleDataRequestFunction = RuntimeTypes.HandleDataRequestFunction;
/** @deprecated Import type `HandleDocumentRequestFunction` from `@remix-run/{cloudflare|node}` instead. */
export type HandleDocumentRequestFunction =
  RuntimeTypes.HandleDocumentRequestFunction;
/** @deprecated Import type `HeadersFunction` from `@remix-run/{cloudflare|node}` instead. */
export type HeadersFunction = RuntimeTypes.HeadersFunction;
/** @deprecated Import type `HtmlLinkDescriptor` from `@remix-run/{cloudflare|node}` instead. */
export type HtmlLinkDescriptor = RuntimeTypes.HtmlLinkDescriptor;
/** @deprecated Import type `HtmlMetaDescriptor` from `@remix-run/{cloudflare|node}` instead. */
export type HtmlMetaDescriptor = RuntimeTypes.HtmlMetaDescriptor;
/** @deprecated Import type `LinkDescriptor` from `@remix-run/{cloudflare|node}` instead. */
export type LinkDescriptor = RuntimeTypes.LinkDescriptor;
/** @deprecated Import type `LinksFunction` from `@remix-run/{cloudflare|node}` instead. */
export type LinksFunction = RuntimeTypes.LinksFunction;
/** @deprecated Import type `LoaderFunction` from `@remix-run/{cloudflare|node}` instead. */
export type LoaderFunction = RuntimeTypes.LoaderFunction;
/** @deprecated Import type `MetaDescriptor` from `@remix-run/{cloudflare|node}` instead. */
export type MetaDescriptor = RuntimeTypes.MetaDescriptor;
/** @deprecated Import type `MetaFunction` from `@remix-run/{cloudflare|node}` instead. */
export type MetaFunction = RuntimeTypes.MetaFunction;
/** @deprecated Import type `PageLinkDescriptor` from `@remix-run/{cloudflare|node}` instead. */
export type PageLinkDescriptor = RuntimeTypes.PageLinkDescriptor;
/** @deprecated Import type `RequestHandler` from `@remix-run/{cloudflare|node}` instead. */
export type RequestHandler = RuntimeTypes.RequestHandler;
/** @deprecated Import type `RouteComponent` from `@remix-run/{cloudflare|node}` instead. */
export type RouteComponent = RuntimeTypes.RouteComponent;
/** @deprecated Import type `RouteHandle` from `@remix-run/{cloudflare|node}` instead. */
export type RouteHandle = RuntimeTypes.RouteHandle;
/** @deprecated Import type `ServerBuild` from `@remix-run/{cloudflare|node}` instead. */
export type ServerBuild = RuntimeTypes.ServerBuild;
/** @deprecated Import type `ServerEntryModule` from `@remix-run/{cloudflare|node}` instead. */
export type ServerEntryModule = RuntimeTypes.ServerEntryModule;
/** @deprecated Import type `Session` from `@remix-run/{cloudflare|node}` instead. */
export type Session = RuntimeTypes.Session;
/** @deprecated Import type `SessionData` from `@remix-run/{cloudflare|node}` instead. */
export type SessionData = RuntimeTypes.SessionData;
/** @deprecated Import type `SessionIdStorageStrategy` from `@remix-run/{cloudflare|node}` instead. */
export type SessionIdStorageStrategy = RuntimeTypes.SessionIdStorageStrategy;
/** @deprecated Import type `SessionStorage` from `@remix-run/{cloudflare|node}` instead. */
export type SessionStorage = RuntimeTypes.SessionStorage;
