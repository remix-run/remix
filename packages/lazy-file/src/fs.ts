import * as fs from 'node:fs';
import * as path from 'node:path';
import { lookup } from 'mrmime';

import { LazyContent, LazyFile } from './lib/lazy-file.js';

export interface OpenFileOptions {
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
 *
 * @param filename The path to the file
 * @param options Options to override the file's metadata
 * @returns A `File` object
 */
export function openFile(filename: string, options?: OpenFileOptions): File {
  let stats = fs.statSync(filename);

  if (!stats.isFile()) {
    throw new Error(`Path "${filename}" is not a file`);
  }

  let content: LazyContent = {
    byteLength: stats.size,
    stream(start, end) {
      return streamFile(filename, start, end);
    },
  };

  return new LazyFile(content, options?.name ?? path.basename(filename), {
    type: options?.type ?? lookup(filename),
    lastModified: options?.lastModified ?? stats.mtimeMs,
  });
}

function streamFile(filename: string, start = 0, end = Infinity): ReadableStream<Uint8Array> {
  let read = fs.createReadStream(filename, { start, end: end - 1 }).iterator();

  return new ReadableStream({
    async pull(controller) {
      let { done, value } = await read.next();

      if (done) {
        controller.close();
      } else {
        controller.enqueue(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
      }
    },
  });
}

// Preserve backwards compat with v3.0
export { type OpenFileOptions as GetFileOptions, openFile as getFile };

/**
 * Writes a `File` to the local filesytem and resolves when the stream is finished.
 *
 * [MDN `File` Reference](https://developer.mozilla.org/en-US/docs/Web/API/File)
 *
 * @param to The path to write the file to, or an open file descriptor
 * @param file The file to write
 * @returns A promise that resolves when the file is written
 */
export function writeFile(to: string | number | fs.promises.FileHandle, file: File): Promise<void> {
  return new Promise(async (resolve) => {
    let writeStream =
      typeof to === 'string'
        ? fs.createWriteStream(to)
        : fs.createWriteStream('ignored', { fd: to });

    for await (let chunk of file.stream()) {
      writeStream.write(chunk);
    }

    writeStream.end(() => {
      resolve();
    });
  });
}
