import type { ResponseInit } from "@remix-run/core";
import { Headers, Request, Response } from "@remix-run/core";

// These are already global, but just re-export them here for convenience.
export { Headers, Request, Response };

/**
 * A JSON response. This helper takes care of converting the `data` to JSON
 * (using `JSON.stringify(data)`) and setting the `Content-Type` header.
 */
export function json(data: any, init: ResponseInit = {}) {
  let headers = new Headers(init.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(data), { ...init, headers });
}

/**
 * A "Not Found" response (404).
 */
export function notFound() {
  return new Response("", { status: 404 });
}

/**
 * A redirect response. Defaults to a temporary redirect (302).
 */
export function redirect(url: string, status = 302) {
  return new Response("", {
    status,
    headers: {
      Location: url
    }
  });
}
