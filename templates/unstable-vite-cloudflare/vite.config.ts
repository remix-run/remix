import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { unstable_vitePluginAdapter as cloudflare } from "@remix-run/cloudflare";
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
