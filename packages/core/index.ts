export type { RemixServerContext } from "./build";

export { build, watch } from "./compiler";

export type { RemixConfig } from "./config";
export { readConfig } from "./config";

export type {
  LoaderResultType as LoaderResultStatus,
  LoaderResultCopy,
  LoaderResultSuccess,
  LoaderResultError,
  LoaderResult,
  AppLoadContext,
  RemixLoader
} from "./load";

export type { HeadersInit, Body, RequestInit, ResponseInit } from "./platform";
export {
  Headers,
  Message,
  RequestCache,
  RequestCredentials,
  RequestDestination,
  RequestMode,
  RequestRedirect,
  Request,
  ResponseType,
  Response,
  StatusCode,
  statusCode,
  Redirect,
  redirect,
  NotFound,
  notFound
} from "./platform";

export type { RequestHandler } from "./server";
export { createRequestHandler } from "./server";
