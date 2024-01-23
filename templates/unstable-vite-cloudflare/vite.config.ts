import {
  unstable_vitePlugin as remix,
  unstable_vitePluginAdapterCloudflare as cloudflare,
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    remix({
      adapter: cloudflare(),
    }),
    tsconfigPaths(),
  ],
});
