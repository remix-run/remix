import {
  CONTENT_TYPE as DEFERRED_CONTENT_TYPE,
  createDeferredReadableStream,
  DeferredData,
} from "@remix-run/deferred";

// must be a type since this is a subtype of response
// interfaces must conform to the types they extend
export type TypedResponse<T extends unknown = unknown> = Response & {
  json(): Promise<T>;
};

export type DeferredResponse<T extends object = Record<string, unknown>> =
  TypedResponse<T> & {
    // allows discriminating between deferred and non-deferred responses
    __deferred?: never;
  };

export type DeferFunction = <Data extends object = Record<string, unknown>>(
  data: Data,
  init?: number | ResponseInit
) => DeferredResponse<Data>;

/**
 * This is a shortcut for creating `text/remix-deferred` responses. Converts `data`
 * to JSON for the initial payload, sends down subsequent chunks, and sets the
 * `Content-Type` header.
 *
 * NOTE: Deferred UX goals rely on streaming responses. Some popular hosts do
 * not support streaming responses. In general, any host built around AWS Lambda
 * does not support streaming and any bare metal / VM provider will. Make sure
 * your hosting platform supports before using this API. For more details,
 * checkout https://remix.run/docs/en/v1/guides/streaming.
 *
 * @see https://remix.run/api/remix#deferred
 */
export const defer: DeferFunction = (data, init = {}) => {
  let responseInit = typeof init === "number" ? { status: init } : init;

  let headers = new Headers(responseInit.headers);
  if (!headers.has("Content-Type")) {
    // We have opted to not use `text/event-stream` because it does not
    // support cache-control headers. Browsers force the cache to be `no-store`
    //
    // spec: https://html.spec.whatwg.org/multipage/server-sent-events.html
    headers.set("Content-Type", `${DEFERRED_CONTENT_TYPE}; charset=utf-8`);
  }

  return new Response(
    createDeferredReadableStream(
      new DeferredData(data as Record<string, unknown>)
    ),
    {
      ...responseInit,
      headers,
    }
  );
};

export type JsonFunction = <Data extends unknown>(
  data: Data,
  init?: number | ResponseInit
) => TypedResponse<Data>;

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

export function isDeferredResponse(response: Response): boolean {
  let contentType = response.headers.get("Content-Type");
  return !!contentType && /\btext\/remix-deferred\b/.test(contentType);
}

const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);
export function isRedirectResponse(response: Response): boolean {
  return redirectStatusCodes.has(response.status);
}

export function isCatchResponse(response: Response) {
  return response.headers.get("X-Remix-Catch") != null;
}
