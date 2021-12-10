import { splitCookiesString } from "set-cookie-parser";

import type { ServerBuild } from "./build";
import type { ServerRoute } from "./routes";
import type { RouteMatch } from "./routeMatching";
import type { AssetsManifest } from "./entry";
import type { EntryRouteModule, RouteModules } from "./routeModules";

export function getDocumentHeaders(
  build: ServerBuild,
  matches: RouteMatch<ServerRoute>[],
  routeLoaderResponses: Response[],
  actionResponse?: Response
): Headers {
  return matches.reduce((parentHeaders, match, index) => {
    let routeModule = build.routes[match.route.id].module;
    let loaderHeaders = routeLoaderResponses[index]
      ? routeLoaderResponses[index].headers
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

function prependCookies(parentHeaders: Headers, childHeaders: Headers): void {
  let parentSetCookieString = parentHeaders.get("Set-Cookie");

  if (parentSetCookieString) {
    let cookies = splitCookiesString(parentSetCookieString);
    cookies.forEach(cookie => {
      childHeaders.append("Set-Cookie", cookie);
    });
  }
}

export function getStreamingHeaders(
  build: ServerBuild,
  matches: RouteMatch<ServerRoute>[],
  routeModules: RouteModules<EntryRouteModule>,
  actionResponse?: Response
) {
  let headers = new Headers();

  if (actionResponse) {
    prependCookies(actionResponse.headers, headers);
  }

  let scripts = getModuleLinkHrefs(matches, build.assets);
  let preloads = getPreloadLinks(matches, routeModules);

  let scriptLinks = dedupeHrefs(scripts)
    .map(href => `<${href}>; rel="modulepreload"`)
    .join(",");

  let assetPreloads = preloads
    .map(link => {
      let as = link.rel === "stylesheet" ? "style" : link.as;
      return `<${link.href}>; rel="preload"; as="${as}"`;
    })
    .join(",");

  headers.append("Link", scriptLinks);
  headers.append("Link", assetPreloads);

  return headers;
}

export function getModuleLinkHrefs(
  matches: RouteMatch<ServerRoute>[],
  manifest: AssetsManifest
): string[] {
  return dedupeHrefs(
    matches
      .map(match => {
        let route = manifest.routes[match.route.id];
        let hrefs = [route.module];
        if (route.imports) {
          hrefs = hrefs.concat(route.imports);
        }
        return hrefs;
      })
      .flat(1)
  );
}

function dedupeHrefs(hrefs: string[]): string[] {
  return [...new Set(hrefs)];
}

export function getPreloadLinks(
  matches: RouteMatch<ServerRoute>[],
  routeModules: RouteModules<EntryRouteModule>
) {
  let links = matches.map(match => {
    let mod = routeModules[match.route.id];
    return mod.links ? mod.links() : [];
  });

  return links
    .flat(1)
    .filter(isHtmlLinkDescriptor)
    .filter(link => link.rel === "stylesheet" || link.rel === "preload")
    .map(({ rel, ...attrs }) => {
      if (rel === "preload") {
        return { rel: "preload", ...attrs };
      }
      return { rel: "preload", as: "style", ...attrs };
    });
}

export function isHtmlLinkDescriptor(
  object: any
): object is { rel: string; href: string; as?: string } {
  return (
    object != null &&
    typeof object.rel === "string" &&
    typeof object.href === "string"
  );
}
