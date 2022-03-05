import type { AssetsManifest } from "@remix-run/dev/assets-manifest";
let assetsManifest: AssetsManifest = (window as any).__remixManifest;
export default assetsManifest.cssModules?.globalStylesheetFileUrl;
