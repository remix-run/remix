import { Readable } from "stream";
import { STATUS_CODES } from "http";

export { STATUS_CODES as StatusCodes };

export type HeadersInit = { [headerName: string]: string };

/**
 * The headers in a Request or Response.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Headers
 */
export class Headers {
  private _map: { [headerName: string]: string };

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

  append(name: string, value: string): void {
    let lowerName = name.toLowerCase();
    if (this._map[lowerName]) {
      this._map[lowerName] += `,${value}`;
    } else {
      this._map[lowerName] = value;
    }
  }

  delete(name: string): void {
    delete this._map[name.toLowerCase()];
  }

  entries(): Iterable<string[]> {
    return Object.entries(this._map);
  }

  get(name: string): string | null {
    let value = this._map[name.toLowerCase()];
    return value == null ? null : value;
  }

  has(name: string): boolean {
    return name.toLowerCase() in this._map;
  }

  keys(): Iterable<string> {
    return Object.keys(this._map);
  }

  set(name: string, value: string): void {
    this._map[name.toLowerCase()] = value;
  }

  values(): Iterable<string> {
    return Object.values(this._map);
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
    throw new Error(`blob() is not yet implemented; use arrayBuffer() instead`);
  }

  async buffer(): Promise<Buffer> {
    if (Buffer.isBuffer(this.body)) return this.body;
    if (this.bodyUsed) throw new Error(`body has already been used`);
    return bufferStream(this.body);
  }

  async formData() {
    throw new Error(`formData() is not yet implemented`);
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
    throw new Error(`Request.clone() is not yet implemented`);
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
    throw new Error(`Response.clone() is not yet implemented`);
  }

  static error() {
    throw new Error(`Response.error() is not yet implemented`);
  }

  static redirect(url: string, status = 302): Response {
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

    if (!(status in STATUS_CODES)) {
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
    this.statusText = init.statusText || (STATUS_CODES[status] as string);
    this.type = ResponseType.Default;
    this.url = "";
  }

  get trailers() {
    throw new Error(`response.trailers is not yet implemented`);
  }

  get useFinalURL() {
    throw new Error(`response.useFinalURL is not yet implemented`);
  }
}

/**
 * May be used in a loader to trigger a HTTP redirect.
 */
export class Redirect {
  readonly location: string;
  readonly permanent: boolean;
  constructor(location: string, permanent = false) {
    this.location = location;
    this.permanent = permanent;
  }
}

/**
 * Shorthand for creating a `new Redirect`.
 */
export function redirect(location: string, permanent?: boolean): Redirect {
  return new Redirect(location, permanent);
}

/**
 * May be used in a loader to change the HTTP status code in the response.
 */
export class StatusCode {
  readonly status: number;
  constructor(status: number) {
    this.status = status;
  }
}

/**
 * Shorthand for creating a `new StatusCode`.
 */
export function statusCode(httpStatus: number): StatusCode {
  return new StatusCode(httpStatus);
}

/**
 * May be returned from a loader to return a 404.
 */
export class NotFound extends StatusCode {
  readonly detail?: any;
  constructor(detail?: any) {
    super(404);
    this.detail = detail;
  }
}

/**
 * Shorthand for creating a `new NotFound`.
 */
export function notFound(detail?: any): NotFound {
  return new NotFound(detail);
}
