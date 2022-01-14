import type { Plugin } from "esbuild";

export function excludeRemixServerModulesPlugin(): Plugin {
  return {
    name: "exclude-remix-server-modules",
    setup(build) {
      build.onResolve({ filter: /^@remix-run\/.*$/ }, ({ path }) => {
        if (
          path.endsWith("/server-runtime") ||
          path.endsWith("node") ||
          path.endsWith("cloudflare-pages") ||
          path.endsWith("cloudflare-workers") ||
          path.endsWith("cloudflare-deno")
        ) {
          return {
            path,
            namespace: "exclude-remix-server-modules"
          };
        }
        return undefined;
      });

      build.onLoad(
        {
          filter: /^@remix-run\/.*$/,
          namespace: "exclude-remix-server-modules"
        },
        () => {
          return {
            contents: "module.exports = {};",
            loader: "js"
          };
        }
      );
    }
  };
}
