import * as fs from "node:fs";
import * as path from "node:path";
import { lookup } from "mrmime";

import { LazyFileContent, LazyFile } from "./lib/lazy-file.js";

/**
 * Returns a `File` from the local filesytem.
 *
 * [MDN `File` Reference](https://developer.mozilla.org/en-US/docs/Web/API/File)
 */
export function getFile(
  filename: string,
  { name = path.basename(filename), type = lookup(filename) } = {}
): File {
  let stats = fs.statSync(filename);

  if (!stats.isFile()) {
    throw new Error(`Path "${filename}" is not a file`);
  }

  let content: LazyFileContent = {
    byteLength: stats.size,
    read(start, end) {
      return readFile(filename, start, end);
    }
  };

  return new LazyFile(content, name, { type, lastModified: stats.mtimeMs });
}

function readFile(
  filename: string,
  start = 0,
  end = Infinity
): ReadableStream<Uint8Array> {
  let read = fs.createReadStream(filename, { start, end: end - 1 }).iterator();

  return new ReadableStream({
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
