declare module "make-fetch-happen" {
  import type { ClientRequestArgs } from "http";
  import type { ConnectionOptions } from "tls";
  import type { TimeoutsOptions } from "retry";
  import type { Integrity } from "ssri";
  import type {
    FetchError,
    Headers,
    HeadersInit,
    RequestInfo,
    RequestInit as MinipassFetchRequestInit,
    Response,
    ResponseInit
  } from "minipass-fetch";
  import { Request } from "minipass-fetch";

  export type {
    FetchError,
    Headers,
    HeadersInit,
    Request,
    RequestInfo,
    Response,
    ResponseInit
  };

  export type RequestInit = MinipassFetchRequestInit & {
    cacheManager?: string | Cache;
    cache?:
      | "default"
      | "force-cache"
      | "no-cache"
      | "no-store"
      | "only-if-cached"
      | "reload";
    proxy?: string | URL;
    noProxy?: string | string[];
    ca?: ConnectionOptions["ca"];
    cert?: ConnectionOptions["cert"];
    key?: ConnectionOptions["key"];
    strictSSL?: ConnectionOptions["rejectUnauthorized"];
    localAddress?: ClientRequestArgs["localAddress"];
    maxSockets?: number;
    retry?: boolean | number | TimeoutsOptions;
    onRetry?: () => any;
    integrity?: string | Integrity;
  };

  export interface CachingFetch {
    (info: RequestInfo, init?: RequestInit): Promise<Response>;
    defaults(info: RequestInfo, init?: RequestInit): CachingFetch;
    defaults(init: RequestInit): CachingFetch;
  }

  const cachingFetch: CachingFetch;

  export default cachingFetch;

  export interface CacheDelete {
    (info: RequestInfo, options?: RequestInit): ReturnType<
      Cache["delete"]
    > | void;
  }

  const cacheDelete: CacheDelete;

  export { cacheDelete as delete };
}
