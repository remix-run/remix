import {
  CONTENT_TYPE as DEFERRED_CONTENT_TYPE,
  createDeferredReadableStream,
  getDeferrableData,
} from "@remix-run/deferred";

export interface DeferredResponse extends Response {
  deferredData?: Record<string | number, Promise<unknown>>;
}

export type DeferredFunction = <Data>(
  data: Data,
  init?: number | ResponseInit
) => DeferredResponse;

/**
 * This is a shortcut for creating `text/remix-deferred` responses. Converts `data`
 * to JSON for the initial payload, sends down subsequent chunks, and sets the
 * `Content-Type` header.
 *
 * @see https://remix.run/api/remix#deferred
 */
export const deferred: DeferredFunction = (data, init = {}) => {
  let responseInit = typeof init === "number" ? { status: init } : init;

  let headers = new Headers(responseInit.headers);
  if (!headers.has("Content-Type")) {
    // We have opted to not use `text/event-stream` because it does not
    // support cache-control headers. Browsers force the cache to be `no-store`
    //
    // spec: https://html.spec.whatwg.org/multipage/server-sent-events.html
    headers.set("Content-Type", `${DEFERRED_CONTENT_TYPE}; charset=utf-8`);
  }

  class DeferredResponseImplementation extends Response {
    public deferredData?: Record<string | number, Promise<unknown>>;
    private criticalData: unknown;

    constructor(data: unknown, init?: ResponseInit) {
      let deferrableData = getDeferrableData(data);

      super(createDeferredReadableStream(deferrableData), init);

      this.deferredData = deferrableData.deferredData;
      this.criticalData = deferrableData.criticalData;
    }

    async json<T>(): Promise<T> {
      return this.criticalData as T;
    }
  }

  return new DeferredResponseImplementation(data, {
    ...responseInit,
    headers,
  });
};

export type JsonFunction = <Data extends unknown>(
  data: Data,
  init?: number | ResponseInit
) => TypedResponse<Data>;

// must be a type since this is a subtype of response
// interfaces must conform to the types they extend
export type TypedResponse<T extends unknown = unknown> = Response & {
  json(): Promise<T>;
};

/**
 * This is a shortcut for creating `application/json` responses. Converts `data`
 * to JSON and sets the `Content-Type` header.
 *
 * @see https://remix.run/api/remix#json
 */
export const json: JsonFunction = (data, init = {}) => {
  let responseInit = typeof init === "number" ? { status: init } : init;

  let headers = new Headers(responseInit.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(data), {
    ...responseInit,
    headers,
  });
};

export type RedirectFunction = (
  url: string,
  init?: number | ResponseInit
) => TypedResponse<never>;

/**
 * A redirect response. Sets the status code and the `Location` header.
 * Defaults to "302 Found".
 *
 * @see https://remix.run/api/remix#redirect
 */
export const redirect: RedirectFunction = (url, init = 302) => {
  let responseInit = init;
  if (typeof responseInit === "number") {
    responseInit = { status: responseInit };
  } else if (typeof responseInit.status === "undefined") {
    responseInit.status = 302;
  }

  let headers = new Headers(responseInit.headers);
  headers.set("Location", url);

  return new Response(null, {
    ...responseInit,
    headers,
  }) as TypedResponse<never>;
};

export function isResponse(value: any): value is Response {
  return (
    value != null &&
    typeof value.status === "number" &&
    typeof value.statusText === "string" &&
    typeof value.headers === "object" &&
    typeof value.body !== "undefined"
  );
}

export function isDeferredResponse(
  response: Response
): response is DeferredResponse {
  return "deferredData" in response;
}

const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);
export function isRedirectResponse(response: Response): boolean {
  return redirectStatusCodes.has(response.status);
}

export function isCatchResponse(response: Response) {
  return response.headers.get("X-Remix-Catch") != null;
}
