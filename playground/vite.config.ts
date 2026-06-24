import { resolve } from "node:path";

import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";

export default defineConfig({
  server: {
    fs: {
      allow: ["../node_modules", "."],
    },
  },
  plugins: [cloudflare({ persistState: true })],
  environments: {
    client: {
      resolve: {
        mainFields: ["browser", "module", "main"],
      },
      optimizeDeps: {
        exclude: [
          "@sqlite.org/sqlite-wasm",
        ],
        include: [
          "@jacob-ebey/almostnode",
          "@reduxjs/toolkit",
          "acorn-walk",
          "acorn",
          "enhanced-resolve",
          "magic-string",
          "typescript",
        ],
      },
    },
  },
  resolve: {
    alias: {
      "fs": resolve("./polyfills/fs.js"),
      "path": resolve("./polyfills/path.js"),
      "node:zlib": resolve("./polyfills/empty.js"),
    },
  },
});
