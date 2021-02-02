import type { Location } from "history";
import type { EntryManifest } from "@remix-run/core";

export type Manifest = EntryManifest;

/**
 * Dynamically loads a portion of the manifest from the server.
 */
export async function loadManifest(
  manifest: Manifest,
  location: Location,
  autoReload = true
): Promise<void> {
  let patch = await fetchManifestPatch(location, manifest.version);

  if (patch) {
    Object.assign(manifest.routes, patch.routes);
  } else if (autoReload) {
    // Wait indefinitely for the reload.
    return new Promise(() => {
      window.location.reload();
    });
  }
}

async function fetchManifestPatch(
  location: Location,
  currentVersion: string
): Promise<Manifest | null> {
  let origin = window.location.origin;
  let url = new URL(location.pathname + location.search, origin);
  url.searchParams.set("_manifest", currentVersion);
  url.searchParams.sort(); // Improves caching

  let res = await fetch(url.href);

  if (
    res.status === 200 &&
    // Return the manifest only if the version has not changed. If it has, we
    // need to refresh or we'll be in a bad state.
    res.headers.get("ETag") === currentVersion
  ) {
    return res.json();
  }

  return null;
}
