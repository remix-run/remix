import { type ByteRange } from './byte-range.ts';
/**
 * A streaming interface for blob/file content.
 */
export interface LazyContent {
    /**
     * The total length of the content.
     */
    byteLength: number;
    /**
     * Returns a stream that can be used to read the content. When given, the `start` index is
     * inclusive indicating the index of the first byte to read. The `end` index is exclusive
     * indicating the index of the first byte not to read.
     *
     * @param start The start index (inclusive)
     * @param end The end index (exclusive)
     * @returns A readable stream of the content
     */
    stream(start?: number, end?: number): ReadableStream<Uint8Array<ArrayBuffer>>;
}
/**
 * Options for creating a `LazyBlob`.
 */
export interface LazyBlobOptions {
    /**
     * The range of bytes to include from the content. If not specified, all content is included.
     */
    range?: ByteRange;
    /**
     * The MIME type of the content.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob#type)
     *
     * @default ''
     */
    type?: string;
}
/**
 * A lazy, streaming alternative to [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob).
 *
 * **Important:** Since `LazyBlob` is not a `Blob` subclass, you cannot pass it directly to APIs
 * that expect a real `Blob` (like `new Response(blob)` or `formData.append('file', blob)`).
 * Instead, use one of:
 *
 * - `.stream()` - Returns a `ReadableStream` for `Response` and other streaming APIs
 * - `.toBlob()` - Returns a `Promise<Blob>` for non-streaming APIs that require a complete `Blob` (e.g. `FormData`)
 *
 * [MDN `Blob` Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
 */
export declare class LazyBlob {
    #private;
    /**
     * @param parts The blob parts or lazy content
     * @param options Options for the blob
     */
    constructor(parts: BlobPartLike[] | LazyContent, options?: LazyBlobOptions);
    get [Symbol.toStringTag](): string;
    /**
     * Returns the blob's contents as an [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer).
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer)
     *
     * @returns A promise that resolves to an `ArrayBuffer`
     */
    arrayBuffer(): Promise<ArrayBuffer>;
    /**
     * Returns the blob's contents as a byte array.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/bytes)
     *
     * @returns A promise that resolves to a `Uint8Array`
     */
    bytes(): Promise<Uint8Array<ArrayBuffer>>;
    /**
     * The size of the blob in bytes.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/size)
     */
    get size(): number;
    /**
     * The MIME type of the blob.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/type)
     */
    get type(): string;
    /**
     * Returns a new `LazyBlob` that contains the data in the specified range.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice)
     *
     * @param start The start index (inclusive)
     * @param end The end index (exclusive)
     * @param contentType The content type of the new blob
     * @returns A new `LazyBlob` containing the sliced data
     */
    slice(start?: number, end?: number, contentType?: string): LazyBlob;
    /**
     * Returns a stream that can be used to read the blob's contents.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/stream)
     *
     * @returns A readable stream of the blob's contents
     */
    stream(): ReadableStream<Uint8Array<ArrayBuffer>>;
    /**
     * Returns the blob's contents as a string.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/text)
     *
     * @returns A promise that resolves to the blob's contents as a string
     */
    text(): Promise<string>;
    /**
     * Converts this `LazyBlob` to a native `Blob`.
     *
     * **Warning:** This reads the entire content into memory, which defeats the purpose of using
     * a lazy blob for large files. Only use this for non-streaming APIs that require a complete `Blob`.
     * Use `.stream()` to get a `ReadableStream` for `Response` and other streaming APIs.
     *
     * @returns A promise that resolves to a native `Blob`
     */
    toBlob(): Promise<Blob>;
    /**
     * @throws Always throws a TypeError. LazyBlob cannot be implicitly converted to a string.
     * Use `.stream()` to get a `ReadableStream` for `Response` and other streaming APIs, or `.toBlob()` for non-streaming APIs that require a complete `Blob` (e.g. `FormData`). Always prefer `.stream()` when possible.
     */
    toString(): never;
}
/**
 * Options for creating a `LazyFile`.
 */
export interface LazyFileOptions extends LazyBlobOptions {
    /**
     * The last modified timestamp of the file in milliseconds.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/File/File#lastmodified)
     *
     * @default `Date.now()`
     */
    lastModified?: number;
}
/**
 * A lazy, streaming alternative to [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File).
 *
 * **Important:** Since `LazyFile` is not a `File` subclass, you cannot pass it directly to APIs
 * that expect a real `File` (like `new Response(file)` or `formData.append('file', file)`).
 * Instead, use one of:
 *
 * - `.stream()` - Returns a `ReadableStream` for `Response` and other streaming APIs
 * - `.toFile()` - Returns a `Promise<File>` for non-streaming APIs that require a complete `File` (e.g. `FormData`)
 * - `.toBlob()` - Returns a `Promise<Blob>` for non-streaming APIs that require a complete `Blob` (e.g. `FormData`)
 *
 * [MDN `File` Reference](https://developer.mozilla.org/en-US/docs/Web/API/File)
 */
export declare class LazyFile {
    #private;
    /**
     * The name of the file.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/File/name)
     */
    readonly name: string;
    /**
     * The last modified timestamp of the file in milliseconds.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/File/lastModified)
     */
    readonly lastModified: number;
    /**
     * Always empty string. This property exists only for structural compatibility with the native
     * `File` interface. It's a browser-specific property for files selected via `<input type="file">`
     * with the `webkitdirectory` attribute, which doesn't apply to programmatically created files.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/File/webkitRelativePath)
     */
    readonly webkitRelativePath: string;
    /**
     * @param parts The file parts or lazy content
     * @param name The name of the file
     * @param options Options for the file
     */
    constructor(parts: BlobPartLike[] | LazyContent, name: string, options?: LazyFileOptions);
    get [Symbol.toStringTag](): string;
    /**
     * Returns the file's content as an [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer).
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer)
     *
     * @returns A promise that resolves to an `ArrayBuffer`
     */
    arrayBuffer(): Promise<ArrayBuffer>;
    /**
     * Returns the file's contents as a byte array.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/bytes)
     *
     * @returns A promise that resolves to a `Uint8Array`
     */
    bytes(): Promise<Uint8Array<ArrayBuffer>>;
    /**
     * The size of the file in bytes.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/size)
     */
    get size(): number;
    /**
     * The MIME type of the file.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/type)
     */
    get type(): string;
    /**
     * Returns a new `LazyBlob` that contains the data in the specified range.
     *
     * Note: Like the native `File.slice()`, this returns a `Blob` (not a `File`).
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice)
     *
     * @param start The start index (inclusive)
     * @param end The end index (exclusive)
     * @param contentType The content type of the new blob
     * @returns A new `LazyBlob` containing the sliced data
     */
    slice(start?: number, end?: number, contentType?: string): LazyBlob;
    /**
     * Returns a stream that can be used to read the file's contents.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/stream)
     *
     * @returns A readable stream of the file's contents
     */
    stream(): ReadableStream<Uint8Array<ArrayBuffer>>;
    /**
     * Returns the file's contents as a string.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Blob/text)
     *
     * @returns A promise that resolves to the file's contents as a string
     */
    text(): Promise<string>;
    /**
     * Converts this `LazyFile` to a native `Blob`.
     *
     * **Warning:** This reads the entire content into memory, which defeats the purpose of using
     * a lazy file for large files. Only use this for non-streaming APIs that require a complete `Blob`.
     * Use `.stream()` to get a `ReadableStream` for `Response` and other streaming APIs.
     *
     * @returns A promise that resolves to a native `Blob`
     */
    toBlob(): Promise<Blob>;
    /**
     * Converts this `LazyFile` to a native `File`.
     *
     * **Warning:** This reads the entire content into memory, which defeats the purpose of using
     * a lazy file for large files. Only use this for non-streaming APIs that require a complete `File`
     * (e.g. `FormData`). For streaming, use `.stream()` instead.
     *
     * @returns A promise that resolves to a native `File`
     */
    toFile(): Promise<File>;
    /**
     * @throws Always throws a TypeError. LazyFile cannot be implicitly converted to a string.
     * Use `.stream()` to get a `ReadableStream` for `Response` and other streaming APIs, or `.toFile()`/`.toBlob()` for non-streaming APIs that require a complete `File`/`Blob` (e.g. `FormData`). Always prefer `.stream()` when possible.
     */
    toString(): never;
}
/**
 * Union of BlobPart and lazy blob types. Used for constructor signatures.
 */
type BlobPartLike = BlobPart | LazyBlob | LazyFile;
export {};
//# sourceMappingURL=lazy-file.d.ts.map