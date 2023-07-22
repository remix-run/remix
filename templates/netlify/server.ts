import { createRequestHandler } from "@netlify/remix-adapter";
import * as build from "@remix-run/dev/server-build";
import { installGlobals } from "@remix-run/node";

installGlobals();

export const handler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
});
