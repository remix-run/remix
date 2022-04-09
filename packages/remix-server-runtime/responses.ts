export const DEFERRED_PROMISE_VALUE = "$$__REMIX_DEFERRED_PROMISE__$$";

export class DeferredResponse {
  public __internal_name__ = "DeferredResponse";
  public data: any;
  public deferred: Record<string, Promise<unknown>>;
  public init: ResponseInit;

  constructor(data: unknown, init: number | ResponseInit) {
    let responseInit = typeof init === "number" ? { status: init } : init;

    let headers = new Headers(responseInit.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json; charset=utf-8");
    }

    this.init = responseInit;

    let deferred: Record<string, Promise<unknown>> = {};
    if (typeof data !== "object") {
      this.data = data;
    } else if (data) {
      let dataWithoutPromises: Record<string, any> = {};
      for (let [key, value] of Object.entries(data)) {
        if (value?.then && value?.catch) {
          deferred[key] = value.catch((err: any) => err);
          dataWithoutPromises[key] = DEFERRED_PROMISE_VALUE + key;
        } else {
          dataWithoutPromises[key] = value;
        }
      }

      this.data = dataWithoutPromises;
    }

    this.deferred = deferred;
  }
}

export function isDeferredResponse(value: any): value is DeferredResponse {
  return value && value.__internal_name__ === "DeferredResponse";
}

export type DeferredFunction = <Data>(
  data: Data,
  init?: number | ResponseInit
) => DeferredResponse;

export const deferred: DeferredFunction = (data, init = {}) => {
  return new DeferredResponse(data, init);
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

export function extractData(response: Response): Promise<unknown> {
  let contentType = response.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return response.json();
  }

  // What other data types do we need to handle here? What other kinds of
  // responses are people going to be returning from their loaders?
  // - application/x-www-form-urlencoded ?
  // - multipart/form-data ?
  // - binary (audio/video) ?

  return response.text();
}
