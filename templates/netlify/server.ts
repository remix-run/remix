import { createRequestHandler } from "@netlify/remix-adapter";
import * as build from "@remix-run/dev/server-build";
import { installGlobals } from "@remix-run/node";
import sourceMapSupport from "source-map-support";

sourceMapSupport.install();
installGlobals();

export const handler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
});
