import {
  vitePlugin as remix,
  cloudflareProxyPreset as cloudflareProxy,
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { getBindingsProxy } from "wrangler";

export default defineConfig({
  plugins: [
    remix({
      presets: [cloudflareProxy(getBindingsProxy)],
    }),
    tsconfigPaths(),
  ],
  ssr: {
    resolve: {
      externalConditions: ["workerd", "worker"],
    },
  },
});
