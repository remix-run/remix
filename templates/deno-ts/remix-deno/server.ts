import * as path from "https://deno.land/std@0.128.0/path/mod.ts";
import mime from "https://esm.sh/mime";

import { createRequestHandler as createRemixRequestHandler } from "./deps/@remix-run/server-runtime.ts";
import type { ServerBuild } from "./deps/@remix-run/server-runtime.ts";

function defaultCacheControl(url: URL, assetsPublicPath = "/build/") {
  if (url.pathname.startsWith(assetsPublicPath)) {
    return "public, max-age=31536000, immutable";
  } else {
    return "public, max-age=600";
  }
}

export function createRequestHandler<Context = unknown>({
  build,
  mode,
  getLoadContext,
}: {
  build: ServerBuild;
  mode?: string;
  getLoadContext?: (request: Request) => Promise<Context> | Context;
}) {
  let remixHandler = createRemixRequestHandler(build, {}, mode);
  return async (request: Request) => {
    try {
      let loadContext = getLoadContext
        ? await getLoadContext(request)
        : undefined;

      return await remixHandler(request, loadContext);
    } catch (e) {
      console.error(e);

      return new Response("Internal Error", { status: 500 });
    }
  };
}

export async function serveStaticFiles(
  request: Request,
  {
    cacheControl,
    publicDir = "./public",
    assetsPublicPath = "/build/",
  }: {
    cacheControl?: string | ((url: URL) => string);
    publicDir?: string;
    assetsPublicPath?: string;
  }
) {
  let url = new URL(request.url);

  let headers = new Headers();
  let contentType = mime.getType(url.pathname);
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  if (typeof cacheControl === "function") {
    headers.set("Cache-Control", cacheControl(url));
  } else if (cacheControl) {
    headers.set("Cache-Control", cacheControl);
  } else {
    headers.set("Cache-Control", defaultCacheControl(url, assetsPublicPath));
  }

  let file = await Deno.readFile(path.join(publicDir, url.pathname));

  return new Response(file, { headers });
}

export function createRequestHandlerWithStaticFiles<Context = unknown>({
  build,
  mode,
  getLoadContext,
  staticFiles = {
    publicDir: "./public",
    assetsPublicPath: "/build/",
  },
}: {
  build: ServerBuild;
  mode?: string;
  getLoadContext?: (request: Request) => Promise<Context> | Context;
  staticFiles?: {
    cacheControl?: string | ((url: URL) => string);
    publicDir?: string;
    assetsPublicPath?: string;
  };
}) {
  let remixHandler = createRequestHandler({ build, mode, getLoadContext });

  return async (request: Request) => {
    try {
      return await serveStaticFiles(request, staticFiles);
    } catch (error) {
      if (error.code !== "EISDIR" && error.code !== "ENOENT") {
        throw error;
      }
    }

    return remixHandler(request);
  };
}
