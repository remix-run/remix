import type { BuildManifest, RouteManifest } from "@remix-run/core";

interface Manifest {
  assets: BuildManifest;
  routes: RouteManifest;
}

export interface ManifestCache {
  preload(pathname: string, reloadOnNotFound?: boolean): Promise<unknown>;
  read(): Manifest;
}

interface ManifestPatch {
  buildManifest: BuildManifest;
  routeManifest: RouteManifest;
}

export function createManifestCache(
  initialPathname: string,
  initialAssets: BuildManifest,
  initialRoutes: RouteManifest
): ManifestCache {
  let patchCache: { [pathname: string]: ManifestPatch | null } = {
    [initialPathname]: {
      buildManifest: initialAssets,
      routeManifest: initialRoutes
    }
  };

  let cache = {
    assets: initialAssets,
    routes: initialRoutes
  };

  async function preload(pathname: string, reloadOnNotFound = false) {
    if (patchCache[pathname]) {
      return patchCache[pathname];
    }

    let patch = await fetchManifestPatch(pathname);
    patchCache[pathname] = patch;

    if (patch) {
      Object.assign(cache.assets, patch.buildManifest);
      Object.assign(cache.routes, patch.routeManifest);
    } else if (reloadOnNotFound) {
      // Never resolve so we will not try to rerender this
      // page before the reload.
      return new Promise(() => {
        window.location.reload();
      });
    }
  }

  function read() {
    return cache;
  }

  return { preload, read };
}

async function fetchManifestPatch(path: string): Promise<ManifestPatch | null> {
  let res = await fetch(`/__remix_manifest?path=${path}`);
  if (res.status === 404) return null;
  return await res.json();
}
