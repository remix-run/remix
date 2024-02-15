import {
  vitePlugin as remix,
  devCloudflareProxyVitePlugin as remixDevCloudflareProxy,
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [remixDevCloudflareProxy(), remix(), tsconfigPaths()],
});
