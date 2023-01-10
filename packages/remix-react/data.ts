import type { FormMethod as FormMethodRR } from "react-router-dom";

export type AppData = any;

export type FormMethod = FormMethodRR;

export type FormEncType =
  | "application/x-www-form-urlencoded"
  | "multipart/form-data";

export function isCatchResponse(response: any): boolean {
  return (
    response instanceof Response &&
    response.headers.get("X-Remix-Catch") != null
  );
}

export function isErrorResponse(response: any): boolean {
  return (
    response instanceof Response &&
    response.headers.get("X-Remix-Error") != null
  );
}

export function isRedirectResponse(response: any): boolean {
  return (
    response instanceof Response &&
    response.headers.get("X-Remix-Redirect") != null
  );
}

export async function fetchData(
  request: Request,
  routeId: string
): Promise<Response | Error> {
  let url = new URL(request.url);
  url.searchParams.set("_data", routeId);

  let init: RequestInit = { signal: request.signal };

  if (request.method !== "GET") {
    init.method = request.method;

    let contentType = request.headers.get("Content-Type");
    init.body =
      // Check between word boundaries instead of startsWith() due to the last
      // paragraph of https://httpwg.org/specs/rfc9110.html#field.content-type
      contentType && /\bapplication\/x-www-form-urlencoded\b/.test(contentType)
        ? new URLSearchParams(await request.text())
        : await request.formData();
  }

  let response = await fetch(url.href, init);

  if (isErrorResponse(response)) {
    let data = await response.json();
    let error = new Error(data.message);
    error.stack = data.stack;
    return error;
  }

  return response;
}
