import type { Plugin } from "esbuild";

/**
 * Provide some data to the build via a virtual module.
 */
export default function virtualJsonPlugin(moduleId: string, data: any): Plugin {
  let filter = new RegExp(`^${moduleId}$`);

  return {
    name: "virtual-json",
    setup(build) {
      build.onResolve({ filter }, args => {
        return { path: args.path, namespace: "virtual-json" };
      });

      build.onLoad({ filter, namespace: "virtual-json" }, args => {
        return { contents: JSON.stringify(data), loader: "json" };
      });
    }
  };
}
