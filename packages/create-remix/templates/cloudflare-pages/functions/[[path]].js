import { createFetchHandler } from "@remix-run/cloudflare-pages";

// @ts-ignore
import * as build from "../build";

const handleFetch = createFetchHandler({
  build
});

export function onRequest(context) {
  const request = new Request(context.request);
  // https://github.com/cloudflare/wrangler2/issues/117
  request.headers.delete("If-None-Match");

  return handleFetch({ ...context, request });
}
