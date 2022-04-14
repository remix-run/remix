import { fetchEventSource } from "@microsoft/fetch-event-source";

import invariant from "./invariant";
import type { Submission } from "./transition";

export type AppData = any;

export type FormMethod = "get" | "post" | "put" | "patch" | "delete";

export type FormEncType =
  | "application/x-www-form-urlencoded"
  | "multipart/form-data";

export function isCatchResponse(response: any): boolean {
  return (
    response instanceof Response &&
    response.headers.get("X-Remix-Catch") != null
  );
}

export function isErrorResponse(response: any): boolean {
  return (
    response instanceof Response &&
    response.headers.get("X-Remix-Error") != null
  );
}

export function isRedirectResponse(response: any): boolean {
  return (
    response instanceof Response &&
    response.headers.get("X-Remix-Redirect") != null
  );
}

export async function fetchData(
  url: URL,
  routeId: string,
  signal: AbortSignal,
  submission?: Submission
): Promise<[Response | Error, any]> {
  url.searchParams.set("_data", routeId);
  let response: Response;
  let events: {
    [key: string]: {
      promise: Promise<any>;
      resolve: (value?: any) => void;
    };
  } = {};
  let eventCount = 0;
  let totalEvents = 0;
  if (submission) {
    response = await fetch(url.href, getActionInit(submission, signal));
  } else {
    let abort = new AbortController();
    signal.addEventListener("abort", () => abort.abort());

    let handleAbort = () => {
      Object.values(events).forEach(({ resolve }) =>
        resolve(new Error("Aborted"))
      );
    };
    abort.signal.addEventListener("abort", handleAbort);

    let gotEvents = false;
    let status = 200;
    let headers: Headers;
    await new Promise<void>(async (resolve) => {
      await fetchEventSource(url.href, {
        credentials: "same-origin",
        signal: abort.signal,
        onerror: handleAbort,
        onopen: async (res) => {
          let contentType = res.headers.get("Content-Type");
          if (isRedirectResponse(res)) {
            response = new Response(null, {
              status: res.status,
              headers: res.headers,
            });
            abort.abort();
            resolve();
            return;
          }
          if (contentType && !/\btext\/event-stream\b/.test(contentType)) {
            response = new Response(await res.text(), {
              status: res.status,
              headers: res.headers,
            });
            abort.abort();
            resolve();
          } else {
            status = res.status;
            headers = new Headers(res.headers);
            headers.set("Content-Type", "application/json");
          }
        },
        onmessage: (event) => {
          if (event.data.includes("$$__REMIX_DEFERRED_KEY__$$")) {
            if (!gotEvents) {
              abort.abort();
              response = new Response(null, {
                status: 500,
                headers: {
                  "X-Remix-Error": "yes",
                },
              });
              return;
            }

            let [, eventKey, data] = event.data.split(
              "$$__REMIX_DEFERRED_KEY__$$"
            );
            events[eventKey].resolve(JSON.parse(data));

            eventCount++;
            if (totalEvents <= eventCount) {
              abort.abort();
            }
          } else if (event.data.includes("$$__REMIX_DEFERRED_ERROR__$$")) {
            let [, eventKey, data] = event.data.split(
              "$$__REMIX_DEFERRED_ERROR__$$"
            );
            let json = JSON.parse(data);
            let err = new Error(json.message);
            err.stack = json.stack;
            events[eventKey].resolve(err);

            eventCount++;
            if (totalEvents <= eventCount) {
              abort.abort();
            }
          } else {
            let data = JSON.parse(event.data);
            gotEvents = true;
            if (typeof data === "object") {
              let eventKeys = Object.values(data).reduce<string[]>(
                (keys, value) => {
                  if (
                    typeof value === "string" &&
                    value.startsWith("$$__REMIX_DEFERRED_PROMISE__$$")
                  ) {
                    keys.push(value.split("$$__REMIX_DEFERRED_PROMISE__$$")[1]);
                  }

                  return keys;
                },
                []
              );

              totalEvents = eventKeys.length;
              for (let eventKey of eventKeys) {
                events[eventKey] = {} as any;
                events[eventKey].promise = new Promise((resolve) => {
                  events[eventKey].resolve = resolve;
                });
              }
            }

            response = new Response(event.data, {
              status,
              headers,
            });
            resolve();
          }
        },
      });
    });
  }

  if (isErrorResponse(response!)) {
    let data = await response!.json();
    let error = new Error(data.message);
    error.stack = data.stack;
    return [error, undefined];
  }

  return [response!, events];
}

export async function extractData(response: Response): Promise<AppData> {
  // This same algorithm is used on the server to interpret load
  // results when we render the HTML page.
  let contentType = response.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return response.json();
  }

  return response.text();
}

function getActionInit(
  submission: Submission,
  signal: AbortSignal
): RequestInit {
  let { encType, method, formData } = submission;

  let headers = undefined;
  let body = formData;

  if (encType === "application/x-www-form-urlencoded") {
    body = new URLSearchParams();
    for (let [key, value] of formData) {
      invariant(
        typeof value === "string",
        `File inputs are not supported with encType "application/x-www-form-urlencoded", please use "multipart/form-data" instead.`
      );
      body.append(key, value);
    }
    headers = { "Content-Type": encType };
  }

  return {
    method,
    body,
    signal,
    credentials: "same-origin",
    headers,
  };
}
