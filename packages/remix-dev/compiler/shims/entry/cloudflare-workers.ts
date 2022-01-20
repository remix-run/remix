import { createEventHandler } from "@remix-run/cloudflare-workers";
import * as build from "@remix-run/server-build";

addEventListener(
  "fetch",
  createEventHandler({ build, mode: process.env.NODE_ENV })
);
