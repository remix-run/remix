import type { MetaArgs, UIMatch, UNSAFE_MetaMatch } from "@remix-run/react";
import type {
  Loader,
  Action,
  SerializeFrom,
  TypedDeferredData,
  TypedResponse,
} from "@remix-run/server-runtime";
import type {
  useFetcher as useFetcherRR,
  FetcherWithComponents,
} from "react-router-dom";

// Backwards-compatible type for Remix v2 where json/defer still use the old types,
// and only non-json/defer returns use the new types.  This allows for incremental
// migration of loaders to return naked objects.  In the next major version,
// json/defer will be removed so everything will use the new simplified typings.
// prettier-ignore
type Serialize<T extends Loader | Action> =
  Awaited<ReturnType<T>> extends TypedDeferredData<infer D> ? D :
  Awaited<ReturnType<T>> extends TypedResponse<Record<string, unknown>> ? SerializeFrom<T> :
  Awaited<ReturnType<T>>;

declare module "@remix-run/react" {
  export function useLoaderData<T>(): T extends Loader ? Serialize<T> : T;

  export function useActionData<T>(): T extends Action
    ? Serialize<T> | undefined
    : T;

  export function useRouteLoaderData<T>(
    routeId: string
  ): T extends Loader ? Serialize<T> : never;

  export function useFetcher<TData = unknown>(
    opts?: Parameters<typeof useFetcherRR>[0]
  ): FetcherWithComponents<
    TData extends Loader | Action ? Serialize<TData> : TData
  >;

  export type UIMatch_SingleFetch<D = unknown, H = unknown> = Omit<
    UIMatch<D, H>,
    "data"
  > & {
    data: D extends Loader ? Serialize<D> : never;
  };

  interface MetaMatch_SingleFetch<
    RouteId extends string = string,
    L extends Loader | unknown = unknown
  > extends Omit<UNSAFE_MetaMatch<RouteId, L>, "data"> {
    data: L extends Loader ? Serialize<L> : unknown;
  }

  type MetaMatches_SingleFetch<
    MatchLoaders extends Record<string, Loader | unknown> = Record<
      string,
      unknown
    >
  > = Array<
    {
      [K in keyof MatchLoaders]: MetaMatch_SingleFetch<
        Exclude<K, number | symbol>,
        MatchLoaders[K]
      >;
    }[keyof MatchLoaders]
  >;

  export interface MetaArgs_SingleFetch<
    L extends Loader | unknown = unknown,
    MatchLoaders extends Record<string, Loader | unknown> = Record<
      string,
      unknown
    >
  > extends Omit<MetaArgs<L, MatchLoaders>, "data" | "matches"> {
    data: (L extends Loader ? Serialize<L> : unknown) | undefined;
    matches: MetaMatches_SingleFetch<MatchLoaders>;
  }
}
