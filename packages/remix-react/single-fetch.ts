import type { DataStrategyMatch, ErrorResponse } from "@remix-run/router";
import {
  redirect,
  UNSAFE_ErrorResponseImpl as ErrorResponseImpl,
} from "@remix-run/router";
import type { DataStrategyFunctionArgs } from "react-router-dom";
import { decode } from "turbo-stream";

import { createRequestInit } from "./data";
import invariant from "./invariant";

type SingleFetchResult =
  | { data: unknown }
  | { error: unknown }
  | { redirect: string; status: number; revalidate: boolean; reload: boolean };
type SingleFetchResults = {
  [key: string]: SingleFetchResult;
};

export async function singleFetchDataStrategy({
  request,
  matches,
}: DataStrategyFunctionArgs) {
  return request.method === "GET"
    ? singleFetchLoaders(request, matches)
    : singleFetchAction(request, matches);

  // TODO: Don't revalidate on action 4xx/5xx responses with status codes
  //       (return or throw)
}

function singleFetchAction(request: Request, matches: DataStrategyMatch[]) {
  let singleFetch = async (routeId: string) => {
    let url = singleFetchUrl(request.url);
    let init = await createRequestInit(request);
    let result = await fetchAndDecode(url, init);
    return unwrapSingleFetchResult(result as SingleFetchResult, routeId);
  };

  return Promise.all(
    matches.map((m) =>
      m.bikeshed_loadRoute((handler) => handler(() => singleFetch(m.route.id)))
    )
  );
}

function singleFetchLoaders(request: Request, matches: DataStrategyMatch[]) {
  // Create a singular promise for all routes to latch onto for single fetch.
  // This way we can kick off `clientLoaders` and ensure:
  // 1. we only call the server if at least one of them calls `serverLoader`
  // 2. if multiple call` serverLoader` only one fetch call is made
  let singleFetchPromise: Promise<SingleFetchResults>;

  let makeSingleFetchCall = async () => {
    // Determine which routes we want to load so we can send an X-Remix-Routes header
    // for fine-grained revalidation if necessary.  If a route has not yet been loaded
    // via `route.lazy` then we know we want to load it because it's by definition a
    // net-new route.  If it has been loaded then bikeshed_load will have taken
    // shouldRevalidate into consideration.
    //
    // There is a small edge case that _may_ result in a server loader running
    // _somewhat_ unintended, but I'm pretty sure it's unavoidable:
    // - Assume we have 2 routes, parent and child
    // - Both have clientLoaders and both need to be revalidated
    // - If neither calls `serverLoader`, we won't make the single fetch call
    // - We delay the single fetch call until the **first** one calls `serverLoader`
    // - However, we cannot wait around to know if the other one calls
    //   `serverLoader`, so we include both of them in the `X-Remix-Routes`
    //   header
    // - This means it's technically possible that the second route never calls
    //   `serverLoader` and we never read the response of that route from the
    //   single fetch call, and thus executing that loader on the server was
    //   unnecessary.
    let matchedIds = genRouteIds(matches.map((m) => m.route.id));
    let loadIds = genRouteIds(
      matches.filter((m) => m.bikeshed_load).map((m) => m.route.id)
    );

    // Single fetch doesn't need/want naked index queries on action
    // revalidation requests
    let url = singleFetchUrl(stripIndexParam(request.url));

    // TODO: Should we only do this on revalidations?  We don't know here whether
    // this is a new route load or a revalidation but we could communicate that
    // through to dataStrategy
    let init: RequestInit = {
      ...(matchedIds !== loadIds
        ? { headers: { "X-Remix-Routes": loadIds } }
        : null),
    };
    let result = await fetchAndDecode(url, init);
    return result as SingleFetchResults;
  };

  let singleFetch = async (routeId: string) => {
    if (!singleFetchPromise) {
      singleFetchPromise = makeSingleFetchCall();
    }
    let results = await singleFetchPromise;
    if (results[routeId] !== undefined) {
      return unwrapSingleFetchResult(results[routeId], routeId);
    }
    return null;
  };

  // Call the route loaders passing through the singleFetch function that will
  // be called instead of making a server call
  return Promise.all(
    matches.map(async (m) => {
      return m.bikeshed_loadRoute((handler) =>
        handler(() => singleFetch(m.route.id))
      );
    })
  );
}

function stripIndexParam(reqUrl: string) {
  let url = new URL(reqUrl);
  let indexValues = url.searchParams.getAll("index");
  url.searchParams.delete("index");
  let indexValuesToKeep = [];
  for (let indexValue of indexValues) {
    if (indexValue) {
      indexValuesToKeep.push(indexValue);
    }
  }
  for (let toKeep of indexValuesToKeep) {
    url.searchParams.append("index", toKeep);
  }

  return url.href;
}

function singleFetchUrl(reqUrl: string) {
  let url = new URL(reqUrl);
  url.pathname = `${url.pathname === "/" ? "_root" : url.pathname}.data`;
  return url;
}

async function fetchAndDecode(url: URL, init: RequestInit) {
  let res = await fetch(url, init);
  invariant(
    res.headers.get("Content-Type")?.includes("text/x-turbo"),
    "Expected a text/x-turbo response"
  );
  let decoded = await decode(res.body!, [
    (type, value) => {
      if (type === "ErrorResponse") {
        let errorResponse = value as ErrorResponse;
        return {
          value: new ErrorResponseImpl(
            errorResponse.status,
            errorResponse.statusText,
            errorResponse.data,
            (errorResponse as any).internal === true
          ),
        };
      }
    },
  ]);
  return decoded.value;
}

function unwrapSingleFetchResult(result: SingleFetchResult, routeId: string) {
  if ("error" in result) {
    throw result.error;
  } else if ("redirect" in result) {
    let headers: Record<string, string> = {};
    if (result.revalidate) {
      headers["X-Remix-Revalidate"] = "yes";
    }
    if (result.reload) {
      headers["X-Remix-Reload-Document"] = "yes";
    }
    return redirect(result.redirect, { status: result.status, headers });
  } else if ("data" in result) {
    return result.data;
  } else {
    throw new Error(`No action response found for routeId "${routeId}"`);
  }
}

function genRouteIds(arr: string[]) {
  return arr
    .filter((id) => window.__remixManifest.routes[id].hasLoader)
    .join(",");
}
