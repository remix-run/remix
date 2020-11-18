import type { Location } from "history";
import type { Params } from "react-router";
import type { AppData, RouteData, EntryRouteObject } from "@remix-run/core";

import type { FormSubmit } from "./components";

export type { AppData, RouteData };

export interface DataRedirectHandler {
  (url: URL): void;
}

/**
 * Dynamically loads some data for a route from the server.
 */
export function loadRouteData(
  route: EntryRouteObject,
  location: Location,
  routeParams: Params,
  handleRedirect: DataRedirectHandler,
  formSubmit?: FormSubmit
): Promise<AppData> {
  if (!route.loaderUrl) {
    return Promise.resolve(null);
  }

  return fetchData(
    route.loaderUrl,
    location,
    routeParams,
    route.id,
    handleRedirect,
    formSubmit
  );
}

async function fetchData(
  loaderUrl: string,
  location: Location,
  routeParams: Params,
  routeId: string,
  handleRedirect: DataRedirectHandler,
  formSubmit?: FormSubmit
): Promise<AppData> {
  let origin = window.location.origin;
  let url = new URL(location.pathname + location.search, origin);
  let params = new URLSearchParams({
    params: JSON.stringify(routeParams),
    url: url.toString(),
    id: routeId
  });

  let init = formSubmit ? getFormSubmitInit(formSubmit) : undefined;
  let res = await fetch(`${loaderUrl}?${params.toString()}`, init);

  let redirectUrl = res.headers.get("x-remix-redirect");
  if (redirectUrl) {
    handleRedirect(
      new URL(
        redirectUrl.startsWith("/")
          ? window.location.origin + redirectUrl
          : redirectUrl
      )
    );
  }

  // We discussed possibly reloading here to get the right status code from the
  // server for the HTML page when the data loader returns a 404, but ultimately
  // concluded it's probably better to just not have any JavaScript on the page
  // when search bots come around to index things.

  return extractData(res);
}

function extractData(res: Response): AppData {
  // This same algorithm is used on the server to interpret load
  // results when we render the HTML page.
  let contentType = res.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return res.json();
  }

  return res.text();
}

function getFormSubmitInit(formSubmit: FormSubmit): RequestInit {
  let body =
    formSubmit.encType === "application/x-www-form-urlencoded"
      ? new URLSearchParams(formSubmit.data as URLSearchParams)
      : formSubmit.data;

  return {
    method: formSubmit.method,
    body,
    headers: {
      "content-type": formSubmit.encType
    }
  };
}
