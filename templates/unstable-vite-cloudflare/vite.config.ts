import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { adapter as cloudflare } from "./.cloudflare/adapter";

export default defineConfig({
  plugins: [
    remix({
      adapter: cloudflare({
        bindings: {
          kvNamespaces: ["MY_KV"],
          // textBindings: {
          //   SECRET_KEY: "my-secret-key--from-dev",
          // },
          // d1Databases: ["MY_DB"],
          // r2Buckets: ["MY_BUCKET"],
        },
      }),
    }),
    tsconfigPaths(),
  ],
});
