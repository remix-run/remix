import { createRequestHandlerWithStaticFiles } from "@remix-run/deno";
// Import path interpreted by the Remix compiler
import * as build from "@remix-run/dev/server-build";
import { serve } from "https://deno.land/std@0.128.0/http/server.ts";

const remixHandler = createRequestHandlerWithStaticFiles({
  build,
  getLoadContext: () => ({}),
});

const port = Number(Deno.env.get("PORT")) || 8000;
console.log(`Listening on http://localhost:${port}`);
serve(remixHandler, { port });
