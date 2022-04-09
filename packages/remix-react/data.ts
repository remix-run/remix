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
      reject: (reason?: any) => void;
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
      Object.values(events).forEach(({ reject }) =>
        reject(new Error("Aborted"))
      );
    };
    abort.signal.addEventListener("abort", handleAbort);

    let gotEvents = false;
    let status = 200;
    await new Promise<void>(async (resolve) => {
      fetchEventSource(url.href, {
        credentials: "same-origin",
        signal: abort.signal,
        onerror: handleAbort,
        onopen: async (res) => {
          let { headers } = res;
          let contentType = headers.get("Content-Type");
          if (contentType && /\bapplication\/json\b/.test(contentType)) {
            response = new Response(await res.text(), {
              status: res.status,
              headers: {
                "Content-Type": contentType,
              },
            });
            abort.abort();
            resolve();
          } else {
            status = res.status;
          }
        },
        onmessage: (event) => {
          if (!gotEvents) {
            if (!event.data.includes("$$__REMIX_DEFERRED_EVENTS__$$")) {
              abort.abort();
              response = new Response(null, {
                status: 500,
                headers: {
                  "X-Remix-Error": "yes",
                },
              });
            }
            let eventKeys = event.data
              .split("$$__REMIX_DEFERRED_EVENTS__$$")[1]
              .split(",");

            totalEvents = eventKeys.length;

            for (let eventKey of eventKeys) {
              events[eventKey] = {} as any;
              events[eventKey].promise = new Promise((resolve, reject) => {
                events[eventKey].resolve = resolve;
                events[eventKey].reject = reject;
              });
            }
            gotEvents = true;
          }

          if (!event.data.includes("$$__REMIX_DEFERRED_KEY__$$")) {
            response = new Response(event.data, {
              status,
              headers: { "Content-Type": "application/json" },
            });
            resolve();
          } else {
            eventCount++;
            let [, eventKey, data] = event.data.split(
              "$$__REMIX_DEFERRED_KEY__$$"
            );
            events[eventKey].resolve(JSON.parse(data));

            if (totalEvents <= eventCount) {
              abort.abort();
            }
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
