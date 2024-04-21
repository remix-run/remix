import type { AppLoadContext } from "@remix-run/server-runtime";

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

type Params<Key extends string = string> = {
  readonly [key in Key]: string | undefined;
};

type ResponseStub = {
  status?: number;
  headers: Headers;
};

type DataFunction = (
  args: {
    request: Request;
    params: Params;
    context: AppLoadContext;
    response: ResponseStub;
  },
  handlerCtx?: unknown
) => Serializable;

type Loader = DataFunction & { hydrate?: boolean };
type Action = DataFunction;

declare module "@remix-run/react" {
  export function useLoaderData<T>(): T extends Loader
    ? Awaited<ReturnType<T>>
    : never;

  export function useActionData<T>(): T extends Action
    ? Awaited<ReturnType<T>>
    : never;
}
