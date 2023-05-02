import type { AssetsManifest } from "@remix-run/dev/assets-manifest";

let assetsManifest: AssetsManifest = (window as any).__remixManifest;

declare const __INJECT_CSS_BUNDLE_HREF__: string | undefined;

// Injected by `cssBundleUpdatePlugin` on rebuilds
let updatedHref: string | undefined =
  typeof __INJECT_CSS_BUNDLE_HREF__ === "string"
    ? __INJECT_CSS_BUNDLE_HREF__
    : undefined;

export const cssBundleHref = updatedHref || assetsManifest.cssBundleHref;
