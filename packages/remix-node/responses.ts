import {
  json as coreJson,
  redirect as coreRedirect
} from "@remix-run/server-runtime";

import type { Response, ResponseInit } from "./fetch";

export let json = (data: any, init: ResponseInit = {}) =>
  coreJson<Response, ResponseInit>(data, init);

export let redirect = (url: string, init: number | ResponseInit = 302) =>
  coreRedirect<Response, ResponseInit>(url, init);
