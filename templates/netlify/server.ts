import * as build from "@remix-run/dev/server-build";
import { createRequestHandler } from "@remix-run/netlify";
import { installGlobals } from "@remix-run/node";

installGlobals();

export const handler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
});
