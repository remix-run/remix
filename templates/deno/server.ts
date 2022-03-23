import { serve } from "https://deno.land/std@0.128.0/http/server.ts";
// Temporary: in the future, import from `@remix-run/deno` at some URL
import { createRequestHandlerWithStaticFiles, installGlobals } from "./remix-deno/index.ts";
// Import path interpreted by the Remix compiler
import * as build from "@remix-run/dev/server-build";

// Temporary: required by Remix; do not remove.
installGlobals();

const remixHandler = createRequestHandlerWithStaticFiles({
  build,
  // process.env.NODE_ENV is provided by Remix at compile time
  mode: process.env.NODE_ENV,
  getLoadContext: () => ({})
});

const port = Number(Deno.env.get("PORT")) || 8000;
console.log(`Listening on http://localhost:${port}`);
serve(remixHandler, { port });