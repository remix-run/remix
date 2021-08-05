import type { Location } from "history";
import { GenericSubmission } from "./transition";

export type AppData = any;

export type FormMethod = "get" | "post" | "put" | "patch" | "delete";

export type FormEncType =
  | "application/x-www-form-urlencoded"
  | "multipart/form-data";

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
  location: Location<any>,
  routeId: string,
  type: "get" | "post",
  signal: AbortSignal
): Promise<Response | Error> {
  let origin = window.location.origin;
  let url = new URL(location.pathname + location.search, origin);
  url.searchParams.set("_data", routeId);
  url.searchParams.sort(); // Improves caching

  let init: RequestInit =
    type === "get"
      ? { credentials: "same-origin", signal }
      : getActionInit(location, signal);

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
  location: Location<GenericSubmission>,
  signal: AbortSignal
): RequestInit {
  let { encType, method, body } = location.state;

  if (encType !== "application/x-www-form-urlencoded") {
    throw new Error(
      `Only "application/x-www-form-urlencoded" forms are supported right now.`
    );
  }

  return {
    method,
    body,
    signal,
    credentials: "same-origin",
    headers: { "Content-Type": encType }
  };
}
