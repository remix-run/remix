import { Headers, Request, Response, fetch } from "@remix-run/core";

declare module global {
  export { Headers, Request, Response, fetch };
}

global.Headers = Headers;
global.Request = Request;
global.Response = Response;

global.fetch = fetch.defaults({
  // Do not decode responses by default. This lets people return `fetch()`
  // directly from a loader w/out changing the Content-Encoding of the
  // response, which is nice.
  compress: false
});
