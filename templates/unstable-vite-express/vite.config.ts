import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
// This is only an issue in the Remix monorepo, this should lint properly once
// you've created an app from this template and this comment can be removed
// eslint-disable-next-line import/no-unresolved
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [remix(), tsconfigPaths()],
});
