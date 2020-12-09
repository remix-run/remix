import {
  Headers,
  Request,
  Response,
  fetch as nodeFetch,
  RequestInit,
  RequestInfo
} from "@remix-run/core";

declare module global {
  export { Headers, Request, Response, fetch };
}

let fetch = (input: RequestInfo, init?: RequestInit) =>
  nodeFetch(input, { compress: false, ...init });

global.Headers = Headers;
global.Request = Request;
global.Response = Response;
global.fetch = fetch;
