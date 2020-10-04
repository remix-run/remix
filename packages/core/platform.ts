import { Readable } from "stream";
import { STATUS_CODES } from "http";

/**
 * A map of HTTP status codes to their text descriptions.
 */
export const StatusCodes = STATUS_CODES;

export type HeadersInit = { [headerName: string]: string };

const map = Symbol("map");

/**
 * The headers in a Request or Response.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Headers
 */
export class Headers {
  private [map]: Map<string, string>;

  constructor(init: Headers | HeadersInit | undefined) {
    this[map] = new Map();

    if (init instanceof Headers) {
      for (let pair of init.entries()) {
        this.set(...pair);
      }
    } else if (init) {
      for (let key of Object.keys(init)) {
        this.set(key, init[key]);
      }
    }
  }

  append(name: string, value: string): void {
    let key = name.toLowerCase();
    if (this[map].has(key)) {
      this[map].set(key, this[map].get(key) + `,${value}`);
    } else {
      this[map].set(key, value);
    }
  }

  delete(name: string): void {
    this[map].delete(name.toLowerCase());
  }

  entries(): Iterable<[string, string]> {
    return this[map].entries();
  }

  get(name: string): string | null {
    return this[map].get(name.toLowerCase()) || null;
  }

  has(name: string): boolean {
    return this[map].has(name.toLowerCase());
  }

  keys(): Iterable<string> {
    return this[map].keys();
  }

  set(name: string, value: string): void {
    this[map].set(name.toLowerCase(), value);
  }

  values(): Iterable<string> {
    return this[map].values();
  }

  [Symbol.iterator]() {
    return this.entries();
  }

  forEach(
    callback: (this: any, [key, value]: [string, string]) => void,
    thisArg?: any
  ) {
    for (let pair of this.entries()) {
      callback.call(thisArg, pair);
    }
  }
}

/**
 * The body of a HTTP request or response.
 */
export type Body = Buffer | Readable;

/**
 * A HTTP message. The base class for Request and Response.
 *
 * The main difference between this and the fetch spec is the `body` property,
 * which may be either a Buffer (either provided directly in the constructor or
 * created from a string) or a Readable node stream. When backed by a Buffer,
 * the `bodyUsed` getter always returns `false`, allowing multiple uses.
 */
export class Message {
  readonly body: Body;

  constructor(body: Body | string = "") {
    this.body = typeof body === "string" ? Buffer.from(body) : body;
  }

  get bodyUsed() {
    return this.body instanceof Readable && this.body.readableEnded;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return Uint8Array.from(await this.buffer()).buffer;
  }

  async blob() {
    throw new Error(`blob() is not implemented; use arrayBuffer() instead`);
  }

  async buffer(): Promise<Buffer> {
    if (Buffer.isBuffer(this.body)) return this.body;
    if (this.bodyUsed) throw new Error(`body has already been used`);
    return bufferStream(this.body);
  }

  async formData() {
    throw new Error(`formData() is not implemented`);
  }

  async json(): Promise<any> {
    return JSON.parse(await this.buffer());
  }

  async text(): Promise<string> {
    return (await this.buffer()).toString("utf-8");
  }
}

async function bufferStream(stream: Readable): Promise<Buffer> {
  return new Promise((accept, reject) => {
    let chunks: Buffer[] = [];
    stream
      .on("error", reject)
      .on("data", chunk => chunks.push(chunk))
      .on("end", () => accept(Buffer.concat(chunks)));
  });
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
  body?: Body | string;
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
  static clone() {
    throw new Error(`Request.clone() is not implemented`);
  }

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

  constructor(input: any, init: RequestInit = {}) {
    super(init.body);

    this.cache = init.cache || RequestCache.Default;
    this.credentials = init.credentials || RequestCredentials.SameOrigin;
    this.destination = RequestDestination.Default;

    if (input instanceof Request) {
      this.headers = new Headers(input.headers);
    } else {
      this.headers = new Headers(init.headers);
    }

    this.integrity = init.integrity || "";
    this.method = init.method || "GET";
    this.mode = init.mode || RequestMode.SameOrigin; // Default on web is "cors"
    this.redirect = init.redirect || RequestRedirect.Follow;
    this.referrer = init.referrer || ""; // Default on web is "about:client"
    this.referrerPolicy = "";

    this.url =
      typeof input === "string"
        ? input
        : input && typeof input.url === "string"
        ? input.url
        : String(input);
  }
}

/**
 * Returns `true` if the given object is a `Request`, or has a similar API.
 */
export function isRequestLike(object: any): object is Request {
  return (
    object &&
    typeof object.method === "string" &&
    typeof object.url === "string" &&
    typeof object.headers === "object" &&
    typeof object.body === "object" &&
    typeof object.bodyUsed === "boolean"
  );
}

export enum ResponseType {
  Basic = "basic",
  Cors = "cors",
  Default = "default",
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
  static clone() {
    throw new Error(`Response.clone() is not implemented`);
  }

  static error() {
    throw new Error(`Response.error() is not implemented`);
  }

  /**
   * Creates a redirect response to the given URL. Defaults to a temporary
   * redirect (302).
   */
  static redirect(url: string, status = 302): Response {
    if (!isRedirectStatusCode(status)) {
      throw new RangeError(`Invalid HTTP redirect status code: ${status}`);
    }

    return new Response("", {
      status,
      headers: {
        location: url
      }
    });
  }

  readonly headers: Headers;
  readonly ok: boolean;
  readonly redirected: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly type: ResponseType;
  readonly url: string;

  constructor(body?: Body | string, init: ResponseInit = {}) {
    super(body);

    let status = init.status || 200;

    if (!(status in StatusCodes)) {
      throw new Error(`Invalid HTTP status code: ${status}`);
    }

    let headers = new Headers(init.headers);

    if (!headers.has("content-type")) {
      headers.set("content-type", "text/plain;charset=UTF-8");
    }

    this.headers = headers;
    this.ok = status >= 200 && status < 300;
    this.redirected = status >= 300 && status < 400;
    this.status = status;
    this.statusText = init.statusText || (StatusCodes[status] as string);
    this.type = ResponseType.Default;
    this.url = "";
  }

  get trailers() {
    throw new Error(`response.trailers is not implemented`);
  }

  get useFinalURL() {
    throw new Error(`response.useFinalURL is not implemented`);
  }
}

/**
 * Returns `true` if the given object is a `Response`, or has a similar API.
 */
export function isResponseLike(object: any): object is Response {
  // I'm being intentionally vague here because we don't know what fetch
  // libraries people will be using in node. There's `node-fetch` but there's
  // also `minipass-fetch` which is used in `make-fetch-happen`. So we do a
  // rough duck-test here to see if it's similar to the web's `Response` API. If
  // so, we'll just assume we can use that.
  return (
    object &&
    typeof object.status === "number" &&
    typeof object.headers === "object" &&
    typeof object.body === "object" &&
    typeof object.bodyUsed === "boolean"
  );
}

/**
 * Returns `true` if the given status code indicates a redirect.
 *
 * @see https://fetch.spec.whatwg.org/#redirect-status
 */
export function isRedirectStatusCode(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}
