import { isInRemixMonorepo } from "./is-in-remix-monorepo";

export const ssrExternals = isInRemixMonorepo()
  ? [
      // This is only needed within the Remix repo because these
      // packages are linked to a directory outside of node_modules
      // so Vite treats them as internal code by default.
      "@remix-run/architect",
      "@remix-run/cloudflare-pages",
      "@remix-run/cloudflare-workers",
      "@remix-run/cloudflare",
      "@remix-run/css-bundle",
      "@remix-run/deno",
      "@remix-run/dev",
      "@remix-run/express",
      "@remix-run/netlify",
      "@remix-run/node",
      "@remix-run/react",
      "@remix-run/serve",
      "@remix-run/server-runtime",
    ]
  : undefined;
