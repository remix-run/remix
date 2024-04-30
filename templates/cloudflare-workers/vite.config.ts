import { defineConfig } from "vite";
import {
  vitePlugin as remix,
  cloudflareDevProxyVitePlugin,
} from "@remix-run/dev";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig((env) => ({
  plugins: [cloudflareDevProxyVitePlugin(), remix(), tsconfigPaths()],
  ...(env.isSsrBuild && {
    resolve: {
      conditions: ["workerd", "worker", "browser"],
      mainFields: ["browser", "module", "main"],
    },
    build: {
      minify: true,
    },
  }),
}));
