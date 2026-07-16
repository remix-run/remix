import * as fs from 'node:fs';
import { LazyFile } from '@remix-run/lazy-file';
/**
 * Options for opening a lazy file from the local filesystem.
 */
export interface OpenLazyFileOptions {
    /**
     * Overrides the name of the file.
     *
     * @default the filename argument as provided
     */
    name?: string;
    /**
     * Overrides the MIME type of the file.
     *
     * @default determined by the file extension
     */
    type?: string;
    /**
     * Overrides the last modified timestamp of the file.
     *
     * @default the file's last modified time
     */
    lastModified?: number;
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
export declare function openLazyFile(filename: string, options?: OpenLazyFileOptions): LazyFile;
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
export declare function writeFile(to: string | number | fs.promises.FileHandle, file: {
    stream(): ReadableStream<Uint8Array>;
}): Promise<void>;
//# sourceMappingURL=fs.d.ts.map