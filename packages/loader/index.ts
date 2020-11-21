import type { ResponseInit, DataAction, DataLoader } from "@remix-run/core";
import { Headers, Request, Response } from "@remix-run/core";

// These are already global, but just re-export them here for convenience.
export { Headers, Request, Response };

export type { DataAction as Action, DataLoader as Loader };

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

let bodyMethods = new Set(["post", "put", "patch", "delete"]);

/**
 * Parse the body of a `<Form>` request into an object. For
 * `application/x-www-form-urlencoded` forms, this will be a URLSearchParams
 * object. For `multipart/form-data` forms, it will be a FormData.
 */
export async function parseFormBody(
  request: Request
): Promise<URLSearchParams | FormData> {
  if (!bodyMethods.has(request.method.toLowerCase())) {
    throw new Error(
      `parseFormBody only supports POST, PUT, and PATCH, and DELETE request (not ${request.method})`
    );
  }

  let contentType = request.headers.get("Content-Type");

  if (contentType === "application/x-www-form-urlencoded") {
    return new URLSearchParams(await request.text());
  }

  if (contentType === "multipart/form-data") {
    // Should be able to just do this:
    // return await req.formData();
    throw new Error("parseFormBody does not yet support multipart/form-data");
  }

  throw new Error(`Unknown form encoding: ${contentType}`);
}
