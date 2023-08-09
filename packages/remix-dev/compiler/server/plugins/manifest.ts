import type { Plugin } from "esbuild";
import jsesc from "jsesc";

import type * as Channel from "../../../channel";
import type { RouteManifest } from "../../../config/routes";
import { type Manifest } from "../../../manifest";
import { assetsManifestVirtualModule } from "../virtualModules";
import { Cancel } from "../../cancel";

/**
 * Creates a virtual module called `@remix-run/dev/assets-manifest` that exports
 * the assets manifest. This is used in the server entry module to access the
 * assets manifest in the server build.
 */
export function serverAssetsManifestPlugin(refs: {
  manifestChannel: Channel.Type<Manifest>;
},
  routes: RouteManifest
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
        let manifest = await refs.manifestChannel.result;
        if (!manifest.ok) throw new Cancel("server");

        // Filter out the routes that are not in this bundle
        let manifestWithRoutes = { ...manifest.value };
        let manifestRoutes = { ...manifest.value.routes };
        for (let id in manifestRoutes) {
          if (!(id in routes)) {
            delete manifestRoutes[id];
          }
        }
        manifestWithRoutes.routes = manifestRoutes;

        return {
          contents: `export default ${jsesc(manifestWithRoutes, {
            es6: true,
          })};`,
          loader: "js",
        };
      });
    },
  };
}
