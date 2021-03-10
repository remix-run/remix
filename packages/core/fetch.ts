import type { Response } from "node-fetch";

export type {
  HeadersInit,
  RequestInfo,
  RequestInit,
  ResponseInit
} from "node-fetch";

export { Headers, Request, Response, default as fetch } from "node-fetch";

export function isResponse(value: any): value is Response {
  return (
    value != null &&
    typeof value.status === "number" &&
    typeof value.statusText === "string" &&
    typeof value.headers === "object" &&
    typeof value.body !== "undefined"
  );
}
