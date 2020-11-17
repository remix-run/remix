import type { Manifest } from "./manifest";

// Without this we have a flash of unstyled content when the css takes longer to
// load than the rest of the transition (manifest, data, modules). While our
// <Styles> component does the actual rendering of these stylesheets, this
// imperatively loads and waits for the resources before allowing the transition
// to move on. When the <Styles> component renders these same URLs, the browser
// should use the cache and avoid FOUC.
//
// This implementation expects long cache-control on css resources because when
// the transition completes, these links have been removed and the <Styles> tag
// adds new ones with the same href. If max-age isn't at least a few seconds
// then the browser will go get a 304 from the server. Which is probably still
// fine, but it'd be better if max-age was one year. Since our build hashes
// these filenames, and all of our deployment wrappers have good static asset
// handling, we can expect max-age of one year, so there shouldn't be any
// FOUC in production.

/**
 * Dynamically loads the stylesheet for a route from the server.
 */
export function loadRouteStyleSheet(
  manifest: Manifest,
  routeId: string
): Promise<void> {
  let href = manifest.styles[routeId];

  if (!href) {
    return Promise.resolve();
  }

  return loadStyleSheet(href);
}

let preloads: { [href: string]: Promise<void> } = {};

function loadStyleSheet(href: string): Promise<void> {
  if (preloads[href]) {
    return preloads[href];
  }

  let preloadPromise = new Promise<void>(accept => {
    let link = document.createElement("link");

    link.rel = "preload";
    link.as = "style";
    link.href = href;
    link.onload = () => {
      document.head.removeChild(link);
      accept();
    };

    // have to append to get it to actually load
    document.head.appendChild(link);
  });

  preloads[href] = preloadPromise;

  return preloadPromise;
}
