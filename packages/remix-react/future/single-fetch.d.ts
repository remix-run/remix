import type {
  MetaArgs,
  UIMatch,
  UNSAFE_MetaMatch,
  unstable_ClientLoader as ClientLoader,
  unstable_ClientAction as ClientAction,
} from "@remix-run/react";
import type {
  unstable_Loader as Loader,
  unstable_Action as Action,
  unstable_Serialize as Serialize,
} from "@remix-run/server-runtime";
import type {
  useFetcher as useFetcherRR,
  FetcherWithComponents,
} from "react-router-dom";

declare module "@remix-run/react" {
  export function useLoaderData<
    T extends Loader | ClientLoader
  >(): T extends Loader ? Serialize<T> : Awaited<ReturnType<T>>;

  export function useActionData<T extends Action | ClientAction>():
    | (T extends Action ? Serialize<T> : Awaited<ReturnType<T>>)
    | undefined;

  export function useRouteLoaderData<T extends Loader>(
    routeId: string
  ): Serialize<T>;

  export function useFetcher<T extends Loader | Action>(
    opts?: Parameters<typeof useFetcherRR>[0]
  ): FetcherWithComponents<Serialize<T>>;

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
