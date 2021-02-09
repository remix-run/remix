import type { Location } from "history";
import type { AppData, RouteData } from "@remix-run/core";

export type { AppData, RouteData };

export type FormMethod = "get" | "post" | "put" | "patch" | "delete";

export type FormEncType =
  | "application/x-www-form-urlencoded"
  | "multipart/form-data";

export interface FormSubmit {
  method: string;
  encType: string;
  data: FormData;
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
  location: Location,
  routeId: string,
  formSubmit?: FormSubmit
): Promise<Response | Error> {
  let origin = window.location.origin;
  let url = new URL(location.pathname + location.search, origin);
  url.searchParams.set("_data", routeId);
  url.searchParams.sort(); // Improves caching

  let init = getFetchInit(formSubmit);
  let response = await fetch(url.href, init);

  if (isErrorResponse(response)) {
    // We discussed putting an error in the console here but decided to pass on
    // it for now since they will already see 1) a 500 in the Network tab and
    // 2) an error in the console when the ErrorBoundary shows up.
    let data = await response.json();
    let error = new Error(data.message);
    error.stack = data.stack;
    return error;
  }

  // We discussed possibly reloading here to get the right status code from the
  // server for the HTML page when the data loader returns a 404, but ultimately
  // concluded it's probably better to just not have any JavaScript on the page
  // when search bots come around to index things.

  return response;
}

export async function extractData(
  response: Response | Error
): Promise<AppData> {
  if (response instanceof Error) return null;

  // This same algorithm is used on the server to interpret load
  // results when we render the HTML page.
  let contentType = response.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return response.json();
  }

  return response.text();
}

function getFetchInit(formSubmit?: FormSubmit): RequestInit {
  if (!formSubmit) {
    return { credentials: "same-origin" };
  }

  let body =
    formSubmit.encType === "application/x-www-form-urlencoded"
      ? // TODO: Patch the URLSearchParams constructor type to accept FormData
        // @ts-ignore
        new URLSearchParams(formSubmit.data)
      : formSubmit.data;

  return {
    method: formSubmit.method,
    body,
    credentials: "same-origin",
    headers: {
      "Content-Type": formSubmit.encType
    }
  };
}
