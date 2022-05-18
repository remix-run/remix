import type { AssetsManifest } from "@remix-run/dev/assets-manifest";
let assetsManifest: AssetsManifest = (window as any).__remixManifest;
const cssModulesStylesheetUrl =
  assetsManifest.cssModules?.stylesheetUrl;
export { cssModulesStylesheetUrl };
