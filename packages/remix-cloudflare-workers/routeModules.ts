import type {
  ActionFunction as CoreActionFunction,
  HeadersFunction as CoreHeadersFunction,
  LoaderFunction as CoreLoaderFunction
} from "@remix-run/server-runtime";

export type ActionFunction = CoreActionFunction<Request, Response>;

export type HeadersFunction = CoreHeadersFunction<Headers, HeadersInit>;

export type LoaderFunction = CoreLoaderFunction<Request, Response>;
