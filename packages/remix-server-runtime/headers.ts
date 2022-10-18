import { splitCookiesString } from "set-cookie-parser";

import type { ServerBuild } from "./build";
import type { ServerRoute } from "./routes";
import type { RouteMatch } from "./routeMatching";
import type { StaticHandlerContext } from "./router";

export function getDocumentHeaders(
  build: ServerBuild,
  matches: RouteMatch<ServerRoute>[],
  routeLoaderResponses: Record<string, Response>,
  actionResponse?: Response
): Headers {
  return matches.reduce((parentHeaders, match, index) => {
    let routeModule = build.routes[match.route.id].module;
    let routeLoaderResponse = routeLoaderResponses[match.route.id];
    let loaderHeaders = routeLoaderResponse
      ? routeLoaderResponse.headers
      : new Headers();
    let actionHeaders = actionResponse ? actionResponse.headers : new Headers();
    let headers = new Headers(
      routeModule.headers
        ? typeof routeModule.headers === "function"
          ? routeModule.headers({ loaderHeaders, parentHeaders, actionHeaders })
          : routeModule.headers
        : undefined
    );

    // Automatically preserve Set-Cookie headers that were set either by the
    // loader or by a parent route.
    prependCookies(actionHeaders, headers);
    prependCookies(loaderHeaders, headers);
    prependCookies(parentHeaders, headers);

    return headers;
  }, new Headers());
}

export function getDocumentHeadersRR(
  context: StaticHandlerContext,
  matches: RouteMatch<ServerRoute>[]
) {
  let parentHeaders = new Headers();

  for (let match of matches) {
    let id = match.route.id;
    let { headers } = match.route.module || {};
    if (!headers) continue;

    let loaderHeaders = context.loaderHeaders?.[id] || new Headers();
    let actionHeaders = context.actionHeaders?.[id] || new Headers();

    let newHeaders = new Headers(
      typeof headers === "function"
        ? headers({
            loaderHeaders,
            actionHeaders,
            parentHeaders,
          })
        : headers
    );

    // Automatically preserve Set-Cookie headers that were set either by the
    // loader or by a parent route.
    prependCookies(actionHeaders, newHeaders);
    prependCookies(loaderHeaders, newHeaders);
    prependCookies(parentHeaders, newHeaders);
    parentHeaders = newHeaders;
  }

  return parentHeaders;
}

function prependCookies(parentHeaders: Headers, childHeaders: Headers): void {
  let parentSetCookieString = parentHeaders.get("Set-Cookie");

  if (parentSetCookieString) {
    let cookies = splitCookiesString(parentSetCookieString);
    cookies.forEach((cookie) => {
      childHeaders.append("Set-Cookie", cookie);
    });
  }
}
