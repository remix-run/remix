import {
  getAssetFromKV,
  MethodNotAllowedError,
  NotFoundError
} from "@cloudflare/kv-asset-handler";
import { createRequestHandler } from "@remix-run/cloudflare-workers";

import * as build from "../build";

async function handleAsset(event) {
  try {
    if (process.env.NODE_ENV === "development") {
      return await getAssetFromKV(event, {
        cacheControl: {
          bypassCache: true
        }
      });
    }

    return await getAssetFromKV(event);
  } catch (error) {
    if (
      error instanceof MethodNotAllowedError ||
      error instanceof NotFoundError
    ) {
      return null;
    }

    throw error;
  }
}

function createEventHandler(build) {
  const handleRequest = createRequestHandler({
    build
  });

  const handleEvent = async event => {
    let response = await handleAsset(event);

    if (!response) {
      response = await handleRequest(event);
    }

    return response;
  };

  return event => {
    try {
      event.respondWith(handleEvent(event));
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        event.respondWith(
          new Response(e.message || e.toString(), {
            status: 500
          })
        );
      }

      event.respondWith(new Response("Internal Error", { status: 500 }));
    }
  };
}

addEventListener("fetch", createEventHandler(build));
