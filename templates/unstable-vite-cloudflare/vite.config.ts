import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Check out .cloudflare/README.md for why there's a `.cloudflare` directory in this template
// In the future, you'll be able to import the `cloudflare` adapter from `@remix-run/cloudflare`
import { adapter as cloudflare } from "./.cloudflare";

export default defineConfig(({ isSsrBuild }) => ({
  ssr: {
    resolve: {
      externalConditions: ["workerd", "worker"],
    },
  },
  plugins: [
    remix({
      adapter: cloudflare(),
    }),
    tsconfigPaths(),
  ],
}));
