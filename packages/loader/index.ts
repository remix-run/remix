import { Headers, Request, Response } from "@remix-run/core";

// TODO: Make these global in loaders so they don't have to import anything.
export { Headers, Request, Response };

/**
 * A JSON response. Defaults to a 200 status with a
 * `Content-Type: application/json; charset=utf-8` header.
 */
export function json(
  data: any,
  {
    status = 200,
    headers: headersInit
  }: {
    status?: number;
    headers?: ConstructorParameters<typeof Headers>[0];
  } = {}
) {
  let content = JSON.stringify(data);
  let headers = new Headers(headersInit);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  if (!headers.has("Content-Length")) {
    headers.set("Content-Length", content.length);
  }

  return new Response(content, { status, headers });
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
