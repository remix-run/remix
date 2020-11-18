import type { EntryManifest } from "@remix-run/core";

export type Manifest = EntryManifest;

/**
 * Dynamically loads a portion of the manifest from the server.
 */
export async function loadManifest(
  manifest: Manifest,
  pathname: string,
  autoReload = true
): Promise<void> {
  let patch = await fetchManifestPatch(pathname, manifest.version);

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
  pathname: string,
  currentVersion: string
): Promise<Manifest | null> {
  let params = new URLSearchParams({
    url: new URL(pathname, window.location.origin).toString(),
    // Include the version so the browser can cache the response forever.
    v: currentVersion
  });

  let res = await fetch(`/_remix/manifest?${params.toString()}`);

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
