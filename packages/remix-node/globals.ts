import crypto from "crypto";

import { Headers, Request, Response, fetch } from "./fetch";

declare global {
  namespace NodeJS {
    interface Global {
      Headers: typeof Headers;
      Request: typeof Request;
      Response: typeof Response;
      fetch: typeof fetch;
      crypto: Crypto;
    }
  }
}

export function installGlobals() {
  (global as NodeJS.Global).Headers = Headers;
  (global as NodeJS.Global).Request = Request;
  (global as NodeJS.Global).Response = Response;
  (global as NodeJS.Global).fetch = fetch;

  // TODO: Do we need to install something here to get crypto.webcrypto types?
  // @ts-expect-error
  (global as NodeJS.Global).crypto = crypto.webcrypto as Crypto;
}
