import { createFetchHandler } from "@remix-run/cloudflare-pages";

// @ts-ignore
import * as build from "../build";

const handleFetch = createFetchHandler({
  build
});

export function onRequest(context) {
  return handleFetch(context);
}
