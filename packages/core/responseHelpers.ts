import { Response } from "./fetch";

export function json(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export function jsonError(error: string, status = 403) {
  return json({ error }, status);
}
