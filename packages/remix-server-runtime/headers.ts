import type { ServerBuild } from "./build";
import type { ServerRoute } from "./routes";
import type { RouteMatch } from "./routeMatching";

export function getDocumentHeaders(
  build: ServerBuild,
  matches: RouteMatch<ServerRoute>[],
  routeLoaderResponses: Response[]
): Headers {
  return matches.reduce((parentHeaders, match, index) => {
    let routeModule = build.routes[match.route.id].module;
    let loaderHeaders = routeLoaderResponses[index]
      ? routeLoaderResponses[index].headers
      : new Headers();
    let headers = new Headers(
      routeModule.headers
        ? routeModule.headers({ loaderHeaders, parentHeaders })
        : undefined
    );

    // Automatically preserve Set-Cookie headers that were set either by the
    // loader or by a parent route.
    prependCookies(loaderHeaders, headers);
    prependCookies(parentHeaders, headers);

    return headers;
  }, new Headers());
}

function prependCookies(parentHeaders: Headers, childHeaders: Headers): void {
  for (const [key, values] of Object.entries(parentHeaders.raw())) {
    if (key.toLowerCase() === "set-cookie") {
      for (const value of values) {
        childHeaders.append(key, value);
      }
    }
  }
}
