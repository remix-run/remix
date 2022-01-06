import { createRequestHandler } from "@remix-run/server-runtime";
import type { ServerBuild } from "@remix-run/server-runtime";

import mime from "mime";

export function defaultCacheControl(url: URL) {
  if (url.pathname.startsWith("/build/")) {
    return "public, max-age=31536000, immutable";
  } else {
    return "public, max-age=600";
  }
}

export function createRequestHandlerWithStaticFiles({
  build,
  mode,
  staticFiles: { cacheControl, publicDir } = {
    cacheControl: defaultCacheControl,
    publicDir: "./public"
  }
}: {
  build: ServerBuild;
  mode?: string;
  staticFiles?: {
    cacheControl?: string | ((url: URL) => string);
    publicDir?: string;
  };
}) {
  let remixHandler = createRequestHandler(build, {}, mode);

  return async (request: Request) => {
    try {
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
        headers.set("Cache-Control", defaultCacheControl(url));
      }

      // @ts-expect-error
      const file = await Deno.readFile(
        `${publicDir || "./public"}${url.pathname}`
      );

      return new Response(file, { headers });
    } catch (e: any) {
      if (e.code !== "EISDIR" && e.code !== "ENOENT") {
        throw e;
      }
    }

    try {
      return await remixHandler(request);
    } catch (e: any) {
      console.error(e);

      return new Response("Internal Error", { status: 500 });
    }
  };
}
