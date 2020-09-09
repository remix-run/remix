export type { RemixConfig } from "./config";
export { readConfig } from "./config";

export type {
  HeadersInit,
  Body,
  RequestInit,
  ResponseInit,
  RequestHandler,
  LoadContext
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
