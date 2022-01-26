import { serve } from "https://deno.land/std/http/server.ts";

import { createRequestHandlerWithStaticFiles } from "@remix-run/deno";
import * as build from "@remix-run/dev/server-build";

const handleRequest = createRequestHandlerWithStaticFiles({
  build,
  mode: process.env.NODE_ENV
});

console.log("Listening on http://localhost:8000");
serve(handleRequest);
