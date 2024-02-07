import {
  vitePlugin as remix,
  cloudflarePreset as cloudflare,
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { getBindingsProxy } from "wrangler";

export default defineConfig({
  plugins: [
    remix({
      presets: [cloudflare(getBindingsProxy)],
    }),
    tsconfigPaths(),
  ],
  ssr: {
    resolve: {
      externalConditions: ["workerd", "worker"],
    },
  },
});
