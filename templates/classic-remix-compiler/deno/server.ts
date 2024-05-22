import { createRequestHandlerWithStaticFiles } from "@remix-run/deno";
// Import path interpreted by the Remix compiler
import * as build from "@remix-run/dev/server-build";

const remixHandler = createRequestHandlerWithStaticFiles({
  build,
  getLoadContext: () => ({}),
});

const port = Number(Deno.env.get("PORT")) || 8000;
Deno.serve({ port }, remixHandler);
