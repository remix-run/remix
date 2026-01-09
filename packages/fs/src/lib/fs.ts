import * as fs from 'node:fs'
import { detectMimeType } from '@remix-run/mime'

import { type LazyContent, LazyFile } from '@remix-run/lazy-file'

/**
 * Options for opening a lazy file from the local filesystem.
 */
export interface OpenLazyFileOptions {
  /**
   * Overrides the name of the file.
   *
   * @default the filename argument as provided
   */
  name?: string
  /**
   * Overrides the MIME type of the file.
   *
   * @default determined by the file extension
   */
  type?: string
  /**
   * Overrides the last modified timestamp of the file.
   *
   * @default the file's last modified time
   */
  lastModified?: number
}

/**
 * Returns a `LazyFile` from the local filesystem.
 *
 * The returned file's `name` property will be set to the `filename` argument as provided,
 * unless overridden via `options.name`.
 *
 * @param filename The path to the file
 * @param options Options to override the file's metadata
 * @returns A `LazyFile` object
 */
export function openLazyFile(filename: string, options?: OpenLazyFileOptions): LazyFile {
  let stats = fs.statSync(filename)

  if (!stats.isFile()) {
    throw new Error(`Path "${filename}" is not a file`)
  }

  let content: LazyContent = {
    byteLength: stats.size,
    stream(start, end) {
      return streamFile(filename, start, end)
    },
  }

  return new LazyFile(content, options?.name ?? filename, {
    type: options?.type ?? detectMimeType(filename) ?? '',
    lastModified: options?.lastModified ?? stats.mtimeMs,
  })
}

function streamFile(
  filename: string,
  start = 0,
  end = Infinity,
): ReadableStream<Uint8Array<ArrayBuffer>> {
  let readStream = fs.createReadStream(filename, { start, end: end - 1 }).iterator()

  return new ReadableStream({
    async pull(controller) {
      let { done, value } = await readStream.next()

      if (done) {
        controller.close()
      } else {
        controller.enqueue(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
      }
    },
  })
}

/**
 * Writes a file-like object to the local filesystem and resolves when the stream is finished.
 *
 * Accepts any object with a `stream()` method, including native `File`, `Blob`, and `LazyFile`.
 *
 * [MDN `File` Reference](https://developer.mozilla.org/en-US/docs/Web/API/File)
 *
 * @param to The path to write the file to, or an open file descriptor
 * @param file The file to write (any object with a `stream()` method)
 * @param file.stream Method that returns a readable stream of the file's contents
 * @returns A promise that resolves when the file is written
 */
export function writeFile(
  to: string | number | fs.promises.FileHandle,
  file: { stream(): ReadableStream<Uint8Array> },
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    let writeStream =
      typeof to === 'string'
        ? fs.createWriteStream(to)
        : fs.createWriteStream('ignored', { fd: to })

    try {
      for await (let chunk of file.stream()) {
        writeStream.write(chunk)
      }

      writeStream.end(() => {
        resolve()
      })
    } catch (error) {
      writeStream.end(() => {
        reject(error)
      })
    }
  })
}
