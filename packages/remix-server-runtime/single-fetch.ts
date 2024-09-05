import type {
  StaticHandler,
  unstable_DataStrategyFunctionArgs as DataStrategyFunctionArgs,
  unstable_DataStrategyFunction as DataStrategyFunction,
  UNSAFE_DataWithResponseInit as DataWithResponseInit,
} from "@remix-run/router";
import {
  isRouteErrorResponse,
  unstable_data as routerData,
  UNSAFE_ErrorResponseImpl as ErrorResponseImpl,
  stripBasename,
} from "@remix-run/router";
import { encode } from "turbo-stream";

import { type Expect, type Equal } from "./typecheck";
import type { ServerBuild } from "./build";
import type { AppLoadContext } from "./data";
import { sanitizeError, sanitizeErrors } from "./errors";
import { getDocumentHeaders } from "./headers";
import { ServerMode } from "./mode";
import type { TypedDeferredData, TypedResponse } from "./responses";
import { isRedirectStatusCode, isResponse } from "./responses";
import type { Jsonify } from "./jsonify";
import type {
  ClientActionFunctionArgs,
  ClientLoaderFunctionArgs,
  LoaderFunctionArgs,
} from "./routeModules";

export const SingleFetchRedirectSymbol = Symbol("SingleFetchRedirect");

type SingleFetchRedirectResult = {
  redirect: string;
  status: number;
  revalidate: boolean;
  reload: boolean;
  replace: boolean;
};
export type SingleFetchResult =
  | { data: unknown }
  | { error: unknown }
  | SingleFetchRedirectResult;

export type SingleFetchResults = {
  [key: string]: SingleFetchResult;
  [SingleFetchRedirectSymbol]?: SingleFetchRedirectResult;
};

// We can't use a 3xx status or else the `fetch()` would follow the redirect.
// We need to communicate the redirect back as data so we can act on it in the
// client side router.  We use a 202 to avoid any automatic caching we might
// get from a 200 since a "temporary" redirect should not be cached.  This lets
// the user control cache behavior via Cache-Control
export const SINGLE_FETCH_REDIRECT_STATUS = 202;

export function getSingleFetchDataStrategy({
  isActionDataRequest,
  loadRouteIds,
}: {
  isActionDataRequest?: boolean;
  loadRouteIds?: string[];
} = {}): DataStrategyFunction {
  return async ({ request, matches }: DataStrategyFunctionArgs) => {
    // Don't call loaders on action data requests
    if (isActionDataRequest && request.method === "GET") {
      return {};
    }

    // Only run opt-in loaders when fine-grained revalidation is enabled
    let matchesToLoad = loadRouteIds
      ? matches.filter((m) => loadRouteIds.includes(m.route.id))
      : matches;
    let results = await Promise.all(
      matchesToLoad.map((match) => match.resolve())
    );
    return results.reduce(
      (acc, result, i) =>
        Object.assign(acc, { [matchesToLoad[i].route.id]: result }),
      {}
    );
  };
}

export async function singleFetchAction(
  build: ServerBuild,
  serverMode: ServerMode,
  staticHandler: StaticHandler,
  request: Request,
  handlerUrl: URL,
  loadContext: AppLoadContext,
  handleError: (err: unknown) => void
): Promise<{ result: SingleFetchResult; headers: Headers; status: number }> {
  try {
    let handlerRequest = new Request(handlerUrl, {
      method: request.method,
      body: request.body,
      headers: request.headers,
      signal: request.signal,
      ...(request.body ? { duplex: "half" } : undefined),
    });

    let result = await staticHandler.query(handlerRequest, {
      requestContext: loadContext,
      skipLoaderErrorBubbling: true,
      unstable_dataStrategy: getSingleFetchDataStrategy({
        isActionDataRequest: true,
      }),
    });

    // Unlike `handleDataRequest`, when singleFetch is enabled, query does
    // let non-Response return values through
    if (isResponse(result)) {
      return {
        result: getSingleFetchRedirect(
          result.status,
          result.headers,
          build.basename
        ),
        headers: result.headers,
        status: SINGLE_FETCH_REDIRECT_STATUS,
      };
    }

    let context = result;
    let headers = getDocumentHeaders(build, context);

    if (isRedirectStatusCode(context.statusCode) && headers.has("Location")) {
      return {
        result: getSingleFetchRedirect(
          context.statusCode,
          headers,
          build.basename
        ),
        headers,
        status: SINGLE_FETCH_REDIRECT_STATUS,
      };
    }

    // Sanitize errors outside of development environments
    if (context.errors) {
      Object.values(context.errors).forEach((err) => {
        // @ts-expect-error This is "private" from users but intended for internal use
        if (!isRouteErrorResponse(err) || err.error) {
          handleError(err);
        }
      });
      context.errors = sanitizeErrors(context.errors, serverMode);
    }

    let singleFetchResult: SingleFetchResult;
    if (context.errors) {
      singleFetchResult = { error: Object.values(context.errors)[0] };
    } else {
      singleFetchResult = { data: Object.values(context.actionData || {})[0] };
    }

    return {
      result: singleFetchResult,
      headers,
      status: context.statusCode,
    };
  } catch (error) {
    handleError(error);
    // These should only be internal remix errors, no need to deal with responseStubs
    return {
      result: { error },
      headers: new Headers(),
      status: 500,
    };
  }
}

export async function singleFetchLoaders(
  build: ServerBuild,
  serverMode: ServerMode,
  staticHandler: StaticHandler,
  request: Request,
  handlerUrl: URL,
  loadContext: AppLoadContext,
  handleError: (err: unknown) => void
): Promise<{ result: SingleFetchResults; headers: Headers; status: number }> {
  try {
    let handlerRequest = new Request(handlerUrl, {
      headers: request.headers,
      signal: request.signal,
    });
    let loadRouteIds =
      new URL(request.url).searchParams.get("_routes")?.split(",") || undefined;

    let result = await staticHandler.query(handlerRequest, {
      requestContext: loadContext,
      skipLoaderErrorBubbling: true,
      unstable_dataStrategy: getSingleFetchDataStrategy({
        loadRouteIds,
      }),
    });

    if (isResponse(result)) {
      return {
        result: {
          [SingleFetchRedirectSymbol]: getSingleFetchRedirect(
            result.status,
            result.headers,
            build.basename
          ),
        },
        headers: result.headers,
        status: SINGLE_FETCH_REDIRECT_STATUS,
      };
    }

    let context = result;
    let headers = getDocumentHeaders(build, context);

    if (isRedirectStatusCode(context.statusCode) && headers.has("Location")) {
      return {
        result: {
          [SingleFetchRedirectSymbol]: getSingleFetchRedirect(
            context.statusCode,
            headers,
            build.basename
          ),
        },
        headers,
        status: SINGLE_FETCH_REDIRECT_STATUS,
      };
    }

    // Sanitize errors outside of development environments
    if (context.errors) {
      Object.values(context.errors).forEach((err) => {
        // @ts-expect-error This is "private" from users but intended for internal use
        if (!isRouteErrorResponse(err) || err.error) {
          handleError(err);
        }
      });
      context.errors = sanitizeErrors(context.errors, serverMode);
    }

    // Aggregate results based on the matches we intended to load since we get
    // `null` values back in `context.loaderData` for routes we didn't load
    let results: SingleFetchResults = {};
    let loadedMatches = loadRouteIds
      ? context.matches.filter(
          (m) => m.route.loader && loadRouteIds!.includes(m.route.id)
        )
      : context.matches;

    loadedMatches.forEach((m) => {
      let data = context.loaderData?.[m.route.id];
      let error = context.errors?.[m.route.id];
      if (error !== undefined) {
        results[m.route.id] = { error };
      } else if (data !== undefined) {
        results[m.route.id] = { data };
      }
    });

    return {
      result: results,
      headers,
      status: context.statusCode,
    };
  } catch (error: unknown) {
    handleError(error);
    // These should only be internal remix errors, no need to deal with responseStubs
    return {
      result: { root: { error } },
      headers: new Headers(),
      status: 500,
    };
  }
}

export function getSingleFetchRedirect(
  status: number,
  headers: Headers,
  basename: string | undefined
): SingleFetchRedirectResult {
  let redirect = headers.get("Location")!;

  if (basename) {
    redirect = stripBasename(redirect, basename) || redirect;
  }

  return {
    redirect,
    status,
    revalidate:
      // Technically X-Remix-Revalidate isn't needed here - that was an implementation
      // detail of ?_data requests as our way to tell the front end to revalidate when
      // we didn't have a response body to include that information in.
      // With single fetch, we tell the front end via this revalidate boolean field.
      // However, we're respecting it for now because it may be something folks have
      // used in their own responses
      // TODO(v3): Consider removing or making this official public API
      headers.has("X-Remix-Revalidate") || headers.has("Set-Cookie"),
    reload: headers.has("X-Remix-Reload-Document"),
    replace: headers.has("X-Remix-Replace"),
  };
}

// Note: If you change this function please change the corresponding
// decodeViaTurboStream function in server-runtime
export function encodeViaTurboStream(
  data: any,
  requestSignal: AbortSignal,
  streamTimeout: number | undefined,
  serverMode: ServerMode
) {
  let controller = new AbortController();
  // How long are we willing to wait for all of the promises in `data` to resolve
  // before timing out?  We default this to 50ms shorter than the default value for
  // `ABORT_DELAY` in our built-in `entry.server.tsx` so that once we reject we
  // have time to flush the rejections down through React's rendering stream before `
  // we call abort() on that.  If the user provides their own it's up to them to
  // decouple the aborting of the stream from the aborting of React's renderToPipeableStream
  let timeoutId = setTimeout(
    () => controller.abort(new Error("Server Timeout")),
    typeof streamTimeout === "number" ? streamTimeout : 4950
  );
  requestSignal.addEventListener("abort", () => clearTimeout(timeoutId));

  return encode(data, {
    signal: controller.signal,
    plugins: [
      (value) => {
        // Even though we sanitized errors on context.errors prior to responding,
        // we still need to handle this for any deferred data that rejects with an
        // Error - as those will not be sanitized yet
        if (value instanceof Error) {
          let { name, message, stack } =
            serverMode === ServerMode.Production
              ? sanitizeError(value, serverMode)
              : value;
          return ["SanitizedError", name, message, stack];
        }

        if (value instanceof ErrorResponseImpl) {
          let { data, status, statusText } = value;
          return ["ErrorResponse", data, status, statusText];
        }

        if (
          value &&
          typeof value === "object" &&
          SingleFetchRedirectSymbol in value
        ) {
          return ["SingleFetchRedirect", value[SingleFetchRedirectSymbol]];
        }
      },
    ],
    postPlugins: [
      (value) => {
        if (!value) return;
        if (typeof value !== "object") return;

        return [
          "SingleFetchClassInstance",
          Object.fromEntries(Object.entries(value)),
        ];
      },
      () => ["SingleFetchFallback"],
    ],
  });
}

export function data<T>(value: T, init?: number | ResponseInit) {
  return routerData(value, init);
}

type Serializable =
  | undefined
  | null
  | boolean
  | string
  | symbol
  | number
  | bigint
  | Date
  | URL
  | RegExp
  | Error
  | ReadonlyArray<Serializable>
  | Array<Serializable>
  | { [key: PropertyKey]: Serializable }
  | Map<Serializable, Serializable>
  | Set<Serializable>
  | Promise<Serializable>;

// prettier-ignore
type Serialize<T> =
  T extends void ? undefined :

  // First, let type stay as-is if its already serializable...
  T extends Serializable ? T :

  // ...then don't allow functions to be serialized...
  T extends (...args: any[]) => unknown ? undefined :

  // ...lastly handle inner types for all container types allowed by `turbo-stream`

  // Promise
  T extends Promise<infer U> ? Promise<Serialize<U>> :

  // Map & Set
  T extends Map<infer K, infer V> ? Map<Serialize<K>, Serialize<V>> :
  T extends Set<infer U> ? Set<Serialize<U>> :

  // Array
  T extends [] ? [] :
  T extends readonly [infer F, ...infer R] ? [Serialize<F>, ...Serialize<R>] :
  T extends Array<infer U> ? Array<Serialize<U>> :
  T extends readonly unknown[] ? readonly Serialize<T[number]>[] :

  // Record
  T extends Record<any, any> ? {[K in keyof T]: Serialize<T[K]>} :

  undefined

type Fn = (...args: any[]) => unknown;

// Backwards-compatible type for Remix v2 where json/defer still use the old types,
// and only non-json/defer returns use the new types.  This allows for incremental
// migration of loaders to return naked objects.  In the next major version,
// json/defer will be removed so everything will use the new simplified typings.
// prettier-ignore
export type SerializeFrom<T extends Fn> =
  Parameters<T> extends [ClientLoaderFunctionArgs | ClientActionFunctionArgs] ?
    Awaited<ReturnType<T>> extends TypedResponse<infer U> ? Jsonify<U> :
    Awaited<ReturnType<T>> extends TypedDeferredData<infer U> ? U :
    Awaited<ReturnType<T>>
  :
  Awaited<ReturnType<T>> extends TypedResponse<infer U> ? Jsonify<U> :
  Awaited<ReturnType<T>> extends TypedDeferredData<infer U> ? Serialize<U> :
  Awaited<ReturnType<T>> extends DataWithResponseInit<infer D> ? Serialize<D> :
  Serialize<Awaited<ReturnType<T>>>;

type ServerLoader<T> = (args: LoaderFunctionArgs) => T;
type ClientLoader<T> = (args: ClientLoaderFunctionArgs) => T;

class TestClass {
  constructor(public a: string, public b: Date) {
    this.a = a;
    this.b = b;
  }

  testmethod() {}
}

interface TestInterface {
  undefined: undefined;
  null: null;
  boolean: boolean;
  string: string;
  symbol: symbol;
  number: number;
  bigint: bigint;
  Date: Date;
  URL: URL;
  RegExp: RegExp;
  Error: Error;
  Array: Array<bigint>;
  ReadonlyArray: ReadonlyArray<bigint>;
  Set: Set<Error>;
  Map: Map<Date, RegExp>;
}

type Recursive = {
  a: string;
  b: Date;
  recursive?: Recursive;
};

type Pretty<T> = { [K in keyof T]: T[K] } & {};

// prettier-ignore
// eslint-disable-next-line
type _tests = [
  Expect<Equal<SerializeFrom<ServerLoader<void>>, undefined>>,
  Expect<Equal<SerializeFrom<ServerLoader<{
    undefined: undefined,
    null: null,
    boolean: boolean,
    string: string,
    symbol: symbol,
    number: number,
    bigint: bigint,
    Date: Date,
    URL: URL,
    RegExp: RegExp,
    Error: Error,
    Array: Array<bigint>;
    ReadonlyArray: ReadonlyArray<bigint>;
    Set: Set<Error>,
    Map: Map<Date, RegExp>,
    TestInterface: TestInterface,
    Recursive: Recursive
  }>>, {
    undefined: undefined,
    null: null,
    boolean: boolean,
    string: string,
    symbol: symbol,
    number: number,
    bigint: bigint,
    Date: Date,
    URL: URL,
    RegExp: RegExp,
    Error: Error,
    Array: Array<bigint>;
    ReadonlyArray: ReadonlyArray<bigint>;
    Set: Set<Error>,
    Map: Map<Date, RegExp>,
    TestInterface: TestInterface
    Recursive: Recursive
  }>>,
  Expect<Equal<SerializeFrom<ServerLoader<[
    undefined,
    null,
    boolean,
    string,
    symbol,
    number,
    bigint,
    Date,
    URL,
    RegExp,
    Error,
    Array<bigint>,
    ReadonlyArray<bigint>,
    Set<Error>,
    Map<Date, RegExp>,
  ]>>, [
    undefined,
    null,
    boolean,
    string,
    symbol,
    number,
    bigint,
    Date,
    URL,
    RegExp,
    Error,
    Array<bigint>,
    ReadonlyArray<bigint>,
    Set<Error>,
    Map<Date, RegExp>,
  ]>>,
  Expect<Equal<SerializeFrom<ServerLoader<Promise<[
    undefined,
    null,
    boolean,
    string,
    symbol,
    number,
    bigint,
    Date,
    URL,
    RegExp,
    Error,
    Array<bigint>,
    ReadonlyArray<bigint>,
    Set<Error>,
    Map<Date, RegExp>,
  ]>>>, [
    undefined,
    null,
    boolean,
    string,
    symbol,
    number,
    bigint,
    Date,
    URL,
    RegExp,
    Error,
    Array<bigint>,
    ReadonlyArray<bigint>,
    Set<Error>,
    Map<Date, RegExp>,
  ]>>,

  Expect<Equal<SerializeFrom<ServerLoader<{
    function: () => void,
    class: TestClass
  }>>, {
    function: undefined,
    class: {
      a: string
      b: Date,
      testmethod: undefined
    },
  }>>,

  Expect<Equal<SerializeFrom<ClientLoader<{
    function: () => void,
    class: TestClass
  }>>, {
    function: () => void,
    class: TestClass
  }>>,

  Expect<Equal<Pretty<SerializeFrom<ServerLoader<TypedResponse<{a: string, b: Date}>>>>, { a: string, b: string }>>,
  Expect<Equal<Pretty<SerializeFrom<ServerLoader<TypedDeferredData<{a: string, b: Promise<Date>}>>>>, { a: string, b: Promise<Date> }>>,
]
