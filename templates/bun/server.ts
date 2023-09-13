import * as fs from "node:fs";

import type { ServerBuild } from "@remix-run/node";
import {
  broadcastDevReady,
  createRequestHandler,
} from "@remix-run/server-runtime";
import * as Bun from "bun";
const BUILD_PATH = "./build/index.js";
const STATIC_PATH = "./public";

let build: ServerBuild = await import(BUILD_PATH);

if (build.dev) {
  broadcastDevReady(build);
}

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);

    try {
      const filePath = STATIC_PATH + url.pathname;
      if (fs.statSync(filePath).isFile()) {
        const file = Bun.file(filePath);
        return new Response(file);
      }
    } catch {}

    build = await import(BUILD_PATH);
    const handler = createRequestHandler(build, process.env.NODE_ENV);

    const loadContext = {};

    return handler(request, loadContext);
  },
  error() {
    return new Response(null, { status: 404 });
  },
};
