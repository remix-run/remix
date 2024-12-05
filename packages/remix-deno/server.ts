import * as path from "https://deno.land/std@0.128.0/path/mod.ts";
import mime from "mime";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";
import type { AppLoadContext, ServerBuild } from "@remix-run/server-runtime";

function defaultCacheControl(url: URL, assetsPublicPath = "/build/") {
  if (url.pathname.startsWith(assetsPublicPath)) {
    return "public, max-age=31536000, immutable";
  } else {
    return "public, max-age=600";
  }
}

type UnixAddr = {
  transport: "unix" | "unixpacket";
  path: string;
};

type NetAddr = {
  transport: "tcp" | "udp";
  hostname: string;
  port: number;
};

type ServeUnixHandlerInfo = {
  remoteAddr: UnixAddr;
};

type ServeHandlerInfo = {
  remoteAddr: NetAddr;
  completed: Promise<void>;
};

export function createRequestHandler<
  Context extends AppLoadContext | undefined = undefined,
>({
  build,
  mode,
  getLoadContext,
}: {
  build: ServerBuild;
  mode?: string;
  getLoadContext?: (
    request: Request,
    info: ServeHandlerInfo | ServeUnixHandlerInfo
  ) => Promise<Context> | Context;
}) {
  const handleRequest = createRemixRequestHandler(build, mode);

  return async (
    request: Request,
    info: ServeHandlerInfo | ServeUnixHandlerInfo
  ) => {
    try {
      const loadContext = await getLoadContext?.(request, info);

      return handleRequest(request, loadContext);
    } catch (error: unknown) {
      console.error(error);

      return new Response("Internal Error", { status: 500 });
    }
  };
}

class FileNotFoundError extends Error {
  constructor(filePath: string) {
    super(`No such file or directory: ${filePath}`);
  }
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
  },
) {
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
}

export function createRequestHandlerWithStaticFiles<
  Context extends AppLoadContext | undefined = undefined,
>({
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
  getLoadContext?: (
    request: Request,
    info: ServeHandlerInfo | ServeUnixHandlerInfo
  ) => Promise<Context> | Context;
  staticFiles?: {
    cacheControl?: string | ((url: URL) => string);
    publicDir?: string;
    assetsPublicPath?: string;
  };
}) {
  const remixHandler = createRequestHandler({ build, mode, getLoadContext });

  return async (
    request: Request,
    info: ServeHandlerInfo | ServeUnixHandlerInfo
  ) => {
    try {
      return await serveStaticFiles(request, staticFiles);
    } catch (error: unknown) {
      if (!(error instanceof FileNotFoundError)) {
        throw error;
      }
    }

    return remixHandler(request, info);
  };
}
