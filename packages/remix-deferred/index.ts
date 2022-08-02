export const CONTENT_TYPE = "text/remix-deferred";
export const DEFERRED_VALUE_PLACEHOLDER_PREFIX = "__deferred_promise:";

export interface TrackedPromise extends Promise<unknown> {
  _tracked?: boolean;
  _data?: any;
  _error?: any;
}

export class DeferredData {
  private pendingKeys: Set<string | number> = new Set<string | number>();
  private cancelled: boolean = false;
  private subscribers: Set<(aborted: boolean, settledKey?: string) => void> =
    new Set();
  data: Record<string, unknown>;
  deferredKeys: string[];

  constructor(data: Record<string, unknown>) {
    invariant(
      data && typeof data === "object" && !Array.isArray(data),
      "DeferredData only accepts plain objects"
    );
    let deferredKeys: string[] = [];
    this.data = Object.entries(data).reduce((acc, [key, value]) => {
      let trackedValue = this.trackPromise(key, value);
      if (isTrackedPromise(trackedValue)) {
        deferredKeys.push(key);
      }
      return Object.assign(acc, {
        [key]: trackedValue,
      });
    }, {});
    this.deferredKeys = deferredKeys;
  }

  private trackPromise(
    key: string,
    value: Promise<unknown> | unknown
  ): TrackedPromise | unknown {
    if (!(value instanceof Promise)) {
      return value;
    }

    this.pendingKeys.add(key);

    // We store a little wrapper promise that will be extended with
    // _data/_error props upon resolve/reject
    let promise: TrackedPromise = value.then(
      (data) => this.onSettle(promise, key, null, data as unknown),
      (error) => this.onSettle(promise, key, error as unknown)
    );
    Object.defineProperty(promise, "_tracked", { get: () => true });
    return promise;
  }

  private onSettle(
    promise: TrackedPromise,
    key: string,
    error: unknown,
    data?: unknown
  ): void {
    if (this.cancelled) {
      return;
    }
    this.pendingKeys.delete(key);

    if (error) {
      Object.defineProperty(promise, "_error", { get: () => error });
    } else {
      Object.defineProperty(promise, "_data", { get: () => data });
    }

    for (let subscriber of this.subscribers) {
      subscriber(false, key);
    }
  }

  subscribe(fn: (aborted: boolean, settledKey?: string) => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  cancel() {
    this.cancelled = true;
    this.pendingKeys.forEach((v, k) => this.pendingKeys.delete(k));
    for (let subscriber of this.subscribers) {
      subscriber(true);
    }
  }

  async resolveData(signal: AbortSignal) {
    let aborted = false;
    if (!this.done) {
      let onAbort = () => this.cancel();
      signal.addEventListener("abort", onAbort);
      aborted = await new Promise((resolve) => {
        this.subscribe((aborted) => {
          signal.removeEventListener("abort", onAbort);
          if (aborted || this.done) {
            resolve(aborted);
          }
        });
      });
    }
    return aborted;
  }

  get done() {
    return this.pendingKeys.size === 0;
  }

  get unwrappedData() {
    invariant(
      this.data !== null && this.done,
      "Can only unwrap data on initialized and settled deferreds"
    );

    return Object.entries(this.data).reduce(
      (acc, [key, value]) =>
        Object.assign(acc, {
          [key]: unwrapTrackedPromise(value),
        }),
      {}
    );
  }

  get criticalData() {
    invariant(
      this.data !== null,
      "Can only get critical data on initialized deferreds"
    );

    return Object.entries(this.data).reduce(
      (acc, [key, value]) =>
        Object.assign(acc, {
          [key]: isTrackedPromise(value)
            ? DEFERRED_VALUE_PLACEHOLDER_PREFIX + key
            : value,
        }),
      {}
    );
  }
}

function isTrackedPromise(value: any): value is TrackedPromise {
  return (
    value instanceof Promise && (value as TrackedPromise)._tracked === true
  );
}

function unwrapTrackedPromise(value: any) {
  if (!isTrackedPromise(value)) {
    return value;
  }

  if (value._error) {
    throw value._error;
  }
  return value._data;
}

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
            [string, SerializedError]
          >) {
            let err = new Error(value.message);
            err.stack = value.stack;
            if (deferredResolvers[key]) {
              deferredResolvers[key].reject(err);
            }
          }
        }
      }
    } catch (error) {
      // Reject any existing deferred promises if something blows up
      for (let resolver of Object.values(deferredResolvers)) {
        resolver.reject(error);
      }
    }
  })();

  return new DeferredData({ ...criticalData, ...deferredData });
}

export function createDeferredReadableStream(
  deferredData: DeferredData
): ReadableStream<Uint8Array> {
  let criticalData = deferredData.criticalData;

  let encoder = new TextEncoder();
  let stream = new ReadableStream({
    async start(controller) {
      // Send the critical data
      controller.enqueue(encoder.encode(JSON.stringify(criticalData) + "\n\n"));

      let unsubscribe = deferredData.subscribe((aborted, settledKey) => {
        if (settledKey) {
          let promise = deferredData.data[settledKey] as TrackedPromise;
          if ("_error" in promise) {
            controller.enqueue(
              encoder.encode(
                "error:" +
                  JSON.stringify({
                    [settledKey]: serializeError(promise._error),
                  }) +
                  "\n\n"
              )
            );
          } else {
            controller.enqueue(
              encoder.encode(
                "data:" +
                  JSON.stringify({ [settledKey]: promise._data ?? null }) +
                  "\n\n"
              )
            );
          }
        }
      });
      await deferredData.resolveData(new AbortController().signal);
      unsubscribe();
      controller.close();
    },
  });

  return stream;
}

// must be type alias due to inference issues on interfaces
// https://github.com/microsoft/TypeScript/issues/15300
type SerializedError = {
  message: string;
  stack?: string;
};

function serializeError(error: Error): SerializedError {
  return {
    message: error.message,
    stack: error.stack,
  };
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

function invariant(value: boolean, message?: string): asserts value;
function invariant<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T;
function invariant(value: any, message?: string) {
  if (value === false || value === null || typeof value === "undefined") {
    throw new Error(message);
  }
}
