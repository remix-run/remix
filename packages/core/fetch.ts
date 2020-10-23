import type {
  HeadersInit,
  RequestInfo,
  RequestInit,
  ResponseInit
} from "make-fetch-happen";
import makeFetchHappen from "make-fetch-happen";
import {
  Headers as MinipassFetchHeaders,
  Request as MinipassFetchRequest,
  Response as MinipassFetchResponse,
  isRedirect
} from "minipass-fetch";

export type { HeadersInit, RequestInfo, RequestInit, ResponseInit };

/**
 * The headers in a Request or Response.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Headers
 */
export class Headers extends MinipassFetchHeaders {}

/**
 * A HTTP request.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Request
 */
export class Request extends MinipassFetchRequest {}

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

/**
 * A HTTP response.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Response
 */
export class Response extends MinipassFetchResponse {
  /**
   * Returns a redirect response.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Response/redirect
   */
  static redirect(url: string, status = 302): Response {
    if (!isRedirect(status)) {
      throw new RangeError(`Invalid HTTP redirect status code: ${status}`);
    }

    return new Response("", {
      status,
      headers: {
        location: url
      }
    });
  }
}

export function isResponseLike(object: any): object is Response {
  return (
    object &&
    typeof object.status === "number" &&
    typeof object.headers === "object" &&
    typeof object.body === "object" &&
    typeof object.bodyUsed === "boolean"
  );
}

/**
 * A `fetch` function for node.js.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch
 */
export const fetch = makeFetchHappen;
