import { Headers, Request, Response, fetch } from "./fetch";

declare module global {
  export { Headers, Request, Response, fetch };
}

global.Headers = Headers;
global.Request = Request;
global.Response = Response;
global.fetch = fetch;
