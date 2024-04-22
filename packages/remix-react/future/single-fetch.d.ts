import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  SerializeFrom,
  TypedDeferredData,
  TypedResponse,
} from "@remix-run/server-runtime";

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

type Loader = ((
  args: LoaderFunctionArgs
) => Promise<DataFunctionReturnValue>) & {
  hydrate?: boolean;
};

type Action = (args: ActionFunctionArgs) => Promise<DataFunctionReturnValue>;

// Backwards-compatible type for Remix v2 where json/defer still use the old types,
// and only non-json/defer returns use the new types.  This allows for incremental
// migration of loaders to return naked objects.  In the next major version,
// json/defer will be removed so everything will use the new simplified typings.
type SingleFetchSerialize_V2<T extends Loader | Action> = Awaited<
  ReturnType<T>
> extends TypedDeferredData<Record<string, unknown>>
  ? SerializeFrom<T>
  : Awaited<ReturnType<T>> extends TypedResponse<Record<string, unknown>>
  ? SerializeFrom<T>
  : Awaited<ReturnType<T>>;

declare module "@remix-run/react" {
  export function useLoaderData<T>(): T extends Loader
    ? SingleFetchSerialize_V2<T>
    : never;

  export function useActionData<T>(): T extends Action
    ? SingleFetchSerialize_V2<T>
    : never;
}
