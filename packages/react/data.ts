import type { Location } from "history";
import type { Params } from "react-router";
import type { AppData, RouteData, EntryRouteObject } from "@remix-run/core";

export type { AppData, RouteData };

export type FormEncType =
  | "application/x-www-form-urlencoded"
  | "multipart/form-data";

export type FormMethod = "get" | "post" | "put" | "patch" | "delete";

export interface FormSubmit {
  method: FormMethod;
  data: FormData;
  encType: FormEncType;
}

export interface DataRedirectHandler {
  (url: URL): void;
}

/**
 * Loads the global data from the server.
 */
export async function loadGlobalData(
  loaderUrl: string | undefined,
  location: Location
): Promise<Response | Error | undefined> {
  if (!loaderUrl) return undefined;
  return fetchData(loaderUrl, location, "_global", {});
}

/**
 * Loads some data for a route from the server.
 */
export async function loadRouteData(
  route: EntryRouteObject,
  location: Location,
  params: Params
): Promise<Response | Error | undefined> {
  if (!route.loaderUrl) return undefined;
  return fetchData(route.loaderUrl, location, route.id, params);
}

/**
 * Calls the action for a route with the data from the form that was submitted.
 */
export function callRouteAction(
  route: EntryRouteObject,
  location: Location,
  params: Params,
  formSubmit: FormSubmit
): Promise<Response | Error> {
  return fetchData(route.actionUrl, location, route.id, params, formSubmit);
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

async function fetchData(
  loaderUrl: string | undefined,
  location: Location,
  routeId: string,
  routeParams: Params,
  formSubmit?: FormSubmit
): Promise<Response | Error> {
  let origin = window.location.origin;
  let url = new URL(location.pathname + location.search, origin);
  let params = new URLSearchParams({
    params: JSON.stringify(routeParams),
    url: url.toString(),
    id: routeId
  });

  let init = formSubmit ? getFormSubmitInit(formSubmit) : undefined;
  let response = await fetch(`${loaderUrl}?${params.toString()}`, init);

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
  if (response instanceof Error) return response;

  // This same algorithm is used on the server to interpret load
  // results when we render the HTML page.
  let contentType = response.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return response.json();
  }

  return response.text();
}

function getFormSubmitInit(formSubmit: FormSubmit): RequestInit {
  let body =
    formSubmit.encType === "application/x-www-form-urlencoded"
      ? // TODO: Patch the URLSearchParams constructor type to accept FormData
        // @ts-ignore
        new URLSearchParams(formSubmit.data)
      : formSubmit.data;

  return {
    method: formSubmit.method,
    body,
    headers: {
      "Content-Type": formSubmit.encType
    }
  };
}
