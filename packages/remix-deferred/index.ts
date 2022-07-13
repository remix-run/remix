export const CONTENT_TYPE = "text/remix-deferred";
export const DEFERRED_VALUE_PLACEHOLDER_PREFIX = "__deferred_promise:";

export type Deferrable<T> = `__deferred_promise:${string}` | Promise<T>;
export type ResolvedDeferrable<T> = T extends null | undefined
  ? T
  : T extends Deferrable<infer T2>
  ? T2 extends PromiseLike<infer T3>
    ? T3
    : T2
  : T;

export interface DeferrableData {
  criticalData: unknown;
  deferredData?: Record<string, Promise<unknown>>;
}

export async function parseDeferredReadableStream(
  stream: ReadableStream<Uint8Array>
): Promise<DeferrableData> {
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

  return { criticalData, deferredData };
}

export function createDeferredReadableStream({
  criticalData,
  deferredData,
}: DeferrableData): ReadableStream<Uint8Array> {
  if (typeof criticalData === "undefined") {
    throw new Error(
      "createDeferredReadableStream requires criticalData to not be undefined"
    );
  }

  let encoder = new TextEncoder();

  let stream = new ReadableStream({
    async start(controller) {
      // Send the critical data
      controller.enqueue(encoder.encode(JSON.stringify(criticalData) + "\n\n"));

      if (deferredData) {
        // Watch all the deferred keys for resolution
        await Promise.all(
          Object.entries(deferredData).map(async ([key, promise]) => {
            await promise.then(
              (result) => {
                // Send the resolved data
                controller.enqueue(
                  encoder.encode(
                    "data:" + JSON.stringify({ [key]: result }) + "\n\n"
                  )
                );
              },
              async (error) => {
                // Send the error
                controller.enqueue(
                  encoder.encode(
                    "error:" +
                      JSON.stringify({ [key]: serializeError(error) }) +
                      "\n\n"
                  )
                );
              }
            );
          })
        );
      }

      controller.close();
    },
  });

  return stream;
}

export function getDeferrableData(data: unknown): DeferrableData {
  let criticalData = data;
  let deferredData: Record<string, Promise<unknown>> | undefined;
  if (typeof data === "object" && data !== null) {
    let isArrayData = Array.isArray(data);
    let dataWithoutPromises: Array<unknown> | Record<string | number, unknown> =
      isArrayData ? [] : {};

    for (let [key, value] of Object.entries(data)) {
      let dataKey = isArrayData ? Number(key) : (key as unknown as number);
      if (typeof value?.then === "function") {
        deferredData = deferredData || {};
        deferredData[key] = value;
        dataWithoutPromises[dataKey] = DEFERRED_VALUE_PLACEHOLDER_PREFIX + key;
      } else {
        dataWithoutPromises[dataKey] = value;
      }
    }

    criticalData = dataWithoutPromises;
  }
  return { criticalData, deferredData };
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

  let readStreamSection = async () => {
    if (sections.length > 0) return sections.shift();

    let encoder = new TextEncoder();
    let decoder = new TextDecoder();

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
        let splitSections = bufferedString.split("\n\n", 2);
        if (splitSections.length === 2) {
          // We have a complete section, so add it to the sections array
          sections.push(splitSections[0]);
          // Remove the section from the buffer and store the rest for future processing
          buffer = [encoder.encode(splitSections[1])];
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
      sections = bufferedString.split("\n\n");
      buffer = [];
    }

    // Return any remaining sections that have been processed
    return sections.shift();
  };

  for (
    let section = await readStreamSection();
    section;
    section = await readStreamSection()
  ) {
    yield section;
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
