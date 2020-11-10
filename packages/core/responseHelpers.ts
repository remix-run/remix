import type { ResponseInit } from "./fetch";
import { Response } from "./fetch";

export function json(data: any, init: ResponseInit = {}) {
  // TODO: Revisit types here after moving back to custom fetch classes...
  // @ts-ignore
  let headers = new Headers(init.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  // TODO: Revisit types here after moving back to custom fetch classes...
  // @ts-ignore
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function jsonError(error: string, status = 403) {
  return json({ error }, { status });
}
