import type {
  HeadersInit,
  RequestInfo,
  RequestInit,
  ResponseInit
} from "node-fetch";
import fetch, { Headers, Request, Response } from "node-fetch";

export type { HeadersInit, RequestInfo, RequestInit, ResponseInit };
export { Request, Response, Headers, fetch };

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

export function isResponseLike(object: any): object is Response {
  return (
    object &&
    typeof object.status === "number" &&
    typeof object.headers === "object" &&
    typeof object.body === "object" &&
    typeof object.bodyUsed === "boolean"
  );
}
