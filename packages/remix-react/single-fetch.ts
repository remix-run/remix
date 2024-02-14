import type { DataStrategyMatch } from "@remix-run/router";
import type { SerializeFrom } from "@remix-run/server-runtime";
import { redirect } from "@remix-run/router";
import type { DataStrategyFunctionArgs } from "react-router-dom";
import { decode } from "turbo-stream";

import { createRequestInit } from "./data";
import invariant from "./invariant";
import { prefetchStyleLinks } from "./links";
import {
  noActionDefinedError,
  preventInvalidServerHandlerCall,
} from "./routes";

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
  // Prefetch styles for matched routes that exist in the routeModulesCache
  // (critical modules and navigating back to pages previously loaded via
  // route.lazy).  Initial execution of route.lazy (when the module is not in
  // the cache) will handle prefetching style links via loadRouteModuleWithBlockingLinks.
  let stylesPromise = Promise.all(
    matches.map((m) => {
      let route = window.__remixManifest.routes[m.route.id];
      let cachedModule = window.__remixRouteModules[m.route.id];
      return cachedModule
        ? prefetchStyleLinks(route, cachedModule)
        : Promise.resolve();
    })
  );

  let dataPromise =
    request.method === "GET"
      ? singleFetchLoaders(request, matches)
      : singleFetchAction(request, matches);

  let [routeData] = await Promise.all([dataPromise, stylesPromise]);
  return routeData;

  // TODO: Do styles load twice on actions?
  // TODO: Critical route modules for single fetch
  // TODO: Don't revalidate on action 4xx/5xx responses with status codes
  //       (return or throw)
  // TODO: Fix issue with auto-revalidating routes on HMR
  //  - load /
  //  - navigate to /parent/child
  //  - trigger HMR
  //  - back button to /
  //  - throws a "you returned undefined from a loader" error
}

function singleFetchAction(request: Request, matches: DataStrategyMatch[]) {
  let singleFetch = async (routeId: string) => {
    let init = await createRequestInit(request);
    let res = await fetch(singleFetchUrl(request.url), init);
    invariant(
      res.headers.get("Content-Type")?.includes("text/x-turbo"),
      "Expected a text/x-turbo response"
    );
    let decoded = await decode(res.body!);
    let result = decoded.value as SingleFetchResult;
    return unwrapSingleFetchResult(result, routeId);
  };

  return Promise.all(
    matches.map((m) =>
      m.bikeshed_loadRoute(() => {
        let route = window.__remixManifest.routes[m.route.id];
        let routeModule = window.__remixRouteModules[m.route.id];
        invariant(
          routeModule,
          "Expected a defined routeModule after bikeshed_loadRoute"
        );

        if (routeModule.clientAction) {
          return routeModule.clientAction({
            request,
            params: m.params,
            serverAction<T>() {
              preventInvalidServerHandlerCall(
                "action",
                route,
                window.__remixContext.isSpaMode
              );
              return singleFetch(m.route.id) as Promise<SerializeFrom<T>>;
            },
          });
        } else if (route.hasAction) {
          return singleFetch(m.route.id);
        } else {
          throw noActionDefinedError("action", m.route.id);
        }
      })
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
    // Single fetch doesn't need/want naked index queries on action
    // revalidation requests
    let url = singleFetchUrl(stripIndexParam(request.url));

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
    let headers =
      matchedIds !== loadIds ? { "X-Remix-Routes": loadIds } : undefined;

    let res = await fetch(url, { headers });
    invariant(
      res.body != null &&
        res.headers.get("Content-Type")?.includes("text/x-turbo"),
      "Expected a text/x-turbo response"
    );
    let decoded = await decode(res.body!);
    return decoded.value as SingleFetchResults;
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

  return Promise.all(
    matches.map((m) =>
      m.bikeshed_loadRoute(() => {
        let route = window.__remixManifest.routes[m.route.id];
        let routeModule = window.__remixRouteModules[m.route.id];
        invariant(routeModule, "Expected a routeModule in bikeshed_loadRoute");

        if (routeModule.clientLoader) {
          return routeModule.clientLoader({
            request,
            params: m.params,
            serverLoader<T>() {
              preventInvalidServerHandlerCall(
                "loader",
                route,
                window.__remixContext.isSpaMode
              );
              return singleFetch(m.route.id) as Promise<SerializeFrom<T>>;
            },
          });
        } else if (route.hasLoader) {
          return singleFetch(m.route.id);
        } else {
          // Remix routes without a server loader still have a "loader" on the
          // client to preload styles, so just return nothing here.
          return Promise.resolve(null);
        }
      })
    )
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
