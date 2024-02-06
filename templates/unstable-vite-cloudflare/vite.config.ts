import {
  unstable_vitePlugin as remix,
  unstable_cloudflarePreset as cloudflare,
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { getBindingsProxy } from "wrangler";

import { getLoadContext } from "./load-context";

export default defineConfig({
  plugins: [
    remix({
      presets: [
        cloudflare(getBindingsProxy, {
          getRemixDevLoadContext: getLoadContext,
        }),
      ],
    }),
    tsconfigPaths(),
  ],
  ssr: {
    resolve: {
      externalConditions: ["workerd", "worker"],
    },
  },
});
