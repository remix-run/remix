// From the minipass-fetch README:
// Differences from node-fetch (and, by extension, from the WhatWG Fetch specification):
//
// - Returns minipass streams instead of node-core streams.
// - Supports the full set of TLS Options that may be provided to
//   https.request() when making https requests.
declare module "minipass-fetch" {
  import type { ConnectionOptions } from "tls";
  import type {
    HeadersInit,
    RequestInfo,
    RequestInit as NodeFetchRequestInit,
    ResponseInit
  } from "node-fetch";
  import {
    FetchError,
    Headers,
    Request as NodeFetchRequest,
    Response
  } from "node-fetch";

  export type { HeadersInit, RequestInfo, ResponseInit };

  type TlsOptions = Pick<
    ConnectionOptions,
    | "ca"
    | "cert"
    | "ciphers"
    | "clientCertEngine"
    | "crl"
    | "dhparam"
    | "ecdhCurve"
    | "honorCipherOrder"
    | "key"
    | "passphrase"
    | "pfx"
    | "rejectUnauthorized"
    | "secureOptions"
    | "secureProtocol"
    | "servername"
    | "sessionIdContext"
  >;

  export type RequestInit = NodeFetchRequestInit & TlsOptions;

  export { FetchError, Headers, Response };

  export class Request extends NodeFetchRequest {
    constructor(info: RequestInfo, init?: RequestInit);
  }

  export function isRedirect(code: number): boolean;

  export default function fetch(
    info: RequestInfo,
    init?: RequestInit
  ): Promise<Response>;
}
