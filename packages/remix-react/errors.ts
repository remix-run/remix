import type { Router as RemixRouter } from "@remix-run/router";
import { ErrorResponse } from "@remix-run/router";

export interface ThrownResponse {
  status: number;
  statusText: string;
  data: unknown;
}

export function deserializeErrors(
  errors: RemixRouter["state"]["errors"]
): RemixRouter["state"]["errors"] {
  if (!errors) return null;
  let entries = Object.entries(errors);
  let serialized: RemixRouter["state"]["errors"] = {};
  for (let [key, val] of entries) {
    // Hey you!  If you change this, please change the corresponding logic in
    // serializeErrors in remix-server-runtime/errors.ts :)
    if (val && val.__type === "RouteErrorResponse") {
      serialized[key] = new ErrorResponse(
        val.status,
        val.statusText,
        val.data,
        val.internal === true
      );
    } else if (val && val.__type === "Error") {
      let error = new Error(val.message);
      error.stack = val.stack;
      serialized[key] = error;
    } else {
      serialized[key] = val;
    }
  }
  return serialized;
}
