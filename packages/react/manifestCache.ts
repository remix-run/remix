import type {
  AssetManifest,
  EntryRouteObject,
  RouteManifest
} from "@remix-run/core";

interface Manifest {
  assets: AssetManifest;
  routes: RouteManifest<EntryRouteObject>;
}

export interface ManifestCache {
  preload(pathname: string, reloadOnNotFound?: boolean): Promise<unknown>;
  read(): Manifest;
}

export function createManifestCache(
  initialPathname: string,
  initialAssets: AssetManifest,
  initialRoutes: RouteManifest<EntryRouteObject>
): ManifestCache {
  let patchCache: { [pathname: string]: Manifest | null } = {
    [initialPathname]: {
      assets: initialAssets,
      routes: initialRoutes
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
      Object.assign(cache.assets, patch.assets);
      Object.assign(cache.routes, patch.routes);
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

async function fetchManifestPatch(pathname: string): Promise<Manifest | null> {
  let url = new URL(pathname, window.location.origin);
  let params = new URLSearchParams({ url: url.toString() });
  let res = await fetch(`/__remix_manifest?${params.toString()}`);

  if (res.status === 404) {
    return null;
  }

  return res.json();
}
