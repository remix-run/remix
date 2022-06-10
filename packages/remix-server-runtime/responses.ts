import { serializeError } from "./errors";

const deferredPromisePrefix = "__deferred_promise:";

export type Deferrable<Data> = {};
export type ResolvedDeferrable<Deferred extends Deferrable<any>> =
  Deferred extends Deferrable<infer Data> ? Data : never;

export interface DeferredResponse<Data = unknown> extends Response {
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

      await Promise.all(
        Object.entries(deferred).map(async ([key, promise]) => {
          await promise.then(
            (result) => {
              controller.enqueue(
                encoder.encode(
                  "data:" + JSON.stringify({ [key]: result }) + "\n\n"
                )
              );
            },
            async (error) => {
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
  if (typeof data === "object" && data !== null) {
    let dataWithoutPromises = {} as Record<string | number, unknown>;

    for (let [key, value] of Object.entries(data)) {
      if (typeof value?.then === "function") {
        deferred[key] = value;
        dataWithoutPromises[key] = deferredPromisePrefix + key;
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
) => DeferredResponse<Data>;

/**
 * This is a shortcut for creating `application/json` responses. Converts `data`
 * to JSON and sets the `Content-Type` header.
 *
 * @see https://remix.run/api/remix#json
 */
export const deferred: DeferredFunction = (data, init = {}) => {
  let responseInit = typeof init === "number" ? { status: init } : init;

  let headers = new Headers(responseInit.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  class DeferredResponseImplementation<Data = unknown> extends Response {
    public deferred: Record<string | number, Promise<unknown>>;
    private initialData: unknown;

    constructor(data: Data, init?: ResponseInit) {
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

export type JsonFunction = <Data>(
  data: Data,
  init?: number | ResponseInit
) => Response;

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
) => Response;

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
  });
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
