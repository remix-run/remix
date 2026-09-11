/**
 * An error thrown when parsing a tar archive fails.
 */
export declare class TarParseError extends Error {
    /**
     * @param message The error message
     */
    constructor(message: string);
}
/**
 * An error thrown when a tar entry exceeds the maximum allowed body size.
 */
export declare class MaxEntrySizeExceededError extends TarParseError {
    /**
     * @param maxEntrySize The maximum entry size that was exceeded
     */
    constructor(maxEntrySize: number);
}
/**
 * An error thrown when a tar archive exceeds the maximum allowed total size.
 */
export declare class MaxTotalSizeExceededError extends TarParseError {
    /**
     * @param maxTotalSize The maximum total size that was exceeded
     */
    constructor(maxTotalSize: number);
}
/**
 * An error thrown when a tar archive exceeds the maximum allowed number of entries.
 */
export declare class MaxEntriesExceededError extends TarParseError {
    /**
     * @param maxEntries The maximum entry count that was exceeded
     */
    constructor(maxEntries: number);
}
/**
 * The parsed header of a tar entry.
 */
export interface TarHeader {
    /**
     * Entry path stored in the archive.
     */
    name: string;
    /**
     * File mode parsed from the header, or `null` when unavailable.
     */
    mode: number | null;
    /**
     * Numeric user ID parsed from the header, or `null` when unavailable.
     */
    uid: number | null;
    /**
     * Numeric group ID parsed from the header, or `null` when unavailable.
     */
    gid: number | null;
    /**
     * Entry size in bytes. Parsed sizes are non-negative safe integers.
     */
    size: number;
    /**
     * Last modification time parsed from the header, or `null` when unavailable.
     */
    mtime: number | null;
    /**
     * Normalized entry type such as `file` or `directory`.
     */
    type: string;
    /**
     * Linked path target for link entries, or `null` when not present.
     */
    linkname: string | null;
    /**
     * User name parsed from the header.
     */
    uname: string;
    /**
     * Group name parsed from the header.
     */
    gname: string;
    /**
     * Major device number for device entries, or `null` when unavailable.
     */
    devmajor: number | null;
    /**
     * Minor device number for device entries, or `null` when unavailable.
     */
    devminor: number | null;
    /**
     * Decoded PAX metadata attached to the entry, or `null` when none is present.
     */
    pax: Record<string, string> | null;
}
/**
 * Options for parsing tar headers.
 */
export interface ParseTarHeaderOptions {
    /**
     * Set `false` to disallow unknown header formats.
     *
     * @default true
     */
    allowUnknownFormat?: boolean;
    /**
     * The label (encoding) for filenames.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API/Encodings)
     *
     * @default 'utf-8'
     */
    filenameEncoding?: string;
}
/**
 * Parses a tar header block.
 *
 * @param block The tar header block
 * @param options Options that control how the header is parsed
 * @returns The parsed tar header
 */
export declare function parseTarHeader(block: Uint8Array, options?: ParseTarHeaderOptions): TarHeader;
type TarArchiveSource = ReadableStream<Uint8Array> | Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>;
type TarEntryHandler = (entry: TarEntry) => void | Promise<void>;
/**
 * Options for parsing a tar archive.
 */
export interface ParseTarOptions extends ParseTarHeaderOptions {
    /**
     * Maximum entry body size in bytes, including PAX/GNU metadata entries.
     * Checked before reading the body or calling the handler. Exceeding the limit
     * throws a {@link MaxEntrySizeExceededError}. Defaults to 2 MiB (2097152 bytes).
     * Must be a non-negative safe integer, or `Infinity` to disable the limit.
     */
    maxEntrySize?: number;
    /**
     * Maximum archive size in bytes, including headers, padding, and metadata.
     * Counts all input bytes, after decompression if performed upstream. Exceeding
     * the limit throws a {@link MaxTotalSizeExceededError}. Defaults to 20 MiB
     * (20971520 bytes). Must be a non-negative safe integer, or `Infinity` to disable
     * the limit.
     */
    maxTotalSize?: number;
    /**
     * Maximum number of entries, including PAX/GNU metadata entries. Padding and
     * end-of-archive markers do not count. Checked before processing each entry;
     * exceeding the limit throws a {@link MaxEntriesExceededError}. Defaults to 5000.
     * Must be a non-negative safe integer, or `Infinity` to disable the limit.
     */
    maxEntries?: number;
}
/**
 * Parse a tar archive and call the given handler for each entry it contains.
 *
 * ```ts
 * import { parseTar } from 'remix/tar-parser';
 *
 * await parseTar(archive, (entry) => {
 *  console.log(entry.name);
 * });
 * ```
 *
 * @param archive The tar archive source data
 * @param handler A function to call for each entry in the archive
 * @returns A promise that resolves when the parse is finished
 */
export declare function parseTar(archive: TarArchiveSource, handler: TarEntryHandler): Promise<void>;
/**
 * Parse a tar archive with the given options and call the handler for each entry.
 *
 * @param archive The tar archive source data
 * @param options Options that control parsing and size limits
 * @param handler A function to call for each entry in the archive
 * @returns A promise that resolves when parsing and all handlers finish
 */
export declare function parseTar(archive: TarArchiveSource, options: ParseTarOptions, handler: TarEntryHandler): Promise<void>;
/**
 * Options for configuring a {@link TarParser}.
 */
export type TarParserOptions = ParseTarOptions;
/**
 * A parser for tar archives.
 */
export declare class TarParser {
    #private;
    /**
     * Maximum entry body size in bytes, including PAX/GNU metadata entries.
     */
    readonly maxEntrySize: number;
    /**
     * Maximum archive input size in bytes, including headers, padding, and metadata.
     */
    readonly maxTotalSize: number;
    /**
     * Maximum number of entries, including PAX/GNU metadata entries.
     */
    readonly maxEntries: number;
    /**
     * @param options Options that control how the tar archive is parsed
     */
    constructor(options?: TarParserOptions);
    /**
     * Parse a stream/buffer tar archive and call the given handler for each entry it contains.
     * Resolves when the parse is finished and all handlers resolve.
     *
     * @param archive The tar archive source data
     * @param handler A function to call for each entry in the archive
     * @returns A promise that resolves when the parse is finished
     */
    parse(archive: TarArchiveSource, handler: TarEntryHandler): Promise<void>;
}
/**
 * An entry in a tar archive.
 */
export declare class TarEntry {
    #private;
    /**
     * @param header The header info for this entry
     * @param body The entry's content as a stream
     */
    constructor(header: TarHeader, body: ReadableStream<Uint8Array>);
    /**
     * The content of this entry as an [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer).
     *
     * @returns A promise that resolves to an `ArrayBuffer`
     */
    arrayBuffer(): Promise<ArrayBuffer>;
    /**
     * The content of this entry as a `ReadableStream<Uint8Array>`.
     */
    get body(): ReadableStream<Uint8Array>;
    /**
     * Whether the body of this entry has been consumed.
     */
    get bodyUsed(): boolean;
    /**
     * The content of this entry buffered into a single typed array using the bytes received.
     * Rejects if parsing fails before the entry's body is complete.
     *
     * @returns A promise that resolves to a `Uint8Array`
     */
    bytes(): Promise<Uint8Array>;
    /**
     * The raw header info associated with this entry.
     */
    get header(): TarHeader;
    /**
     * The name of this entry.
     */
    get name(): string;
    /**
     * The size of this entry in bytes.
     */
    get size(): number;
    /**
     * The content of this entry as a string.
     *
     * Note: Do not use this for binary data, use `await entry.bytes()` or stream `entry.body` directly instead.
     *
     * @returns A promise that resolves to the entry's content as a string
     */
    text(): Promise<string>;
}
export {};
//# sourceMappingURL=tar.d.ts.map