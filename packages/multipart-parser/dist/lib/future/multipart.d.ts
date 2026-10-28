import { type MultipartHeaders, type ParseMultipartOptions } from '../multipart.ts';
/**
 * Parse a `multipart/*` message stream and yield each part as a {@link MultipartPart} as soon as
 * its headers arrive. Part content is streamed from the message as you read it, never buffered.
 *
 * Parts are read in order, so read each part's content before continuing to the next part. When
 * you continue, the parser waits for a read you started to finish and discards any content you
 * didn't read.
 *
 * Note: This is a low-level API that requires manual handling of the content and boundary.
 * If you're building a web server, consider using
 * {@link import('./multipart-request.ts').parseMultipartRequest} instead.
 *
 * @param stream A stream containing multipart data as a `ReadableStream<Uint8Array>`
 * @param options Options for the parser
 * @yields {@link MultipartPart} objects as their headers are parsed
 * @returns An async generator that yields {@link MultipartPart} objects
 */
export declare function parseMultipartStream(stream: ReadableStream<Uint8Array>, options: ParseMultipartOptions): AsyncGenerator<MultipartPart, void, unknown>;
type ScanItem = Uint8Array | PartHeader | typeof partEnd;
interface PartHeader {
    header: Uint8Array;
}
declare const partEnd: null;
declare const pending: unique symbol;
interface ScannerLimits {
    maxHeaderSize: number;
    maxFileSize: number;
    maxTotalSize: number;
}
declare class MultipartReader {
    #private;
    constructor(stream: ReadableStream<Uint8Array>, boundary: string, limits: ScannerLimits & {
        maxParts: number;
    });
    parts(): AsyncGenerator<MultipartPart, void, unknown>;
    next(): Promise<ScanItem | undefined>;
    take(): ScanItem | undefined | typeof pending;
    read(): Promise<void>;
}
declare class PartContent {
    #private;
    constructor(reader: MultipartReader);
    get ended(): boolean;
    get used(): boolean;
    chunks(): AsyncGenerator<Uint8Array<ArrayBuffer>, void, unknown>;
    readAll(): Promise<Uint8Array<ArrayBuffer>[]>;
    settle(): Promise<void>;
    fail(): void;
}
/**
 * A part of a `multipart/*` HTTP message, yielded as soon as its headers arrive. Its content is
 * streamed from the message and can be read once, with {@link MultipartPart.body},
 * {@link MultipartPart.bytes}, {@link MultipartPart.text}, or `for await...of`.
 */
export declare class MultipartPart implements AsyncIterable<Uint8Array<ArrayBuffer>> {
    #private;
    /**
     * @param header The raw header bytes
     * @param content The part's content
     */
    constructor(header: Uint8Array, content: PartContent);
    /**
     * A stream of this part's content. Accessing it starts reading the content, so the next part
     * isn't yielded until the stream is read to the end, canceled, or errors.
     */
    get body(): ReadableStream<Uint8Array<ArrayBuffer>>;
    /**
     * True once this part's content has been read, a read of it has started, or its
     * {@link MultipartPart.body} has been accessed.
     */
    get bodyUsed(): boolean;
    /**
     * The decoded headers associated with this part, keyed by lower-case header name.
     */
    get headers(): MultipartHeaders;
    /**
     * True if this part originated from a file upload.
     */
    get isFile(): boolean;
    /**
     * The filename from the part's `Content-Disposition` header, preferring a decoded `filename*`
     * over `filename` when available. This is untrusted client input without filesystem sanitization.
     * Do not use it, or a `File.name` derived from it, directly as a filesystem path. Generate a
     * storage name in your application instead.
     */
    get filename(): string | undefined;
    /**
     * The media type of the part.
     */
    get mediaType(): string | undefined;
    /**
     * The name of the part, usually the `name` of the field in the `<form>` that submitted the request.
     */
    get name(): string | undefined;
    /**
     * Reads all of this part's content into a single `Uint8Array`.
     *
     * @returns A promise that resolves to the part's content
     */
    bytes(): Promise<Uint8Array<ArrayBuffer>>;
    /**
     * Reads all of this part's content as a UTF-8 string. In `multipart/form-data` messages, this is
     * useful for reading the value of parts that originated from `<input type="text">` fields.
     *
     * Note: Do not use this for binary data, use `part.body` or `part.bytes()` instead.
     *
     * @returns A promise that resolves to the part's content as a string
     */
    text(): Promise<string>;
    /**
     * Iterates over the chunks of this part's content.
     *
     * @returns An async iterator of the part's content chunks
     */
    [Symbol.asyncIterator](): AsyncIterator<Uint8Array<ArrayBuffer>>;
}
export {};
//# sourceMappingURL=multipart.d.ts.map