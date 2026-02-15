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
 * The parsed header of a tar entry.
 */
export interface TarHeader {
    name: string;
    mode: number | null;
    uid: number | null;
    gid: number | null;
    size: number;
    mtime: number | null;
    type: string;
    linkname: string | null;
    uname: string;
    gname: string;
    devmajor: number | null;
    devminor: number | null;
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
export type ParseTarOptions = ParseTarHeaderOptions;
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
export declare function parseTar(archive: TarArchiveSource, options: ParseTarOptions, handler: TarEntryHandler): Promise<void>;
/**
 * Options for configuring a `TarParser`.
 */
export type TarParserOptions = ParseTarHeaderOptions;
/**
 * A parser for tar archives.
 */
export declare class TarParser {
    #private;
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
     * The content of this entry buffered into a single typed array.
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