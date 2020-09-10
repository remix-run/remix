export type { RemixConfig } from "./config";
export { readConfig } from "./config";

export type { LoadContext, RemixLoader } from "./match";

export type {
  HeadersInit,
  Body,
  RequestInit,
  ResponseInit,
  RequestHandler
} from "./platform";
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
  createRequestHandler
} from "./platform";
