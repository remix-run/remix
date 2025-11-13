import * as fs from 'node:fs'
import * as path from 'node:path'
import { lookup } from 'mrmime'

import { type LazyContent, LazyFile } from './lib/lazy-file.ts'

export interface OpenFileOptions {
  /**
   * Overrides the name of the file. Default is the filename argument as provided.
   */
  name?: string
  /**
   * Overrides the MIME type of the file. Default is determined by the file extension.
   */
  type?: string
  /**
   * Overrides the last modified timestamp of the file. Default is the file's last modified time.
   */
  lastModified?: number
}

/**
 * Returns a `File` from the local filesytem.
 *
 * The returned file's `name` property will be set to the `filename` argument as provided,
 * unless overridden via `options.name`.
 *
 * [MDN `File` Reference](https://developer.mozilla.org/en-US/docs/Web/API/File)
 *
 * @param filename The path to the file
 * @param options Options to override the file's metadata
 * @returns A `File` object
 */
export function openFile(filename: string, options?: OpenFileOptions): File {
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
    type: options?.type ?? lookup(filename),
    lastModified: options?.lastModified ?? stats.mtimeMs,
  }) as File
}

function streamFile(
  filename: string,
  start = 0,
  end = Infinity,
): ReadableStream<Uint8Array<ArrayBuffer>> {
  let read = fs.createReadStream(filename, { start, end: end - 1 }).iterator()

  return new ReadableStream({
    async pull(controller) {
      let { done, value } = await read.next()

      if (done) {
        controller.close()
      } else {
        controller.enqueue(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
      }
    },
  })
}

export interface FindFileOptions {
  /**
   * Overrides the name of the file. Default is the relativePath argument.
   */
  name?: string
}

/**
 * Finds a file on the filesystem within the given root directory.
 *
 * Returns `null` if the file doesn't exist, is not a file, or is outside the
 * specified root directory.
 *
 * The returned file's `name` property will be set to the `relativePath` argument,
 * unless overridden via `options.name`.
 *
 * @param root - The root directory to serve files from (absolute or relative to cwd)
 * @param relativePath - The relative path from the root to the file
 * @param options - Options to override the file's metadata
 * @returns A `File` object, or null if not found
 *
 * @example
 * let file = await findFile('./public', 'assets/logo.png')
 * if (file) {
 *   console.log(file.name) // "assets/logo.png"
 * }
 *
 * @example
 * // Override the file name
 * let file = await findFile('./public', 'assets/logo.png', { name: 'custom.png' })
 * if (file) {
 *   console.log(file.name) // "custom.png"
 * }
 */
export async function findFile(
  root: string,
  relativePath: string,
  options?: FindFileOptions,
): Promise<File | null> {
  // Ensure root is an absolute path
  root = path.resolve(root)

  let filePath = path.join(root, relativePath)

  // Security check: ensure the resolved path is within the root directory
  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    return null
  }

  try {
    return openFile(filePath, { name: options?.name ?? relativePath })
  } catch (error) {
    if (isNoEntityError(error) || isNotAFileError(error)) {
      return null
    }
    throw error
  }
}

function isNoEntityError(error: unknown): error is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function isNotAFileError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('is not a file')
}

// Preserve backwards compat with v3.0
export { type OpenFileOptions as GetFileOptions, openFile as getFile }

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
