import type { Plugin } from "esbuild";
import jsesc from "jsesc";
import invariant from "../../invariant";

export type BrowserManifestPromiseRef = { current?: Promise<unknown> };
import type { serverEntryModulesPlugin } from "./serverEntryModulesPlugin";

/**
 * Creates a virtual module of the asset manifest for consumption.
 * See {@link serverEntryModulesPlugin} for consumption.
 */
export function serverAssetsPlugin(
  browserManifestPromiseRef: BrowserManifestPromiseRef,
  filter: RegExp = /^@remix-run\/assets-manifest$/
): Plugin {
  return {
    name: "server-assets",
    setup(build) {
      build.onResolve({ filter }, ({ path }) => {
        return {
          path,
          namespace: "assets"
        };
      });
      build.onLoad({ filter }, async () => {
        invariant(
          browserManifestPromiseRef.current,
          "Missing browser manifest assets ref in server build."
        );
        let manifest = await browserManifestPromiseRef.current;

        return {
          contents: `export default ${jsesc(manifest, { es6: true })};`,
          loader: "js"
        };
      });
    }
  };
}
