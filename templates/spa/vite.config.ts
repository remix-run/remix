import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    remix({
      ssr: false,
    }),
    tsconfigPaths(),
  ],
  ssr: {
    // Bundle all dependencies during the server build by default to avoid most
    // ESM/CJS issues.  This may slow down your build a bit -- if so, you can
    // try removing this option, or switching to a more targeted array
    // containing the specific dependencies you wish to bundle. See more:
    // https://vitejs.dev/config/ssr-options#ssr-noexternal
    noExternal: true,
  },
  server: {
    fs: {
      // Restrict files that could be served by Vite's dev server.  Accessing
      // files outside this directory list that aren't imported from an allowed
      // file will result in a 403.  Both directories and files can be provided.
      // If you're comfortable with Vite's dev server making any file within the
      // project root available, you can remove this option.  See more:
      // https://vitejs.dev/config/server-options.html#server-fs-allow
      allow: ["app"],
    },
  },
});
