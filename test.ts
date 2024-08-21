import * as fs from "node:fs";

function readFile(
  file: string,
  start?: number,
  end = Infinity
): ReadableStream<Uint8Array> {
  let read = fs.createReadStream(file, { start, end: end - 1 }).iterator();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      let { done, value } = await read.next();

      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    }
  });
}

let stream = readFile("test.ts", 0, 10);

try {
  for await (let chunk of stream) {
    console.log(new TextDecoder().decode(chunk));
  }
} catch (error) {
  console.error(error);
}
