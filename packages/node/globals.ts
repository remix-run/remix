// This file type-checks just fine using only @types/node, but when TypeScript's
// lib.dom.d.ts is included in the compilation there are conflicts with DOM
// globals. So we isolate the globals to this one file only and disable
// type-checking here to get around it.
// @ts-nocheck
import {
  Headers as NodeFetchHeaders,
  Request as NodeFetchRequest,
  Response as NodeFetchResponse,
  fetch as nodeFetch
} from "./fetch";

declare global {
  // Allows referencing these symbols as true globals, e.g.
  // var headers = new Headers();
  const Headers: typeof NodeFetchHeaders;
  const Request: typeof NodeFetchRequest;
  const Response: typeof NodeFetchResponse;
  const fetch: typeof nodeFetch;

  namespace NodeJS {
    interface Global {
      // Allows referencing properties of node's `global` object, i.e.
      // var headers = new global.Headers();
      Headers: typeof NodeFetchHeaders;
      Request: typeof NodeFetchRequest;
      Response: typeof NodeFetchResponse;
      fetch: typeof nodeFetch;
    }
  }
}

global.Headers = NodeFetchHeaders;
global.Request = NodeFetchRequest;
global.Response = NodeFetchResponse;
global.fetch = nodeFetch;
