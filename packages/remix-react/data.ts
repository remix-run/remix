import type { SerializedError } from "./errors";
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
      resolved?: boolean;
    };
  } = {};
  if (submission) {
    response = await fetch(url.href, getActionInit(submission, signal));
  } else {
    let ogResponse = await fetch(url.href, {
      credentials: "same-origin",
      signal,
    });

    response = ogResponse;
    if (
      !isRedirectResponse(ogResponse) &&
      ogResponse.body &&
      ogResponse.headers.get("Content-Type")?.includes("text/remix-deferred")
    ) {
      response = await new Promise<Response>(async (resolve, reject) => {
        let reader = ogResponse.body!.getReader();
        let chunks: Uint8Array[] = [];
        let gotInitialData = false;
        let decoder = new TextDecoder();
        for (
          let chunk = await reader.read();
          !chunk.done;
          chunk = await reader.read()
        ) {
          chunks.push(chunk.value);

          let buffered = decoder.decode(mergeArrays(...chunks));
          let split = buffered.split("\n\n");
          if (split.length <= 1) {
            continue;
          }
          chunks = [];

          for (
            let dataString = split.shift();
            typeof dataString !== "undefined";
            dataString = split.shift()
          ) {
            if (!dataString) continue;

            if (!gotInitialData) {
              let data = JSON.parse(dataString);
              gotInitialData = true;
              if (typeof data === "object" && data !== null) {
                for (let [eventKey, value] of Object.entries(data)) {
                  if (
                    typeof value !== "string" ||
                    !value.startsWith("$$__REMIX_DEFERRED_PROMISE__")
                  ) {
                    continue;
                  }

                  events[eventKey] = {} as any;
                  events[eventKey].promise = new Promise<any>((resolve) => {
                    events[eventKey].resolve = (v: any) => {
                      events[eventKey].resolved = true;
                      resolve(v);
                    };
                  });
                }
              }

              let headers = new Headers(ogResponse.headers);
              headers.set("Content-Type", "application/json");
              resolve(
                new Response(dataString, {
                  headers,
                  status: ogResponse.status,
                  statusText: ogResponse.statusText,
                })
              );
              continue;
            }

            let [event, ...eventDataChunks] = dataString.split(":");
            let eventDataString = eventDataChunks.join(":");

            let data = JSON.parse(eventDataString);
            if (event === "data") {
              for (let [key, value] of Object.entries(data)) {
                if (events[key] && !events[key].resolved) {
                  events[key].resolve(value);
                }
              }
            } else if (event === "error") {
              for (let [key, value] of Object.entries(data) as Iterable<
                [string, SerializedError]
              >) {
                let err = new Error(value.message);
                err.stack = value.stack;
                if (events[key] && !events[key].resolved) {
                  events[key].resolve(err);
                }
              }
            }
          }
        }

        if (!gotInitialData) {
          resolve(ogResponse);
        }

        // TODO: Reject running events if we didn't see all of them
      });
    }
  }

  if (isErrorResponse(response!)) {
    let data = await response!.json();
    let error = new Error(data.message);
    error.stack = data.stack;
    return [error, undefined];
  }

  return [response!, events];
}

export function mergeArrays(...arrays: Uint8Array[]) {
  let out = new Uint8Array(
    arrays.reduce((total, arr) => total + arr.length, 0)
  );
  let offset = 0;
  for (let arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
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
