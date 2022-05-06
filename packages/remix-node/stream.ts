import type { Writable } from "stream";

export async function pipeReadableStreamToWritable(
  stream: ReadableStream,
  writable: Writable
) {
  let reader = stream.getReader();

  async function read() {
    let { done, value } = await reader.read();

    if (done) {
      writable.end();
      return;
    }

    writable.write(value);

    await read();
  }

  await read();
}

export async function readableStreamToBase64String(stream: ReadableStream) {
  let reader = stream.getReader();
  let chunks: Uint8Array[] = [];

  async function read() {
    let { done, value } = await reader.read();

    if (done) {
      return;
    } else if (value) {
      chunks.push(value);
    }

    await read();
  }

  await read();

  return Buffer.concat(chunks).toString("base64");
}
