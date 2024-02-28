import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [remix({ ssr: false }), tsconfigPaths()],
  ssr: {
    // Bundle all dependencies during the server build by default to avoid
    // most ESM/CJS issues.  This may slow down your build a bit -- if so, you
    // can try removing this config, or switching to a more targeted array
    // config of the targeted dependencies you wish to bundle.
    // See https://vitejs.dev/config/ssr-options#ssr-noexternal for more information
    noExternal: true,
  },
});
