import { serve } from "https://deno.land/std/http/server.ts";

import { createRequestHandlerWithStaticFiles } from "@remix-run/deno";
import * as build from "@remix-run/dev/server-build";

const remixHandler = createRequestHandlerWithStaticFiles({
  build,
  // process.env.NODE_ENV is provided by Remix at compile time
  mode: process.env.NODE_ENV,
  getLoadContext: () => ({})
});

const port = Deno.env.get("PORT") || "8000";
console.log(`Listening on http://localhost:${port}`);
serve(remixHandler, { addr: `:${port}` });
