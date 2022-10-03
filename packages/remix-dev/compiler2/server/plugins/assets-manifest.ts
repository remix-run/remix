import type { Plugin } from "esbuild";
import jsesc from "jsesc";

import type { AssetsManifest } from "../../../compiler/assets";
import { assetsManifestVirtualModule } from "../../../compiler/virtualModules";

/**
 * Creates a virtual module called `@remix-run/dev/assets-manifest` that exports
 * the assets manifest. This is used in the server entry module to access the
 * assets manifest in the server build.
 */
export function assetsManifestPlugin(
  manifestPromise: Promise<AssetsManifest>
): Plugin {
  let filter = assetsManifestVirtualModule.filter;

  return {
    name: "server-assets-manifest",
    setup(build) {
      build.onResolve({ filter }, ({ path }) => {
        return {
          path,
          namespace: "server-assets-manifest",
        };
      });

      build.onLoad({ filter }, async () => {
        let manifest = await manifestPromise;

        return {
          contents: `export default ${jsesc(manifest, { es6: true })};`,
          loader: "js",
        };
      });
    },
  };
}
