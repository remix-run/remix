// Import path interpreted by the Remix compiler
import * as build from "@remix-run/dev/server-build";
import { createRequestHandler } from "@remix-run/netlify-edge";
export default createRequestHandler({
  build,
  // process.env.NODE_ENV is provided by Remix at compile time
  mode: process.env.NODE_ENV,
});
