import { Readable } from "stream";
import { STATUS_CODES } from "http";

import { matchAndLoadData } from "./match";
import { readConfig } from "./config";

export type HeadersInit = Record<string, string>;

/**
 * The headers in a HTTP request or response.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Headers
 */
export class Headers {
  private _map: Record<string, string>;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Headers/Headers
   */
  constructor(init: Headers | HeadersInit = {}) {
    this._map = {};

    if (init instanceof Headers) {
      for (let pair of init.entries()) {
        this.set(pair[0], pair[1]);
      }
    } else {
      for (let key in init) {
        this.set(key, init[key]);
      }
    }
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Headers/append
   */
  append(name: string, value: string): void {
    let lowerName = name.toLowerCase();
    if (this._map[lowerName]) {
      this._map[lowerName] += `,${value}`;
    } else {
      this._map[lowerName] = value;
    }
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Headers/delete
   */
  delete(name: string): void {
    delete this._map[name.toLowerCase()];
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Headers/entries
   */
  entries(): Iterable<string[]> {
    return Object.entries(this._map);
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Headers/get
   */
  get(name: string): string | null {
    let value = this._map[name.toLowerCase()];
    return value == null ? null : value;
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Headers/has
   */
  has(name: string): boolean {
    return name.toLowerCase() in this._map;
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Headers/keys
   */
  keys(): Iterable<string> {
    return Object.keys(this._map);
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Headers/set
   */
  set(name: string, value: string): void {
    this._map[name.toLowerCase()] = value;
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Headers/values
   */
  values(): Iterable<string> {
    return Object.values(this._map);
  }
}

/**
 * The body of a HTTP request or response.
 */
export type Body = string | Buffer | Readable;

/**
 * A HTTP message. The base class for Request and Response.
 */
export class Message {
  readonly body: Body;
  private _bodyUsed: boolean;

  constructor(body: Body = "") {
    this.body = body;

    if (body instanceof Readable) {
      this._bodyUsed = false;
      body.on("end", () => {
        this._bodyUsed = true;
      });
    } else {
      this._bodyUsed = true;
    }
  }

  get bodyUsed() {
    return this._bodyUsed;
  }
}

export enum RequestCache {
  Default = "default",
  NoStore = "no-store",
  Reload = "reload",
  NoCache = "no-cache",
  ForceCache = "force-cache",
  OnlyIfCached = "only-if-cached"
}

export enum RequestCredentials {
  Omit = "omit",
  SameOrigin = "same-origin",
  Include = "include"
}

export enum RequestDestination {
  Default = "",
  Audio = "audio",
  AudioWorklet = "audioworklet",
  Document = "document",
  Embed = "embed",
  Font = "font",
  Image = "image",
  Manifest = "manifest",
  Object = "object",
  PaintWorklet = "paintworklet",
  Report = "report",
  Script = "script",
  ServiceWorker = "serviceworker",
  SharedWorker = "sharedworker",
  Style = "style",
  Track = "track",
  Video = "video",
  Worker = "worker",
  Xslt = "xslt"
}

export enum RequestMode {
  SameOrigin = "same-origin",
  NoCors = "no-cors",
  Cors = "cors",
  Navigate = "navigate"
}

export enum RequestRedirect {
  Follow = "follow",
  Error = "error",
  Manual = "manual"
}

export interface RequestInit {
  body?: Body;
  cache?: RequestCache;
  credentials?: RequestCredentials;
  headers?: Headers | HeadersInit;
  integrity?: string;
  method?: string;
  mode?: RequestMode;
  redirect?: RequestRedirect;
  referrer?: string;
}

/**
 * A HTTP request.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Request
 */
export class Request extends Message {
  readonly cache: RequestCache;
  readonly credentials: RequestCredentials;
  readonly destination: RequestDestination;
  readonly headers: Headers;
  readonly integrity: string;
  readonly method: string;
  readonly mode: RequestMode;
  readonly redirect: RequestRedirect;
  readonly referrer: string;
  readonly referrerPolicy: string;
  readonly url: string;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Request/Request
   */
  constructor(input: string | Request, init: RequestInit = {}) {
    super(init.body);

    this.cache = init.cache || RequestCache.Default;
    this.credentials = init.credentials || RequestCredentials.SameOrigin;
    this.destination = RequestDestination.Default;

    if (input instanceof Request) {
      this.headers = new Headers(input.headers);
    } else {
      this.headers = new Headers(init.headers);
    }

    this.integrity = init.credentials || "";
    this.method = init.method || "GET";
    this.mode = init.mode || RequestMode.SameOrigin; // Default on web is "cors"
    this.redirect = init.redirect || RequestRedirect.Follow;
    this.referrer = init.referrer || ""; // Default on web is "about:client"
    this.referrerPolicy = "";

    if (input instanceof Request) {
      this.url = input.url;
    } else {
      this.url = input;
    }
  }
}

export enum ResponseType {
  Basic = "basic",
  Cors = "cors",
  Error = "error",
  Opaque = "opaque",
  OpaqueRedirect = "opaqueredirect"
}

export interface ResponseInit {
  status?: number;
  statusText?: string;
  headers?: Headers | HeadersInit;
}

/**
 * A HTTP response.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Response
 */
export class Response extends Message {
  readonly headers: Headers;
  readonly ok: boolean;
  readonly redirected: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly type: ResponseType;
  readonly url: string;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Response/Response
   */
  constructor(body?: Body, init: ResponseInit = {}) {
    super(body);

    let status = init.status || 200;

    if (!(status in STATUS_CODES)) {
      throw new Error(`Unknown HTTP status code: ${status}`);
    }

    this.headers = new Headers(init.headers);
    this.ok = status >= 200 && status < 300;
    this.redirected = status >= 300 && status < 400;
    this.status = status;
    this.statusText = init.statusText || (STATUS_CODES[status] as string);
    this.type = ResponseType.Basic;
    this.url = ""; // TODO
  }

  get trailers() {
    throw new Error(`response.trailers has not been implemented yet`);
  }

  get useFinalURL() {
    throw new Error(`response.useFinalURL has not been implemented yet`);
  }
}

export type LoadContext = any;

export interface RequestHandler {
  (request: Request, loadContext: LoadContext): Promise<Response>;
}

/**
 * Creates a HTTP request handler.
 */
export function createRequestHandler(remixRoot?: string): RequestHandler {
  let configPromise = readConfig(remixRoot);

  return async (req, loadContext) => {
    let config = await configPromise;
    let result = await matchAndLoadData(config, req, loadContext);

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  };
}
