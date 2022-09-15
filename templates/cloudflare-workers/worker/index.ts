import {
  getAssetFromKV,
  NotFoundError,
  MethodNotAllowedError,
  type CacheControl,
} from "@cloudflare/kv-asset-handler";
import { createRequestHandler } from "@remix-run/cloudflare";
// Virtual module provided by wrangler
import manifestJSON from "__STATIC_CONTENT_MANIFEST";
// The build remix app provided by remix build
import * as remixBuild from "remix-build";

const assetManifest = JSON.parse(manifestJSON);

const requestHandler = createRequestHandler(remixBuild, process.env.NODE_ENV);

function cacheControl(request: Request): Partial<CacheControl> {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/build")) {
    // Cache build files for 1 year since they have a hash in their URL
    return {
      browserTTL: 60 * 60 * 24 * 365,
      edgeTTL: 60 * 60 * 24 * 365,
    };
  }

  // Cache everything else for 10 minutes
  return {
    browserTTL: 60 * 10,
    edgeTTL: 60 * 10,
  };
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    try {
      return await getAssetFromKV(
        {
          request,
          waitUntil(promise) {
            return ctx.waitUntil(promise);
          },
        },
        {
          cacheControl,
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      );
    } catch (e) {
      if (e instanceof NotFoundError || e instanceof MethodNotAllowedError) {
        // fall through to the remix handler
      } else {
        return new Response("An unexpected error occurred", { status: 500 });
      }
    }

    try {
      return await requestHandler(request, { env, ctx });
    } catch (error) {
      console.error(error);
      return new Response("An unexpected error occurred", { status: 500 });
    }
  },
};
