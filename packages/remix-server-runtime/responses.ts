import { serializeError } from "./errors";

export const DEFERRED_PROMISE_VALUE = "$$__REMIX_DEFERRED_PROMISE__$$";
export const DEFERRED_CHUNK_SEPARATOR = "$$__REMIX_DEFERRED_PROMISE__$$";

export type DeferredResponse = Response & {
  deferred: Record<string, Promise<unknown>>;
  initialData: unknown;
};

export function isDeferredResponse(value: any): value is DeferredResponse {
  return (
    isResponse(value) &&
    typeof (value as DeferredResponse).deferred !== "undefined"
  );
}

export type DeferredFunction = <Data>(
  data: Data,
  init?: number | ResponseInit
) => Response;

export const deferred: DeferredFunction = (data, init = {}) => {
  class DeferredResponse extends Response {
    public deferred: Record<string, Promise<unknown>>;
    public initialData: unknown;

    constructor(data: unknown, init?: ResponseInit) {
      let deferred: Record<string, Promise<unknown>> = {};
      let initialData = data;
      if (typeof data === "object" && data !== null) {
        let dataWithoutPromises = {} as Record<string, unknown>;

        for (let [key, value] of Object.entries(data)) {
          if (typeof value?.then === "function") {
            deferred[key] = value;
            dataWithoutPromises[key] = DEFERRED_PROMISE_VALUE + key;
          } else {
            dataWithoutPromises[key] = value;
          }
        }

        initialData = dataWithoutPromises;
      }

      let encoder = new TextEncoder();
      let body = new ReadableStream({
        async start(controller: any) {
          controller.enqueue(
            encoder.encode(JSON.stringify(initialData) + "\n\n")
          );

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

      super(body, init);

      this.initialData = initialData;
      this.deferred = deferred;
    }
  }

  let responseInit = typeof init === "number" ? { status: init } : init;

  let headers = new Headers(responseInit.headers);
  if (!headers.has("Connection")) {
    headers.set("Connection", "keep-alive");
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "text/remix-deferred");
  }

  return new DeferredResponse(data, {
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

const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);
export function isRedirectResponse(response: Response): boolean {
  return redirectStatusCodes.has(response.status);
}

export function isCatchResponse(response: Response) {
  return response.headers.get("X-Remix-Catch") != null;
}
