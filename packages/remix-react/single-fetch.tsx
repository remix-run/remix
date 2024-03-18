import * as React from "react";
import type {
  unstable_DataStrategyFunction as DataStrategyFunction,
  unstable_HandlerResult as HandlerResult,
} from "@remix-run/router";
import {
  UNSAFE_ErrorResponseImpl as ErrorResponseImpl,
  redirect,
} from "@remix-run/router";
import type {
  UNSAFE_SingleFetchResult as SingleFetchResult,
  UNSAFE_SingleFetchResults as SingleFetchResults,
} from "@remix-run/server-runtime";
import { UNSAFE_SingleFetchRedirectSymbol as SingleFetchRedirectSymbol } from "@remix-run/server-runtime";
import type {
  DataRouteObject,
  unstable_DataStrategyFunctionArgs as DataStrategyFunctionArgs,
} from "react-router-dom";
import { decode } from "turbo-stream";

import { createRequestInit } from "./data";
import type { AssetsManifest, EntryContext } from "./entry";
import type { RouteModules } from "./routeModules";
import invariant from "./invariant";

interface StreamTransferProps {
  context: EntryContext;
  identifier: number;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  textDecoder: TextDecoder;
}

// StreamTransfer recursively renders down chunks of the `serverHandoffStream`
// into the client-side `streamController`
export function StreamTransfer({
  context,
  identifier,
  reader,
  textDecoder,
}: StreamTransferProps) {
  // If the user didn't render the <Scripts> component then we don't have to
  // bother streaming anything in
  if (!context.renderMeta || !context.renderMeta.didRenderScripts) {
    return null;
  }

  if (!context.renderMeta.streamCache) {
    context.renderMeta.streamCache = {};
  }
  let { streamCache } = context.renderMeta;
  let promise = streamCache[identifier];
  if (!promise) {
    promise = streamCache[identifier] = reader
      .read()
      .then((result) => {
        streamCache[identifier].result = {
          done: result.done,
          value: textDecoder.decode(result.value, { stream: true }),
        };
      })
      .catch((e) => {
        streamCache[identifier].error = e;
      });
  }

  if (promise.error) {
    throw promise.error;
  }
  if (promise.result === undefined) {
    throw promise;
  }

  let { done, value } = promise.result;
  let scriptTag = value ? (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__remixContext.streamController.enqueue(${JSON.stringify(
          value
        )});`,
      }}
    />
  ) : null;

  if (done) {
    return (
      <>
        {scriptTag}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__remixContext.streamController.close();`,
          }}
        />
      </>
    );
  } else {
    return (
      <>
        {scriptTag}
        <React.Suspense>
          <StreamTransfer
            context={context}
            identifier={identifier + 1}
            reader={reader}
            textDecoder={textDecoder}
          />
        </React.Suspense>
      </>
    );
  }
}

export function getSingleFetchDataStrategy(
  manifest: AssetsManifest,
  routeModules: RouteModules
): DataStrategyFunction {
  let genRouteIds = (arr: string[]) =>
    arr.filter((id) => manifest.routes[id].hasLoader).join(",");

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

      singleFetch = async (routeId) => {
        let results: SingleFetchResults;
        if (manifest.routes[routeId].hasClientLoader) {
          // When a route has a client loader, we make it's own call for just
          // it's server loader data
          let url = stripIndexParam(singleFetchUrl(request.url));
          url.searchParams.set("_routes", routeId);
          let { data } = await fetchAndDecode(url);
          results = data as SingleFetchResults;
        } else {
          // Otherwise we let multiple routes hook onto the same promise
          if (!singleFetchPromise) {
            let url = addRevalidationParam(
              manifest,
              routeModules,
              matches.map((m) => m.route),
              matches.filter((m) => m.shouldLoad).map((m) => m.route),
              stripIndexParam(singleFetchUrl(request.url))
            );
            singleFetchPromise = fetchAndDecode(url).then(
              ({ data }) => data as SingleFetchResults
            );
          }
          results = await singleFetchPromise;
        }
        let redirect = results[SingleFetchRedirectSymbol];
        if (redirect) {
          return unwrapSingleFetchResult(redirect, routeId);
        } else {
          return results[routeId] !== undefined
            ? unwrapSingleFetchResult(results[routeId], routeId)
            : null;
        }
      };
    }

    // Call the route handlers passing through the `singleFetch` function that will
    // be called instead of making a server call
    return Promise.all(
      matches.map(async (m) =>
        m.resolve(async (handler): Promise<HandlerResult> => {
          return {
            type: "data",
            result: await handler(() => singleFetch(m.route.id)),
            status: actionStatus,
          };
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
// for fine-grained revalidation if necessary. There's some nuance to this decision:
//
//  - The presence of `shouldRevalidate` and `clientLoader` functions are the only
//    way to trigger fine-grained single fetch loader calls.  without either of
//    these on the route matches we just always ask for the full `.data` request.
//  - If any routes have a `shouldRevalidate` or `clientLoader` then we do a
//    comparison of the routes we matched and the routes we're aiming to load
//  - If they don't match up, then we add the `_routes` param or fine-grained
//    loading
//  - This is used by the single fetch implementation above and by the
//    `<PrefetchPageLinksImpl>` component so we can prefetch routes using the
//    same logic
export function addRevalidationParam(
  manifest: AssetsManifest,
  routeModules: RouteModules,
  matchedRoutes: DataRouteObject[],
  loadRoutes: DataRouteObject[],
  url: URL
) {
  let genRouteIds = (arr: string[]) =>
    arr.filter((id) => manifest.routes[id].hasLoader).join(",");

  // Look at the `routeModules` for `shouldRevalidate` here instead of the manifest
  // since HDR adds a wrapper for `shouldRevalidate` even if the route didn't have one
  // initially.
  // TODO: We probably can get rid of that wrapper once we're strictly on on
  // single-fetch in v3 and just leverage a needsRevalidation data structure here
  // to determine what to fetch
  let needsParam = matchedRoutes.some(
    (r) =>
      routeModules[r.id]?.shouldRevalidate ||
      manifest.routes[r.id]?.hasClientLoader
  );
  if (!needsParam) {
    return url;
  }

  let matchedIds = genRouteIds(matchedRoutes.map((r) => r.id));
  let loadIds = genRouteIds(
    loadRoutes
      .filter((r) => !manifest.routes[r.id]?.hasClientLoader)
      .map((r) => r.id)
  );
  if (matchedIds !== loadIds) {
    url.searchParams.set("_routes", loadIds);
  }
  return url;
}

export function singleFetchUrl(reqUrl: URL | string) {
  let url =
    typeof reqUrl === "string"
      ? new URL(reqUrl, window.location.origin)
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
  return decode(body, {
    plugins: [
      (type: string, ...rest: unknown[]) => {
        // Decode Errors back into Error instances using the right type and with
        // the right (potentially undefined) stacktrace
        if (type === "SanitizedError") {
          let [name, message, stack] = rest as [
            string,
            string,
            string | undefined
          ];
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
          let [data, status, statusText] = rest as [
            unknown,
            number,
            string | undefined
          ];
          return {
            value: new ErrorResponseImpl(status, statusText, data),
          };
        }

        if (type === "SingleFetchRedirect") {
          return { value: { [SingleFetchRedirectSymbol]: rest[0] } };
        }
      },
    ],
  });
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
    throw new Error(`No response found for routeId "${routeId}"`);
  }
}
