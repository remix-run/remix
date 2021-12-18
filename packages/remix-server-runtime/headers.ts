import { splitCookiesString } from "set-cookie-parser";

import type { ServerBuild } from "./build";
import type { ServerRoute } from "./routes";
import type { RouteMatch } from "./routeMatching";

export function getDocumentHeaders(
  build: ServerBuild,
  matches: RouteMatch<ServerRoute>[],
  routeLoaderResponses: Response[],
  actionResponse?: Response
): Headers {
  return matches.reduce((parentHeaders, match, index) => {
    const routeModule = build.routes[match.route.id].module;
    const loaderHeaders = routeLoaderResponses[index]
      ? routeLoaderResponses[index].headers
      : new Headers();
    const actionHeaders = actionResponse ? actionResponse.headers : new Headers();
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

function prependCookies(parentHeaders: Headers, childHeaders: Headers): void {
  const parentSetCookieString = parentHeaders.get("Set-Cookie");

  if (parentSetCookieString) {
    const cookies = splitCookiesString(parentSetCookieString);
    cookies.forEach(cookie => {
      childHeaders.append("Set-Cookie", cookie);
    });
  }
}
