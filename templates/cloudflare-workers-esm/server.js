import { createEventHandler } from "@remix-run/cloudflare-workers-esm";
import * as build from "@remix-run/dev/server-build";

export default {
  fetch: createEventHandler({ build, mode: process.env.NODE_ENV }),
};
