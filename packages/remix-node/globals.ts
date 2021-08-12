import crypto from "crypto";

import {
  Headers as NodeHeaders,
  Request as NodeRequest,
  Response as NodeResponse,
  fetch as nodeFetch
} from "./fetch";

declare global {
  namespace NodeJS {
    interface Global {
      Headers: typeof Headers;
      Request: typeof Request;
      Response: typeof Response;
      fetch: typeof fetch;
      crypto: SubtleCrypto;
    }
  }
}

export function installGlobals() {
  ((global as unknown) as NodeJS.Global).Headers = (NodeHeaders as any) as typeof Headers;
  ((global as unknown) as NodeJS.Global).Request = (NodeRequest as any) as typeof Request;
  ((global as unknown) as NodeJS.Global).Response = (NodeResponse as any) as typeof Response;
  ((global as unknown) as NodeJS.Global).fetch = (nodeFetch as any) as typeof fetch;
  // @ts-ignore
  ((global as unknown) as NodeJS.Global).crypto = crypto.webcrypto as any;
}
