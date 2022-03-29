// Import path interpreted by the Remix compiler
import * as build from "@remix-run/dev/server-build";
import { createRequestHandler } from "@remix-run/netlify-edge";
import type { Context } from "netlify:edge";
export default createRequestHandler({
  build,
  // process.env.NODE_ENV is provided by Remix at compile time
  mode: process.env.NODE_ENV,
  getLoadContext: (_request: Request, context?: Context) => context,
});
