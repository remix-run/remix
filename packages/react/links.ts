import type { EntryManifest, RouteModule } from "@remix-run/core";
import { ClientRouteObject, matchClientRoutes as matchRoutes } from "./routes";
import type { ClientRouteMatch } from "./routes";
import type { RouteData } from "./data";
import { RouteModules } from "./routeModules";
import { Location } from "history";
import type {
  LinkDescriptor,
  HTMLLinkDescriptor,
  PageLinkDescriptor,
  BlockLinkDescriptor
} from "@remix-run/core/links";

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

  let links = descriptors.reduce((transitionLinks, descriptor) => {
    if (isPageLinkDescriptor(descriptor)) {
      return transitionLinks;
    } else if (isBlockDescriptor(descriptor)) {
      transitionLinks.push(descriptor.link);
    } else if (descriptor.rel === "stylesheet") {
      transitionLinks.push({
        ...descriptor, // get media/crossOrigin in, etc.
        rel: "preload",
        as: "style",
        href: descriptor.href
      });
    }

    return transitionLinks;
  }, [] as HTMLLinkDescriptor[]);

  return Promise.all(
    links.map(async descriptor => {
      if (descriptor.rel !== "preload" || !descriptor.as || !descriptor.href) {
        console.warn(
          `Can only block links with the following shape: \`{ rel: "preload", as: string, href: string }\`, ignoring: ${descriptor}`
        );
        return;
      }

      // Don't care about errors on preloads, the real error will show up later.
      return new Promise<void>(resolve => {
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
            await moveImageFromDiskToMemoryCacheToAvoidLayoutShift(descriptor);
          }
          resolve();
        };

        document.head.appendChild(link);
      });
    })
  );
}

async function moveImageFromDiskToMemoryCacheToAvoidLayoutShift(
  descriptor: HTMLLinkDescriptor
) {
  return new Promise<void>(resolve => {
    let img = document.createElement("img");
    img.src = descriptor.href;
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
  manifest: EntryManifest,
  clientRoutes: ClientRouteObject[]
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
      } else if (isBlockDescriptor(descriptor)) {
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
function isPageLinkDescriptor(link: {
  [key: string]: any;
}): link is PageLinkDescriptor {
  return typeof link.page === "string";
}

function isBlockDescriptor(link: {
  [key: string]: any;
}): link is BlockLinkDescriptor {
  return link.blocker === true;
}

function getPageLinkDescriptors(
  descriptor: PageLinkDescriptor,
  location: Location,
  matches: ClientRouteMatch[],
  manifest: EntryManifest,
  clientRoutes: ClientRouteObject[]
): HTMLLinkDescriptor[] {
  let [pathname, search = ""] = descriptor.page.split("?");
  let nextMatches = matchRoutes(clientRoutes, pathname);

  if (!nextMatches) {
    console.warn(`No routes match ${descriptor.page}, ignoring page prefetch.`);
    return [];
  }

  let links = [getPageScripts(descriptor, nextMatches, manifest)];

  if (descriptor.data === true) {
    // "data diffing" same as in components.tsx
    let newMatches =
      location.search !== search
        ? nextMatches
        : nextMatches.filter(
            (match, index) =>
              !matches[index] || matches[index].pathname !== match.pathname
          );

    links = links.concat(getDataLinks(descriptor, newMatches, manifest));
  }

  return links.flat(1);
}

function getDataLinks(
  descriptor: PageLinkDescriptor,
  matches: ClientRouteMatch[],
  manifestPatch: EntryManifest
): HTMLLinkDescriptor[] {
  let { page, data, ...rest } = descriptor;
  return matches
    .filter(match => manifestPatch.routes[match.route.id].hasLoader)
    .map(match => {
      let [pathname, search] = descriptor.page.split("?");
      let searchParams = new URLSearchParams(search);
      searchParams.append("_data", match.route.id);
      let href = `${pathname}?${searchParams}`;

      return {
        rel: "prefetch",
        as: "fetch",
        href,
        ...rest
      } as HTMLLinkDescriptor;
    });
}

// The `<Script>` will render rel=modulepreload for the current page, we don't
// need to include them in a page prefetch, this gives us the list to remove
// while deduping.
function getCurrentPageModulePreloadHrefs(
  matches: ClientRouteMatch[],
  manifest: EntryManifest
): string[] {
  return matches
    .map(match => {
      let route = manifest.routes[match.route.id];
      let hrefs = [route.moduleUrl];

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
  manifestPatch: EntryManifest
): HTMLLinkDescriptor[] {
  let { page, data, ...rest } = descriptor;
  return matches
    .map(match => {
      let route = manifestPatch.routes[match.route.id];
      let hrefs = [route.moduleUrl];
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
