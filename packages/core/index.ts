export type { RemixEntryContext as RemixServerContext } from "./build";

export { build, watch } from "./compiler";

export type { RemixConfig } from "./config";
export { readConfig } from "./config";

export type { AppLoadContext, RemixLoader } from "./loader";
export {
  LoaderResult,
  LoaderResultChangeStatusCode,
  LoaderResultCopy,
  LoaderResultError,
  LoaderResultRedirect,
  LoaderResultSuccess
} from "./loaderResults";

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
  Redirect,
  redirect,
  StatusCode,
  statusCode,
  NotFound,
  notFound
} from "./platform";

export type { RequestHandler } from "./server";
export { createRequestHandler } from "./server";
