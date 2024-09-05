// Needed because the @cloudflare/workers-types do not include the `process` global
/// <reference types="@types/node" />

import type { Options as KvAssetHandlerOptions } from "@cloudflare/kv-asset-handler";
import {
  getAssetFromKV,
  MethodNotAllowedError,
  NotFoundError,
} from "@cloudflare/kv-asset-handler";
import type { AppLoadContext, ServerBuild } from "@remix-run/cloudflare";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/cloudflare";

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */
export type GetLoadContextFunction = (
  event: FetchEvent
) => Promise<AppLoadContext> | AppLoadContext;

export type RequestHandler = (event: FetchEvent) => Promise<Response>;

/**
 * Returns a request handler for the Cloudflare runtime that serves the
 * Remix SSR response.
 */
export function createRequestHandler({
  build,
  getLoadContext,
  mode,
}: {
  build: ServerBuild;
  getLoadContext?: GetLoadContextFunction;
  mode?: string;
}): RequestHandler {
  let handleRequest = createRemixRequestHandler(build, mode);

  return async (event: FetchEvent) => {
    let loadContext = await getLoadContext?.(event);

    return handleRequest(event.request, loadContext);
  };
}

export async function handleAsset(
  event: FetchEvent,
  build: ServerBuild,
  options?: Partial<KvAssetHandlerOptions>
) {
  try {
    if (process.env.NODE_ENV === "development") {
      return await getAssetFromKV(event, {
        cacheControl: {
          bypassCache: true,
        },
        ...options,
      });
    }

    let cacheControl = {};
    let url = new URL(event.request.url);
    let assetpath = build.assets.url.split("/").slice(0, -1).join("/");
    let requestpath = url.pathname.split("/").slice(0, -1).join("/");

    if (requestpath.startsWith(assetpath)) {
      // Assets are hashed by Remix so are safe to cache in the browser
      // And they're also hashed in KV storage, so are safe to cache on the edge
      cacheControl = {
        bypassCache: false,
        edgeTTL: 31536000,
        browserTTL: 31536000,
      };
    } else {
      // Assets are not necessarily hashed in the request URL, so we cannot cache in the browser
      // But they are hashed in KV storage, so we can cache on the edge
      cacheControl = {
        bypassCache: false,
        edgeTTL: 31536000,
      };
    }

    return await getAssetFromKV(event, {
      cacheControl,
      ...options,
    });
  } catch (error: unknown) {
    if (
      error instanceof MethodNotAllowedError ||
      error instanceof NotFoundError
    ) {
      return null;
    }

    throw error;
  }
}

export function createEventHandler({
  build,
  getLoadContext,
  mode,
}: {
  build: ServerBuild;
  getLoadContext?: GetLoadContextFunction;
  mode?: string;
}) {
  let handleRequest = createRequestHandler({
    build,
    getLoadContext,
    mode,
  });

  let handleEvent = async (event: FetchEvent) => {
    let response = await handleAsset(event, build);

    if (!response) {
      response = await handleRequest(event);
    }

    return response;
  };

  return (event: FetchEvent) => {
    try {
      event.respondWith(handleEvent(event));
    } catch (e: any) {
      if (process.env.NODE_ENV === "development") {
        event.respondWith(
          new Response(e.message || e.toString(), {
            status: 500,
          })
        );
        return;
      }

      event.respondWith(new Response("Internal Error", { status: 500 }));
    }
  };
}
