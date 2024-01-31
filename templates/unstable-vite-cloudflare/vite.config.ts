import {
  unstable_vitePlugin as remix,
  unstable_vitePluginPresetCloudflare as cloudflare,
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  ssr: {
    resolve: {
      externalConditions: ["workerd", "worker"],
    },
  },
  plugins: [
    remix({
      presets: [cloudflare()],
    }),
    tsconfigPaths(),
  ],
});
