declare module "make-fetch-happen" {
  import type { URL } from "url";
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

  // From the make-fetch-happen README:
  // If an object is provided, it will be assumed to be a compliant Cache
  // instance. Only Cache.match(), Cache.put(), and Cache.delete() are
  // required. Options objects will not be passed in to match() or delete().
  export interface Cache {
    match(request: Request): Promise<Response>;
    put(request: Request, response: Response): Promise<void>;
    delete(request: Request): Promise<boolean>;
  }

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
