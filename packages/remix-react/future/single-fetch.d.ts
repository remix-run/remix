import type { MetaArgs, UNSAFE_MetaMatch } from "@remix-run/react";
import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  SerializeFrom,
  TypedDeferredData,
  TypedResponse,
} from "@remix-run/server-runtime";
import type {
  useFetcher as useFetcherRR,
  FetcherWithComponents,
} from "react-router-dom";

type Serializable =
  | undefined
  | null
  | boolean
  | string
  | symbol
  | number
  | Array<Serializable>
  | { [key: PropertyKey]: Serializable }
  | bigint
  | Date
  | URL
  | RegExp
  | Error
  | Map<Serializable, Serializable>
  | Set<Serializable>
  | Promise<Serializable>;

type DataFunctionReturnValue =
  | Serializable
  | TypedDeferredData<Record<string, unknown>>
  | TypedResponse<Record<string, unknown>>;

type LoaderFunction_SingleFetch = (
  args: LoaderFunctionArgs
) => Promise<DataFunctionReturnValue> | DataFunctionReturnValue;
type ActionFunction_SingleFetch = (
  args: ActionFunctionArgs
) => Promise<DataFunctionReturnValue> | DataFunctionReturnValue;

// Backwards-compatible type for Remix v2 where json/defer still use the old types,
// and only non-json/defer returns use the new types.  This allows for incremental
// migration of loaders to return naked objects.  In the next major version,
// json/defer will be removed so everything will use the new simplified typings.
// prettier-ignore
type SingleFetchSerialize_V2<T extends LoaderFunction_SingleFetch | ActionFunction_SingleFetch> =
  Awaited<ReturnType<T>> extends TypedDeferredData<infer D> ? D :
  Awaited<ReturnType<T>> extends TypedResponse<Record<string, unknown>> ? SerializeFrom<T> :
  Awaited<ReturnType<T>>;

declare module "@remix-run/react" {
  export function useLoaderData<T>(): T extends LoaderFunction_SingleFetch
    ? SingleFetchSerialize_V2<T>
    : never;

  export function useActionData<T>(): T extends ActionFunction_SingleFetch
    ? SingleFetchSerialize_V2<T>
    : never;

  export function useRouteLoaderData<T>(
    routeId: string
  ): T extends LoaderFunction_SingleFetch ? SingleFetchSerialize_V2<T> : never;

  export function useFetcher<TData = unknown>(
    opts?: Parameters<typeof useFetcherRR>[0]
  ): FetcherWithComponents<
    TData extends LoaderFunction_SingleFetch | ActionFunction_SingleFetch
      ? SingleFetchSerialize_V2<TData>
      : never
  >;

  export type UIMatch_SingleFetch<D = unknown, H = unknown> = Omit<
    UIMatch<D, H>,
    "data"
  > & {
    data: D extends LoaderFunction_SingleFetch
      ? SingleFetchSerialize_V2<D>
      : never;
  };

  interface MetaMatch_SingleFetch<
    RouteId extends string = string,
    Loader extends LoaderFunction_SingleFetch | unknown = unknown
  > extends Omit<UNSAFE_MetaMatch<RouteId, Loader>, "data"> {
    data: Loader extends LoaderFunction_SingleFetch
      ? SingleFetchSerialize_V2<Loader>
      : unknown;
  }

  type MetaMatches_SingleFetch<
    MatchLoaders extends Record<
      string,
      LoaderFunction_SingleFetch | unknown
    > = Record<string, unknown>
  > = Array<
    {
      [K in keyof MatchLoaders]: MetaMatch_SingleFetch<
        Exclude<K, number | symbol>,
        MatchLoaders[K]
      >;
    }[keyof MatchLoaders]
  >;

  export interface MetaArgs_SingleFetch<
    Loader extends LoaderFunction_SingleFetch | unknown = unknown,
    MatchLoaders extends Record<
      string,
      LoaderFunction_SingleFetch | unknown
    > = Record<string, unknown>
  > extends Omit<MetaArgs<Loader, MatchLoaders>, "data" | "matches"> {
    data:
      | (Loader extends LoaderFunction_SingleFetch
          ? SingleFetchSerialize_V2<Loader>
          : unknown)
      | undefined;
    matches: MetaMatches_SingleFetch<MatchLoaders>;
  }
}
