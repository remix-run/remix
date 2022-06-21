import * as path from "https://deno.land/std@0.128.0/path/mod.ts";

// TODO: Should come from `@remix-run/deno`
//  If we would do that now, we would create a circular dependency
import type { ServerBuild } from "@remix-run/server-runtime";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";
import mime from "mime";

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */
export type GetLoadContextFunction<Context = unknown> = (
  request: Request
) => Promise<Context> | Context;

export type RequestHandler = (request: Request) => Promise<Response>;

/**
 * Returns a request handler for Deno Deploy's Deno runtime that serves the
 * response using Remix.
 */
export const createRequestHandler = <Context = unknown>({
  build,
  getLoadContext,
  mode,
}: {
  build: ServerBuild;
  getLoadContext?: GetLoadContextFunction<Context>;
  mode?: string;
}): RequestHandler => {
  const handleRequest = createRemixRequestHandler(build, mode);

  return async (request: Request) => {
    const loadContext = await getLoadContext?.(request);

    return handleRequest(request, loadContext);
  };
};

export const createRequestHandlerWithStaticFiles = <Context = unknown>({
  build,
  getLoadContext,
  mode,
  staticFiles = {
    assetsPublicPath: "/build/",
    publicDir: "./public",
  },
}: {
  build: ServerBuild;
  getLoadContext?: GetLoadContextFunction<Context>;
  mode?: string;
  staticFiles?: StaticFiles;
}): RequestHandler => {
  const remixHandler = createRequestHandler({ build, mode, getLoadContext });

  return async (request: Request) => {
    try {
      return await serveStaticFiles(request, staticFiles);
    } catch (error) {
      if (!(error instanceof FileNotFoundError)) {
        throw error;
      }
    }

    return remixHandler(request);
  };
};

const defaultCacheControl = (url: URL, assetsPublicPath = "/build/") => {
  if (url.pathname.startsWith(assetsPublicPath)) {
    return "public, max-age=31536000, immutable";
  } else {
    return "public, max-age=600";
  }
};

class FileNotFoundError extends Error {
  constructor(filePath: string) {
    super(`No such file or directory: ${filePath}`);
  }
}

type StaticFiles = {
  assetsPublicPath?: string;
  cacheControl?: string | ((url: URL) => string);
  publicDir?: string;
};
export const serveStaticFiles = (
  request: Request,
  {
    assetsPublicPath = "/build/",
    cacheControl,
    publicDir = "./public",
  }: StaticFiles
) => {
  const url = new URL(request.url);

  const headers = new Headers();
  const contentType = mime.getType(url.pathname);
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

  const filePath = path.join(publicDir, url.pathname);
  try {
    const file = await Deno.readFile(filePath);
    return new Response(file, { headers });
  } catch (error) {
    if (error.code === "EISDIR" || error.code === "ENOENT") {
      throw new FileNotFoundError(filePath);
    }
    throw error;
  }
};
