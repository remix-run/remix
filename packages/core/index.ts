export type { BuildManifest, BuildChunk, RouteModule } from "./build";

export { build, watch, BuildMode, BuildTarget } from "./compiler";

export type { RemixConfig } from "./config";
export { readConfig } from "./config";

export type {
  EntryContext,
  RouteData,
  RouteManifest,
  RouteParams,
  RouteLoader
} from "./entry";

export type { AppLoadContext, RemixLoader } from "./loader";

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
