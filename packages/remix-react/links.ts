// TODO: We eventually might not want to import anything directly from `history`
// and leverage `react-router` here instead
import type { Location } from "history";
import { parsePath } from "history";

import type { AssetsManifest } from "./entry";
import type { ClientRoute } from "./routes";
import type { RouteMatch } from "./routeMatching";
// import { matchClientRoutes } from "./routeMatching";
import type { RouteModules, RouteModule } from "./routeModules";
import { loadRouteModule } from "./routeModules";

type Primitive = null | undefined | string | number | boolean | symbol | bigint;

type LiteralUnion<LiteralType, BaseType extends Primitive> =
  | LiteralType
  | (BaseType & Record<never, never>);

/**
 * Represents a `<link>` element.
 *
 * WHATWG Specification: https://html.spec.whatwg.org/multipage/semantics.html#the-link-element
 */
export interface HtmlLinkDescriptor {
  /**
   * Address of the hyperlink
   */
  href: string;

  /**
   * How the element handles crossorigin requests
   */
  crossOrigin?: "anonymous" | "use-credentials";

  /**
   * Relationship between the document containing the hyperlink and the destination resource
   */
  rel: LiteralUnion<
    | "alternate"
    | "dns-prefetch"
    | "icon"
    | "manifest"
    | "modulepreload"
    | "next"
    | "pingback"
    | "preconnect"
    | "prefetch"
    | "preload"
    | "prerender"
    | "search"
    | "stylesheet",
    string
  >;

  /**
   * Applicable media: "screen", "print", "(max-width: 764px)"
   */
  media?: string;

  /**
   * Integrity metadata used in Subresource Integrity checks
   */
  integrity?: string;

  /**
   * Language of the linked resource
   */
  hrefLang?: string;

  /**
   * Hint for the type of the referenced resource
   */
  type?: string;

  /**
   * Referrer policy for fetches initiated by the element
   */
  referrerPolicy?:
    | ""
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "same-origin"
    | "origin"
    | "strict-origin"
    | "origin-when-cross-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url";

  /**
   * Sizes of the icons (for rel="icon")
   */
  sizes?: string;

  /**
   * Images to use in different situations, e.g., high-resolution displays, small monitors, etc. (for rel="preload")
   */
  imagesrcset?: string;

  /**
   * Image sizes for different page layouts (for rel="preload")
   */
  imagesizes?: string;

  /**
   * Potential destination for a preload request (for rel="preload" and rel="modulepreload")
   */
  as?: LiteralUnion<
    | "audio"
    | "audioworklet"
    | "document"
    | "embed"
    | "fetch"
    | "font"
    | "frame"
    | "iframe"
    | "image"
    | "manifest"
    | "object"
    | "paintworklet"
    | "report"
    | "script"
    | "serviceworker"
    | "sharedworker"
    | "style"
    | "track"
    | "video"
    | "worker"
    | "xslt",
    string
  >;

  /**
   * Color to use when customizing a site's icon (for rel="mask-icon")
   */
  color?: string;

  /**
   * Whether the link is disabled
   */
  disabled?: boolean;

  /**
   * The title attribute has special semantics on this element: Title of the link; CSS style sheet set name.
   */
  title?: string;
}

export interface PrefetchPageDescriptor
  extends Omit<
    HtmlLinkDescriptor,
    | "href"
    | "rel"
    | "type"
    | "sizes"
    | "imagesrcset"
    | "imagesizes"
    | "as"
    | "color"
    | "title"
  > {
  /**
   * The absolute path of the page to prefetch.
   */
  page: string;
}

export type LinkDescriptor = HtmlLinkDescriptor | PrefetchPageDescriptor;

////////////////////////////////////////////////////////////////////////////////

/**
 * Gets all the links for a set of matches. The modules are assumed to have been
 * loaded already.
 */
export function getLinksForMatches(
  matches: RouteMatch<ClientRoute>[],
  routeModules: RouteModules,
  manifest: AssetsManifest
): LinkDescriptor[] {
  let descriptors = matches
    .map((match): LinkDescriptor[] => {
      let module = routeModules[match.route.id];
      return module.links?.() || [];
    })
    .flat(1);

  let preloads = getCurrentPageModulePreloadHrefs(matches, manifest);
  return dedupe(descriptors, preloads);
}

export async function prefetchStyleLinks(
  routeModule: RouteModule
): Promise<void> {
  if (!routeModule.links) return;
  let descriptors = routeModule.links();
  if (!descriptors) return;

  let styleLinks = [];
  for (let descriptor of descriptors) {
    if (!isPageLinkDescriptor(descriptor) && descriptor.rel === "stylesheet") {
      styleLinks.push({ ...descriptor, rel: "preload", as: "style" });
    }
  }

  // don't block for non-matching media queries
  let matchingLinks = styleLinks.filter(
    link => !link.media || window.matchMedia(link.media).matches
  );

  await Promise.all(matchingLinks.map(prefetchStyleLink));
}

async function prefetchStyleLink(
  descriptor: HtmlLinkDescriptor
): Promise<void> {
  return new Promise(resolve => {
    let link = document.createElement("link");
    Object.assign(link, descriptor);

    function removeLink() {
      // if a navigation interrupts this prefetch React will update the <head>
      // and remove the link we put in there manually, so we check if it's still
      // there before trying to remove it
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    }

    link.onload = () => {
      removeLink();
      resolve();
    };

    link.onerror = () => {
      removeLink();
      resolve();
    };

    document.head.appendChild(link);
  });
}

////////////////////////////////////////////////////////////////////////////////
export function isPageLinkDescriptor(
  object: any
): object is PrefetchPageDescriptor {
  return object != null && typeof object.page === "string";
}

export function isHtmlLinkDescriptor(
  object: any
): object is HtmlLinkDescriptor {
  return (
    object != null &&
    typeof object.rel === "string" &&
    typeof object.href === "string"
  );
}

export async function getStylesheetPrefetchLinks(
  matches: RouteMatch<ClientRoute>[],
  routeModules: RouteModules
) {
  let links = await Promise.all(
    matches.map(async match => {
      let mod = await loadRouteModule(match.route, routeModules);
      return mod.links ? mod.links() : [];
    })
  );

  return links
    .flat(1)
    .filter(isHtmlLinkDescriptor)
    .filter(link => link.rel === "stylesheet" || link.rel === "preload")
    .map(({ rel, ...attrs }) =>
      rel === "preload"
        ? { rel: "prefetch", ...attrs }
        : { rel: "prefetch", as: "style", ...attrs }
    );
}

// This is ridiculously identical to transition.ts `filterMatchesToLoad`
export function getNewMatchesForLinks(
  page: string,
  nextMatches: RouteMatch<ClientRoute>[],
  currentMatches: RouteMatch<ClientRoute>[],
  location: Location,
  mode: "data" | "assets"
): RouteMatch<ClientRoute>[] {
  let path = parsePathPatch(page);

  let isNew = (match: RouteMatch<ClientRoute>, index: number) => {
    if (!currentMatches[index]) return true;
    return match.route.id !== currentMatches[index].route.id;
  };

  let matchPathChanged = (match: RouteMatch<ClientRoute>, index: number) => {
    return (
      // param change, /users/123 -> /users/456
      currentMatches[index].pathname !== match.pathname ||
      // splat param changed, which is not present in match.path
      // e.g. /files/images/avatar.jpg -> files/finances.xls
      (currentMatches[index].route.path?.endsWith("*") &&
        currentMatches[index].params["*"] !== match.params["*"])
    );
  };

  // NOTE: keep this mostly up-to-date w/ the transition data diff, but this
  // version doesn't care about submissions
  let newMatches =
    mode === "data" && location.search !== path.search
      ? // this is really similar to stuff in transition.ts, maybe somebody smarter
        // than me (or in less of a hurry) can share some of it. You're the best.
        nextMatches.filter((match, index) => {
          if (!match.route.hasLoader) {
            return false;
          }

          if (isNew(match, index) || matchPathChanged(match, index)) {
            return true;
          }

          if (match.route.shouldReload) {
            return match.route.shouldReload({
              params: match.params,
              prevUrl: new URL(
                location.pathname + location.search + location.hash,
                window.origin
              ),
              url: new URL(page, window.origin)
            });
          }
          return true;
        })
      : nextMatches.filter((match, index) => {
          return (
            match.route.hasLoader &&
            (isNew(match, index) || matchPathChanged(match, index))
          );
        });

  return newMatches;
}

export function getDataLinkHrefs(
  page: string,
  matches: RouteMatch<ClientRoute>[],
  manifest: AssetsManifest
): string[] {
  let path = parsePathPatch(page);
  return dedupeHrefs(
    matches
      .filter(match => manifest.routes[match.route.id].hasLoader)
      .map(match => {
        let { pathname, search } = path;
        let searchParams = new URLSearchParams(search);
        searchParams.set("_data", match.route.id);
        return `${pathname}?${searchParams}`;
      })
  );
}

export function getModuleLinkHrefs(
  matches: RouteMatch<ClientRoute>[],
  manifestPatch: AssetsManifest
): string[] {
  return dedupeHrefs(
    matches
      .map(match => {
        let route = manifestPatch.routes[match.route.id];
        let hrefs = [route.module];
        if (route.imports) {
          hrefs = hrefs.concat(route.imports);
        }
        return hrefs;
      })
      .flat(1)
  );
}

// The `<Script>` will render rel=modulepreload for the current page, we don't
// need to include them in a page prefetch, this gives us the list to remove
// while deduping.
function getCurrentPageModulePreloadHrefs(
  matches: RouteMatch<ClientRoute>[],
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

export function dedupe(descriptors: LinkDescriptor[], preloads: string[]) {
  let set = new Set();
  let preloadsSet = new Set(preloads);

  return descriptors.reduce((deduped, descriptor) => {
    let alreadyModulePreload =
      !isPageLinkDescriptor(descriptor) &&
      descriptor.as === "script" &&
      descriptor.href &&
      preloadsSet.has(descriptor.href);

    if (alreadyModulePreload) {
      return deduped;
    }

    let str = JSON.stringify(descriptor);
    if (!set.has(str)) {
      set.add(str);
      deduped.push(descriptor);
    }

    return deduped;
  }, [] as LinkDescriptor[]);
}

// https://github.com/remix-run/history/issues/897
function parsePathPatch(href: string) {
  let path = parsePath(href);
  if (path.search === undefined) path.search = "";
  return path;
}
