import {
  AbortedDeferredError,
  UNSAFE_DeferredData as DeferredData,
} from "@remix-run/router";
import type { FormMethod as FormMethodRR } from "react-router-dom";

export type AppData = any;

export type FormMethod = FormMethodRR;

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

export function isDeferredResponse(response: any): boolean {
  return (
    response instanceof Response &&
    !!response.headers.get("Content-Type")?.match(/text\/remix-deferred/)
  );
}

export async function fetchData(
  request: Request,
  routeId: string
): Promise<Response | Error> {
  let url = new URL(request.url);
  url.searchParams.set("_data", routeId);

  let init: RequestInit = { signal: request.signal };

  if (request.method !== "GET") {
    init.method = request.method;

    let contentType = request.headers.get("Content-Type");
    init.body =
      // Check between word boundaries instead of startsWith() due to the last
      // paragraph of https://httpwg.org/specs/rfc9110.html#field.content-type
      contentType && /\bapplication\/x-www-form-urlencoded\b/.test(contentType)
        ? new URLSearchParams(await request.text())
        : await request.formData();
  }

  let response = await fetch(url.href, init);

  if (isErrorResponse(response)) {
    let data = await response.json();
    let error = new Error(data.message);
    error.stack = data.stack;
    return error;
  }

  return response;
}

const DEFERRED_VALUE_PLACEHOLDER_PREFIX = "__deferred_promise:";
export async function parseDeferredReadableStream(
  stream: ReadableStream<Uint8Array>
): Promise<DeferredData> {
  if (!stream) {
    throw new Error("parseDeferredReadableStream requires stream argument");
  }

  let deferredData: Record<string, Promise<unknown>> | undefined;
  let deferredResolvers: Record<
    string,
    { resolve: (data: unknown) => void; reject: (error: unknown) => void }
  > = {};

  try {
    let sectionReader = readStreamSections(stream);

    // Read the first section to get the critical data
    let initialSectionResult = await sectionReader.next();
    let initialSection = initialSectionResult.value;
    if (!initialSection) throw new Error("no critical data");
    let criticalData = JSON.parse(initialSection);

    // Setup deferred data and resolvers for later based on the critical data
    if (typeof criticalData === "object" && criticalData !== null) {
      for (let [eventKey, value] of Object.entries(criticalData)) {
        if (
          typeof value !== "string" ||
          !value.startsWith(DEFERRED_VALUE_PLACEHOLDER_PREFIX)
        ) {
          continue;
        }

        deferredData = deferredData || {};

        deferredData[eventKey] = new Promise<any>((resolve, reject) => {
          deferredResolvers[eventKey] = {
            resolve: (value: unknown) => {
              resolve(value);
              delete deferredResolvers[eventKey];
            },
            reject: (error: unknown) => {
              reject(error);
              delete deferredResolvers[eventKey];
            },
          };
        });
      }
    }

    // Read the rest of the stream and resolve deferred promises
    (async () => {
      try {
        for await (let section of sectionReader) {
          // Determine event type and data
          let [event, ...sectionDataStrings] = section.split(":");
          let sectionDataString = sectionDataStrings.join(":");
          let data = JSON.parse(sectionDataString);

          if (event === "data") {
            for (let [key, value] of Object.entries(data)) {
              if (deferredResolvers[key]) {
                deferredResolvers[key].resolve(value);
              }
            }
          } else if (event === "error") {
            for (let [key, value] of Object.entries(data) as Iterable<
              [string, { message: string; stack?: string }]
            >) {
              let err = new Error(value.message);
              err.stack = value.stack;
              if (deferredResolvers[key]) {
                deferredResolvers[key].reject(err);
              }
            }
          }
        }

        for (let [key, resolver] of Object.entries(deferredResolvers)) {
          resolver.reject(
            new AbortedDeferredError(`Deferred ${key} will never be resolved`)
          );
        }
      } catch (error) {
        // Reject any existing deferred promises if something blows up
        for (let resolver of Object.values(deferredResolvers)) {
          resolver.reject(error);
        }
      }
    })();

    return new DeferredData({ ...criticalData, ...deferredData });
  } catch (error) {
    for (let resolver of Object.values(deferredResolvers)) {
      resolver.reject(error);
    }

    throw error;
  }
}

async function* readStreamSections(stream: ReadableStream<Uint8Array>) {
  let reader = stream.getReader();

  let buffer: Uint8Array[] = [];
  let sections: string[] = [];
  let closed = false;
  let encoder = new TextEncoder();
  let decoder = new TextDecoder();

  let readStreamSection = async () => {
    if (sections.length > 0) return sections.shift();

    // Read from the stream until we have at least one complete section to process
    while (!closed && sections.length === 0) {
      let chunk = await reader.read();
      if (chunk.done) {
        closed = true;
        break;
      }
      // Buffer the raw chunks
      buffer.push(chunk.value);

      try {
        // Attempt to split off a section from the buffer
        let bufferedString = decoder.decode(mergeArrays(...buffer));
        let splitSections = bufferedString.split("\n\n");
        if (splitSections.length >= 2) {
          // We have a complete section, so add it to the sections array
          sections.push(...splitSections.slice(0, -1));
          // Remove the section from the buffer and store the rest for future processing
          buffer = [encoder.encode(splitSections.slice(-1).join("\n\n"))];
        }

        // If we successfully parsed at least one section, break out of reading the stream
        // to allow upstream processing of the processable sections
        if (sections.length > 0) {
          break;
        }
      } catch {
        // If we failed to parse the buffer it was because we failed to decode the stream
        // because we are missing bytes that we haven't yet received, so continue reading
        // from the stream until we have a complete section
        continue;
      }
    }

    // If we have a complete section, return it
    if (sections.length > 0) {
      return sections.shift();
    }

    // If we have no complete section, but we have no more chunks to process,
    // split those sections and clear out the buffer as there is no more data
    // to process. If this errors, let it bubble up as the stream ended
    // without valid data
    if (buffer.length > 0) {
      let bufferedString = decoder.decode(mergeArrays(...buffer));
      sections = bufferedString.split("\n\n").filter((s) => s);
      buffer = [];
    }

    // Return any remaining sections that have been processed
    return sections.shift();
  };

  let section = await readStreamSection();
  while (section) {
    yield section;
    section = await readStreamSection();
  }
}

function mergeArrays(...arrays: Uint8Array[]) {
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
