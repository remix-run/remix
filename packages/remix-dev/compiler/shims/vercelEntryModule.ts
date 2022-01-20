import { createRequestHandler } from "@remix-run/vercel";
import * as build from "@remix-run/server-build";

export default createRequestHandler({ build, mode: process.env.NODE_ENV });
