import invariant from "./invariant";
import type { Submission } from "./transition";

export type AppData = any;

export type FormMethod = "get" | "post" | "put" | "patch" | "delete";

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
  url: URL,
  routeId: string,
  signal: AbortSignal,
  submission?: Submission
): Promise<Response | Error> {
  url.searchParams.set("_data", routeId);
  url.searchParams.sort(); // Improves caching

  let init: RequestInit = submission
    ? getActionInit(submission, signal)
    : { credentials: "same-origin", signal };

  let response = await fetch(url.href, init);

  if (isErrorResponse(response)) {
    let data = await response.json();
    let error = new Error(data.message);
    error.stack = data.stack;
    return error;
  }

  return response;
}

export async function extractData(response: Response): Promise<AppData> {
  // This same algorithm is used on the server to interpret load
  // results when we render the HTML page.
  let contentType = response.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return response.json();
  }

  return response.text();
}

function getActionInit(
  submission: Submission,
  signal: AbortSignal
): RequestInit {
  let { encType, method, formData } = submission;

  let headers = undefined;
  let body = formData;

  if (encType === "application/x-www-form-urlencoded") {
    body = new URLSearchParams();
    for (let [key, value] of formData) {
      invariant(
        typeof value === "string",
        `File inputs are not supported with encType "application/x-www-form-urlencoded", please use "multipart/form-data" instead.`
      );
      body.append(key, value);
    }
    headers = { "Content-Type": encType };
  }

  return {
    method,
    body,
    signal,
    credentials: "same-origin",
    headers
  };
}
