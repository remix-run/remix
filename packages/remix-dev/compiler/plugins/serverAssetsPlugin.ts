import type { Plugin } from "esbuild";
import jsesc from "jsesc";
import invariant from "../../invariant";

export type ClientManifestPromiseRef = { current?: Promise<unknown> };

/**
 * Creates a virtual module of the asset manifest for consumption.
 */
export function serverAssetsPlugin(
  clientManifestPromiseRef: ClientManifestPromiseRef,
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
          clientManifestPromiseRef.current,
          "Missing client manifest assets ref in server build."
        );
        let manifest = await clientManifestPromiseRef.current;

        return {
          contents: `export default ${jsesc(manifest, { es6: true })};`,
          loader: "js"
        };
      });
    }
  };
}
