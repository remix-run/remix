import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RangeStream } from "./range-stream.js";

function createStream(
  content: string,
  chunkSize = 2
): ReadableStream<Uint8Array> {
  let buffer = new TextEncoder().encode(content);
  return new ReadableStream({
    start(controller) {
      let offset = 0;
      while (offset < buffer.byteLength) {
        controller.enqueue(buffer.slice(offset, offset + chunkSize));
        offset += chunkSize;
      }

      controller.close();
    }
  });
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  let decoder = new TextDecoder();

  let result = "";
  for await (let chunk of stream) {
    result += decoder.decode(chunk, { stream: true });
  }
  result += decoder.decode();

  return result;
}

describe("RangeStream", () => {
  it("passes all bytes through if no range is specified", async () => {
    let stream = createStream("hello world").pipeThrough(new RangeStream());
    let result = await readStream(stream);
    assert.equal(result, "hello world");
  });

  it("filters out bytes that are outside of the specified range", async () => {
    let stream = createStream("hello world").pipeThrough(new RangeStream(1, 9));
    let result = await readStream(stream);
    assert.equal(result, "ello wor");
  });

  it("filters out bytes that are before the start index", async () => {
    let stream = createStream("hello world").pipeThrough(new RangeStream(6));
    let result = await readStream(stream);
    assert.equal(result, "world");
  });

  it("filters out bytes that are after the end index", async () => {
    let stream = createStream("hello world").pipeThrough(new RangeStream(0, 5));
    let result = await readStream(stream);
    assert.equal(result, "hello");
  });

  it('throws a "RangeError" if the end index is less than the start index', () => {
    assert.throws(() => new RangeStream(5, 3), {
      name: "RangeError",
      message: "The end index must be greater than or equal to the start index"
    });
  });
});
