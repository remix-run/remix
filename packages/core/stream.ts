import type { Readable } from "stream";

export async function bufferStream(stream: Readable): Promise<Buffer> {
  return new Promise((accept, reject) => {
    let chunks: Buffer[] = [];
    stream
      .on("error", reject)
      .on("data", chunk => chunks.push(chunk))
      .on("end", () => accept(Buffer.concat(chunks)));
  });
}

export function drainStream(stream: Readable) {
  return new Promise(accept => {
    stream
      .on("data", () => {})
      .on("end", () => {
        accept();
      });
  });
}
