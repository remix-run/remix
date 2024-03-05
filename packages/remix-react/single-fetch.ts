import type {
  DataStrategyFunction,
  ErrorResponse,
  unstable_HandlerResult as HandlerResult,
} from "@remix-run/router";
import {
  UNSAFE_ErrorResponseImpl as ErrorResponseImpl,
  redirect,
} from "@remix-run/router";
import type {
  DataRouteObject,
  DataStrategyFunctionArgs,
} from "react-router-dom";
import { decode } from "turbo-stream";

import { createRequestInit } from "./data";
import type { AssetsManifest } from "./entry";
import type { RouteModules } from "./routeModules";
import invariant from "./invariant";

// IMPORTANT! Keep in sync with the types in @remix-run/server-runtime
type SingleFetchResult =
  | { data: unknown }
  | { error: unknown }
  | { redirect: string; status: number; revalidate: boolean; reload: boolean };
type SingleFetchResults = {
  [key: string]: SingleFetchResult;
};

export function getSingleFetchDataStrategy(
  manifest: AssetsManifest,
  routeModules: RouteModules
): DataStrategyFunction {
  return async ({ request, matches }: DataStrategyFunctionArgs) => {
    // This function is the way for a loader/action to "talk" to the server
    let singleFetch: (routeId: string) => Promise<unknown>;
    let actionStatus: number | undefined;
    if (request.method !== "GET") {
      // Actions are simple since they're singular - just hit the server
      singleFetch = async (routeId) => {
        let url = singleFetchUrl(request.url);
        let init = await createRequestInit(request);
        let { data, status } = await fetchAndDecode(url, init);
        actionStatus = status;
        return unwrapSingleFetchResult(data as SingleFetchResult, routeId);
      };
    } else {
      // Loaders are trickier since we only want to hit the server once, so we
      // create a singular promise for all routes to latch onto. This way we can
      // kick off any existing `clientLoaders` and ensure:
      // 1. we only call the server if at least one of them calls `serverLoader`
      // 2. if multiple call `serverLoader` only one fetch call is made
      let singleFetchPromise: Promise<SingleFetchResults>;

      let makeSingleFetchCall = async () => {
        let url = addRevalidationParam(
          manifest,
          routeModules,
          matches.map((m) => m.route),
          matches.filter((m) => m.shouldLoad).map((m) => m.route),
          // Single fetch doesn't need/want naked index queries on action
          // revalidation requests
          stripIndexParam(singleFetchUrl(request.url))
        );

        let { data } = await fetchAndDecode(url);
        return data as SingleFetchResults;
      };

      singleFetch = async (routeId) => {
        if (!singleFetchPromise) {
          singleFetchPromise = makeSingleFetchCall();
        }
        let results = await singleFetchPromise;
        return results[routeId] !== undefined
          ? unwrapSingleFetchResult(results[routeId], routeId)
          : null;
      };
    }

    // Call the route handlers passing through the `singleFetch` function that will
    // be called instead of making a server call
    return Promise.all(
      matches.map(async (m) =>
        m.resolve(async (handler): Promise<HandlerResult> => {
          try {
            return {
              type: "data",
              result: await handler(() => singleFetch(m.route.id)),
              status: actionStatus,
            };
          } catch (e) {
            return {
              type: "error",
              result: e,
            };
          }
        })
      )
    );
  };
}

function stripIndexParam(url: URL) {
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

  return url;
}

// Determine which routes we want to load so we can add a `?_routes` search param
// for fine-grained revalidation if necessary.  If a route has not yet been loaded
// via `route.lazy` then we know we want to load it because it's by definition a
// net-new route.  If it has been loaded then `shouldLoad` will have taken
// `shouldRevalidate` into consideration.
//
// There is a small edge case that _may_ result in a server loader running
// _somewhat_ unintended, but it's unavoidable:
// - Assume we have 2 routes, parent and child
// - Both have `clientLoader`'s and both need to be revalidated
// - If neither calls `serverLoader`, we won't make the single fetch call
// - We delay the single fetch call until the **first** one calls `serverLoader`
// - However, we cannot wait around to know if the other one calls
//   `serverLoader`, so we include both of them in the `X-Remix-Routes`
//   header
// - This means it's technically possible that the second route never calls
//   `serverLoader` and we never read the response of that route from the
//   single fetch call, and thus executing that `loader` on the server was
//   unnecessary.
export function addRevalidationParam(
  manifest: AssetsManifest,
  routeModules: RouteModules,
  matchedRoutes: DataRouteObject[],
  loadRoutes: DataRouteObject[],
  url: URL
) {
  let genRouteIds = (arr: string[]) =>
    arr.filter((id) => manifest.routes[id].hasLoader).join(",");

  // By default, we don't include this param and run all matched loaders on the
  // server.  If _any_ of our matches include a `shouldRevalidate` function _and_
  // we've determined that the routes we need to load and the matches are
  // different, then we send the header since they've opted-into fine-grained
  // caching.  We look at the `routeModules` here instead of the matches since
  // HDR adds a wrapper for `shouldRevalidate` even if the route didn't have one
  // initially.
  // TODO: We probably can get rid of that wrapper once we're strictly on on
  // single-fetch in v3 and just leverage a needsRevalidation data structure here
  // to determine what to fetch
  if (matchedRoutes.some((r) => routeModules[r.id]?.shouldRevalidate)) {
    let matchedIds = genRouteIds(matchedRoutes.map((r) => r.id));
    let loadIds = genRouteIds(loadRoutes.map((r) => r.id));
    if (matchedIds !== loadIds) {
      url.searchParams.set("_routes", loadIds);
    }
  }
  return url;
}

export function singleFetchUrl(reqUrl: URL | string) {
  let url =
    typeof reqUrl === "string"
      ? new URL(
          reqUrl,
          typeof window !== "undefined"
            ? window.location.origin
            : "http://localhost"
        )
      : reqUrl;
  url.pathname = `${url.pathname === "/" ? "_root" : url.pathname}.data`;
  return url;
}

async function fetchAndDecode(url: URL, init?: RequestInit) {
  let res = await fetch(url, init);
  if (res.headers.get("Content-Type")?.includes("text/x-turbo")) {
    invariant(res.body, "No response body to decode");
    let decoded = await decodeViaTurboStream(res.body, window);
    return { status: res.status, data: decoded.value };
  }

  // If we didn't get back a turbo-stream response, then we never reached the
  // Remix server and likely this is a network error - just expose up the
  // response body as an Error
  throw new Error(await res.text());
}

// Note: If you change this function please change the corresponding
// encodeViaTurboStream function in server-runtime
export function decodeViaTurboStream(
  body: ReadableStream<Uint8Array>,
  global: Window | typeof globalThis
) {
  return decode(body, [
    (type: string, value: unknown) => {
      // Decode Errors back into Error instances using the right type and with
      // the right (potentially undefined) stacktrace
      if (type === "SanitizedError") {
        let { message, stack, name } = value as {
          message: string;
          stack?: string;
          name: string;
        };
        let Constructor = Error;
        // @ts-expect-error
        if (name && name in global && typeof global[name] === "function") {
          // @ts-expect-error
          Constructor = global[name];
        }
        let error = new Constructor(message);
        error.stack = stack;
        return { value: error };
      }

      if (type === "ErrorResponse") {
        let { data, status, statusText } = value as ErrorResponse;
        return {
          value: new ErrorResponseImpl(status, statusText, data),
        };
      }
    },
  ]);
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
