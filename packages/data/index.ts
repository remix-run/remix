import type {
  Cookie,
  CookieOptions,
  ResponseInit,
  HeadersFunction,
  MetaFunction,
  ActionFunction,
  LoaderFunction,
  SessionData,
  Session,
  SessionStorage,
  SessionIdStorageStrategy
} from "@remix-run/core";
import {
  Headers,
  Request,
  Response,
  createCookie,
  isCookie,
  createSession,
  isSession,
  createSessionStorage,
  createCookieSessionStorage,
  createFileSessionStorage,
  createMemorySessionStorage
} from "@remix-run/core";

export type {
  Cookie,
  CookieOptions,
  HeadersFunction,
  MetaFunction,
  ActionFunction as Action,
  LoaderFunction as Loader,
  SessionData,
  Session,
  SessionStorage,
  SessionIdStorageStrategy
};

// These are already global, but just re-export them here for convenience.
export { Headers, Request, Response };

export {
  createCookie,
  isCookie,
  createSession,
  isSession,
  createSessionStorage,
  createCookieSessionStorage,
  createFileSessionStorage,
  createMemorySessionStorage
};

/**
 * A JSON response. This helper takes care of converting the `data` to JSON
 * (using `JSON.stringify(data)`) and setting the `Content-Type` header.
 */
export function json(data: any, init: number | ResponseInit = {}): Response {
  if (typeof init === "number") {
    init = { status: init };
  }

  let headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(data), { ...init, headers });
}

/**
 * A redirect response. Defaults to "302 Found".
 */
export function redirect(
  url: string,
  init: number | ResponseInit = 302
): Response {
  if (typeof init === "number") {
    init = { status: init };
  }

  let headers = new Headers(init.headers);
  headers.set("Location", url);

  return new Response("", { ...init, headers });
}
