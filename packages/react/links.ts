import type { Location } from "history";
import type {
  AssetsManifest,
  RouteModule,
  LinkDescriptor,
  HTMLLinkDescriptor,
  PageLinkDescriptor,
  BlockLinkDescriptor
} from "@remix-run/node";

import type { RouteData } from "./data";
import type { ClientRouteMatch, ClientRoute } from "./routes";
import { matchClientRoutes as matchRoutes } from "./routes";
import type { RouteModules } from "./routeModules";

export function block(link: HTMLLinkDescriptor): BlockLinkDescriptor {
  return { blocker: true, link };
}

export async function preloadBlockingLinks(
  routeModule: RouteModule,
  data: RouteData
): Promise<void[]> {
  if (!routeModule.links) {
    return [];
  }

  let descriptors = routeModule.links({ data });
  if (!descriptors) return [];

  let blockingLinks = [];
  for (let descriptor of descriptors) {
    if (isPageLinkDescriptor(descriptor)) continue;
    if (isBlockLinkDescriptor(descriptor)) {
      blockingLinks.push(descriptor.link);
    } else if (descriptor.rel === "stylesheet") {
      blockingLinks.push({ ...descriptor, rel: "preload", as: "style" });
    }
  }

  return Promise.all(blockingLinks.map(preloadBlockingLink));
}

async function preloadBlockingLink(
  descriptor: HTMLLinkDescriptor
): Promise<void> {
  if (descriptor.rel !== "preload" || !descriptor.as || !descriptor.href) {
    console.warn(
      `Can only block links with the following shape: ` +
        `\`{ rel: "preload", as: string, href: string }\`, ` +
        `ignoring: ${JSON.stringify(descriptor)}`
    );

    return;
  }

  return new Promise(resolve => {
    let link = document.createElement("link");
    Object.assign(link, descriptor);

    link.onload = async () => {
      try {
        // TODO: what happens when they click another link fast? will react
        // flip out about this being in the head? Wrapped in try/catch just
        // in case.
        document.head.removeChild(link);
      } catch (error) {}

      if (link.as === "image") {
        await moveImageFromDiskToMemoryCacheToAvoidLayoutShift(descriptor.href);
      }

      resolve();
    };

    document.head.appendChild(link);
  });
}

function moveImageFromDiskToMemoryCacheToAvoidLayoutShift(
  src: string
): Promise<void> {
  return new Promise(resolve => {
    let img = document.createElement("img");
    img.src = src;
    img.style.position = "absolute";
    img.style.left = "-9999px";
    img.onload = () => {
      document.body.removeChild(img);
      resolve();
    };
    document.body.appendChild(img);
  });
}

export function getLinks(
  location: Location,
  matches: ClientRouteMatch[],
  routeData: RouteData,
  routeModules: RouteModules,
  manifest: AssetsManifest,
  clientRoutes: ClientRoute[]
): HTMLLinkDescriptor[] {
  let descriptors = matches
    .map((match): LinkDescriptor[] => {
      let module = routeModules[match.route.id];
      if (module.links) {
        let data = routeData[match.route.id];
        return module.links({ data });
      }
      return [];
    })
    .flat(1);

  let htmlLinkDescriptors = descriptors
    .map(descriptor => {
      if (isPageLinkDescriptor(descriptor)) {
        return getPageLinkDescriptors(
          descriptor,
          location,
          matches,
          manifest,
          clientRoutes
        );
      } else if (isBlockLinkDescriptor(descriptor)) {
        return [descriptor.link];
      } else if (descriptor.rel === "stylesheet") {
        // add styles as preloads so they download with higher priority than
        // modulepreloads in `<Scripts>`. Otherwise rendering is blocked by
        // modules because rendering is blocked by styles by the browser, and
        // styles, without preloading, would be lower priority than the
        // modulepreloads.
        let { type, rel, ...rest } = descriptor;
        return [{ rel: "preload", as: "style", ...rest }, descriptor];
      } else {
        return [descriptor];
      }
    })
    .flat(1);

  let preloads = getCurrentPageModulePreloadHrefs(matches, manifest);
  return dedupe(htmlLinkDescriptors, preloads);
}

////////////////////////////////////////////////////////////////////////////////
function isPageLinkDescriptor(object: any): object is PageLinkDescriptor {
  return object != null && typeof object.page === "string";
}

function isBlockLinkDescriptor(object: any): object is BlockLinkDescriptor {
  return object != null && object.blocker === true;
}

function getPageLinkDescriptors(
  descriptor: PageLinkDescriptor,
  location: Location,
  matches: ClientRouteMatch[],
  manifest: AssetsManifest,
  clientRoutes: ClientRoute[]
): HTMLLinkDescriptor[] {
  let [pathname, search = ""] = descriptor.page.split("?");
  let nextMatches = matchRoutes(clientRoutes, pathname);

  if (!nextMatches) {
    console.warn(`No routes match ${descriptor.page}, ignoring page prefetch.`);
    return [];
  }

  let links = [getPageScripts(descriptor, nextMatches, manifest)];

  if (descriptor.data === true) {
    // NOTE: keep in sync with components.tsx data diff
    let newMatches =
      location.search !== search
        ? nextMatches
        : nextMatches.filter(
            (match, index) =>
              // new route
              !matches[index] ||
              // existing route but params changed
              matches[index].pathname !== match.pathname ||
              // catchall param changed
              matches[index].params["*"] !== match.params["*"]
          );

    links = links.concat(getDataLinks(descriptor, newMatches, manifest));
  }

  return links.flat(1);
}

function getDataLinks(
  descriptor: PageLinkDescriptor,
  matches: ClientRouteMatch[],
  manifestPatch: AssetsManifest
): HTMLLinkDescriptor[] {
  let { page, data, ...rest } = descriptor;
  return matches
    .filter(match => manifestPatch.routes[match.route.id].hasLoader)
    .map(match => {
      let [pathname, search] = descriptor.page.split("?");
      let searchParams = new URLSearchParams(search);
      searchParams.append("_data", match.route.id);
      let href = `${pathname}?${searchParams}`;
      return { rel: "prefetch", as: "fetch", href, ...rest };
    });
}

// The `<Script>` will render rel=modulepreload for the current page, we don't
// need to include them in a page prefetch, this gives us the list to remove
// while deduping.
function getCurrentPageModulePreloadHrefs(
  matches: ClientRouteMatch[],
  manifest: AssetsManifest
): string[] {
  return matches
    .map(match => {
      let route = manifest.routes[match.route.id];
      let hrefs = [route.module];

      if (route.imports) {
        hrefs = hrefs.concat(route.imports);
      }

      return hrefs;
    })
    .flat(1);
}

function getPageScripts(
  descriptor: PageLinkDescriptor,
  matches: ClientRouteMatch[],
  manifestPatch: AssetsManifest
): HTMLLinkDescriptor[] {
  let { page, data, ...rest } = descriptor;
  return matches
    .map(match => {
      let route = manifestPatch.routes[match.route.id];
      let hrefs = [route.module];
      if (route.imports) {
        hrefs = hrefs.concat(route.imports);
      }

      return hrefs.map(
        (href): HTMLLinkDescriptor => ({
          href,
          rel: "prefetch",
          as: "script",
          ...rest
        })
      );
    })
    .flat(1);
}

function dedupe(descriptors: HTMLLinkDescriptor[], preloads: string[]) {
  let set = new Set();
  let preloadsSet = new Set(preloads);

  return descriptors.reduce((deduped, descriptor) => {
    let alreadyModulePreload =
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
  }, [] as HTMLLinkDescriptor[]);
}
