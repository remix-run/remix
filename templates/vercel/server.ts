import * as build from "@remix-run/dev/server-build";
import { installGlobals } from "@remix-run/node";
import { createRequestHandler } from "@remix-run/vercel";

installGlobals();

export default createRequestHandler({ build, mode: process.env.NODE_ENV });
