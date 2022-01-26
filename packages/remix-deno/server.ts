import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";
import type { ServerBuild } from "@remix-run/server-runtime";
// @ts-expect-error
import * as path from "https://deno.land/std/path/mod.ts";

import mime from "mime";

function defaultCacheControl(url: URL, assetsPublicPath: string = "/build/") {
  if (url.pathname.startsWith(assetsPublicPath)) {
    return "public, max-age=31536000, immutable";
  } else {
    return "public, max-age=600";
  }
}

export function createRequestHandler<Context = unknown>({
  build,
  mode,
  getLoadContext
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
    } catch (e: any) {
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
    assetsPublicPath = "/build/"
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

  // @ts-expect-error
  let file = await Deno.readFile(path.join(publicDir, url.pathname));

  return new Response(file, { headers });
}

export function createRequestHandlerWithStaticFiles<Context = unknown>({
  build,
  mode,
  getLoadContext,
  staticFiles = {
    publicDir: "./public",
    assetsPublicPath: "/build/"
  }
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
    } catch (e: any) {
      if (e.code !== "EISDIR" && e.code !== "ENOENT") {
        throw e;
      }
    }

    return remixHandler(request);
  };
}
