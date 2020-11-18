import type { ResponseInit, Action, Loader } from "@remix-run/core";
import { Headers, Request, Response } from "@remix-run/core";

// These are already global, but just re-export them here for convenience.
export { Headers, Request, Response };

export type { Action, Loader };

/**
 * A JSON response. This helper takes care of converting the `data` to JSON
 * (using `JSON.stringify(data)`) and setting the `Content-Type` header.
 */
export function json(data: any, init: ResponseInit = {}): Response {
  let headers = new Headers(init.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(data), { ...init, headers });
}

/**
 * A "Not Found" response (404).
 */
export function notFound(): Response {
  return new Response("", { status: 404 });
}

/**
 * A redirect response. Defaults to "302 Found".
 */
export function redirect(url: string, status = 302): Response {
  return new Response("", {
    status,
    headers: {
      Location: url
    }
  });
}

let bodyMethods = new Set(["put", "post", "patch", "delete"]);

/**
 * Parse the FormData body of a Request into an object
 */
export async function parseFormBody(req: Request) {
  if (!bodyMethods.has(req.method.toLowerCase())) {
    throw new Error(
      `parseFormBody only supports POST, PUT, and PATCH, DELETE but not ${req.method}`
    );
  }

  let enctype = req.headers.get("content-type");
  if (enctype === "application/x-www-form-urlencoded") {
    let bodyText = await req.text();
    return Object.fromEntries(new URLSearchParams(bodyText));
  } else if (enctype === "multipart/form-data") {
    throw new Error("parseFormBody multipart/form-data is not yet supported");
    // Should be able to do this:
    // let body = await req.formData();
    // return Object.fromEntries(body);
  } else {
    throw new Error(`Unknown form enctype: ${enctype}`);
  }
}
