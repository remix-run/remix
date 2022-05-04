import type { Writable } from "stream";

export function pipeReadableStreamToWritable(
  stream: ReadableStream,
  writable: Writable
) {
  const reader = stream.getReader();

  async function read() {
    const { done, value } = await reader.read();
    if (done) {
      writable.end();
      return;
    }

    writable.write(value);
    read();
  }

  read();
}

export async function readableStreamToBase64String(stream: ReadableStream) {
  let reader = stream.getReader();
  let body = "";
  async function read() {
    let { done, value } = await reader.read();
    if (done) {
      return;
    } else if (value) {
      body += Buffer.from(value).toString("base64");
    }
    await read();
  }

  await read();

  return body;
}
