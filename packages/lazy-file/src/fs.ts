import * as fs from 'node:fs';
import * as path from 'node:path';
import { lookup } from 'mrmime';

import { LazyContent, LazyFile } from './lib/lazy-file.js';

export interface GetFileOptions {
  /**
   * Overrides the name of the file. Default is the name of the file on disk.
   */
  name?: string;
  /**
   * Overrides the MIME type of the file. Default is determined by the file extension.
   */
  type?: string;
  /**
   * Overrides the last modified timestamp of the file. Default is the file's last modified time.
   */
  lastModified?: number;
}

/**
 * Returns a `File` from the local filesytem.
 *
 * [MDN `File` Reference](https://developer.mozilla.org/en-US/docs/Web/API/File)
 */
export function getFile(filename: string, options?: GetFileOptions): File {
  let stats = fs.statSync(filename);

  if (!stats.isFile()) {
    throw new Error(`Path "${filename}" is not a file`);
  }

  let content: LazyContent = {
    byteLength: stats.size,
    stream(start, end) {
      return streamFile(filename, start, end);
    }
  };

  return new LazyFile(content, options?.name ?? path.basename(filename), {
    type: options?.type ?? lookup(filename),
    lastModified: options?.lastModified ?? stats.mtimeMs
  });
}

function streamFile(
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
        controller.enqueue(
          new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        );
      }
    }
  });
}
