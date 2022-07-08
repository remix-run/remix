import { serializeError } from "./errors";

const DEFERRED_PROMISE_PREFIX = "__deferred_promise:";

// eslint-disable-next-line
export type Deferrable<T> = never | T | Promise<T>;
export type ResolvedDeferrable<T> = T extends null | undefined
  ? T
  : T extends Deferrable<infer T2>
  ? T2 extends PromiseLike<infer T3>
    ? T3
    : T2
  : T;

export interface DeferredResponse extends Response {
  deferred: Record<string | number, Promise<unknown>>;
}

function createDeferredReadableStream(
  initialData: unknown,
  deferred: Record<string, Promise<unknown>>
) {
  let encoder = new TextEncoder();

  return new ReadableStream({
    // TODO: Figure out how to properly type this.
    async start(controller: any) {
      // Send the initial data
      controller.enqueue(encoder.encode(JSON.stringify(initialData) + "\n\n"));

      // Watch all the deferred keys for resolution
      await Promise.all(
        Object.entries(deferred).map(async ([key, promise]) => {
          await promise.then(
            (result) => {
              // Send the resolved data
              controller.enqueue(
                encoder.encode(
                  "data:" + JSON.stringify({ [key]: result }) + "\n\n"
                )
              );
            },
            async (error) => {
              // Send the error
              controller.enqueue(
                encoder.encode(
                  "error:" +
                    JSON.stringify({ [key]: await serializeError(error) }) +
                    "\n\n"
                )
              );
            }
          );
        })
      );

      controller.close();
    },
  });
}

function getDataForDeferred(data: unknown) {
  let deferred: Record<string, Promise<unknown>> = {};
  let initialData = data;
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    let dataWithoutPromises = {} as Record<string | number, unknown>;

    for (let [key, value] of Object.entries(data)) {
      if (typeof value?.then === "function") {
        deferred[key] = value;
        dataWithoutPromises[key] = DEFERRED_PROMISE_PREFIX + key;
      } else {
        dataWithoutPromises[key] = value;
      }
    }

    initialData = dataWithoutPromises;
  }
  return { initialData, deferred };
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
    headers.set("Content-Type", "text/remix-deferred; charset=utf-8");
  }

  class DeferredResponseImplementation extends Response {
    public deferred: Record<string | number, Promise<unknown>>;
    private initialData: unknown;

    constructor(data: unknown, init?: ResponseInit) {
      let { deferred, initialData } = getDataForDeferred(data);

      super(createDeferredReadableStream(initialData, deferred), init);

      this.deferred = deferred;
      this.initialData = initialData;
    }

    async json<T>(): Promise<T> {
      return this.initialData as T;
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
  return typeof (response as DeferredResponse).deferred === "object";
}

const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);
export function isRedirectResponse(response: Response): boolean {
  return redirectStatusCodes.has(response.status);
}

export function isCatchResponse(response: Response) {
  return response.headers.get("X-Remix-Catch") != null;
}
