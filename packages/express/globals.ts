// This file type-checks just fine using only @types/node, but when TypeScript's
// lib.dom.d.ts is included in the compilation there are conflicts with DOM
// globals. So we isolate the globals to this one file only and disable
// type-checking here to get around it.
// @ts-nocheck
import type {
  Headers as NodeHeaders,
  Request as NodeRequest,
  Response as NodeResponse,
  fetch as nodeFetch
} from "@remix-run/node";
import { installGlobals } from "@remix-run/node";

declare global {
  // Allows referencing these symbols as true globals, e.g.
  // var headers = new Headers();
  const Headers: typeof NodeHeaders;
  const Request: typeof NodeRequest;
  const Response: typeof NodeResponse;
  const fetch: typeof nodeFetch;

  namespace NodeJS {
    interface Global {
      // Allows referencing properties of node's `global` object, i.e.
      // var headers = new global.Headers();
      Headers: typeof NodeHeaders;
      Request: typeof NodeRequest;
      Response: typeof NodeResponse;
      fetch: typeof nodeFetch;
    }
  }
}

installGlobals();
