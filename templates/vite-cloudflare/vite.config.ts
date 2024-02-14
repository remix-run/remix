import {
  vitePlugin as remix,
  cloudflareProxyVitePlugin as remixCloudflareProxy,
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [remixCloudflareProxy(), remix(), tsconfigPaths()],
});
