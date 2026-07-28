/**
 * The base class for errors thrown by the multipart parser.
 */
export declare class MultipartParseError extends Error {
    /**
     * @param message The error message
     */
    constructor(message: string);
}
/**
 * An error thrown when the maximum allowed size of a header is exceeded.
 */
export declare class MaxHeaderSizeExceededError extends MultipartParseError {
    /**
     * @param maxHeaderSize The maximum header size that was exceeded
     */
    constructor(maxHeaderSize: number);
}
/**
 * An error thrown when the maximum allowed size of a file is exceeded.
 */
export declare class MaxFileSizeExceededError extends MultipartParseError {
    /**
     * @param maxFileSize The maximum file size that was exceeded
     */
    constructor(maxFileSize: number);
}
/**
 * An error thrown when the maximum allowed number of multipart parts is exceeded.
 */
export declare class MaxPartsExceededError extends MultipartParseError {
    /**
     * @param maxParts The maximum number of parts that was exceeded
     */
    constructor(maxParts: number);
}
/**
 * An error thrown when the maximum allowed aggregate multipart content size is exceeded.
 */
export declare class MaxTotalSizeExceededError extends MultipartParseError {
    /**
     * @param maxTotalSize The maximum total size that was exceeded
     */
    constructor(maxTotalSize: number);
}
/**
 * Options for parsing a multipart message.
 */
export interface ParseMultipartOptions {
    /**
     * The boundary string used to separate parts in the multipart message,
     * e.g. the `boundary` parameter in the `Content-Type` header.
     */
    boundary: string;
    /**
     * The maximum allowed size of a header in bytes. If an individual part's header
     * exceeds this size, a `MaxHeaderSizeExceededError` will be thrown.
     *
     * @default 8192 (8 KiB)
     */
    maxHeaderSize?: number;
    /**
     * The maximum allowed size of a file in bytes. If an individual part's content
     * exceeds this size, a `MaxFileSizeExceededError` will be thrown.
     *
     * @default 2097152 (2 MiB)
     */
    maxFileSize?: number;
    /**
     * The maximum allowed number of parts in the multipart message. If this limit
     * is exceeded, a `MaxPartsExceededError` will be thrown.
     *
     * @default 1000
     */
    maxParts?: number;
    /**
     * The maximum allowed aggregate size of all part content in bytes. If this
     * limit is exceeded, a `MaxTotalSizeExceededError` will be thrown.
     *
     * @default `maxFileSize * 20 + 1048576` (1 MiB)
     */
    maxTotalSize?: number;
}
/**
 * Parse a `multipart/*` message from a buffer/iterable and yield each part as a
 * {@link MultipartPart} object.
 *
 * Note: This is a low-level API that requires manual handling of the content and boundary.
 * If you're building a web server, consider using
 * {@link import('./multipart-request.ts').parseMultipartRequest} instead.
 *
 * @param message The multipart message as a `Uint8Array` or an iterable of `Uint8Array` chunks
 * @param options Options for the parser
 * @yields Parsed {@link MultipartPart} objects from the multipart message
 * @returns A generator that yields {@link MultipartPart} objects
 */
export declare function parseMultipart(message: Uint8Array | Iterable<Uint8Array>, options: ParseMultipartOptions): Generator<MultipartPart, void, unknown>;
/**
 * Parse a `multipart/*` message stream and yield each part as a {@link MultipartPart} object.
 *
 * Note: This is a low-level API that requires manual handling of the content and boundary.
 * If you're building a web server, consider using
 * {@link import('./multipart-request.ts').parseMultipartRequest} instead.
 *
 * @param stream A stream containing multipart data as a `ReadableStream<Uint8Array>`
 * @param options Options for the parser
 * @yields Parsed {@link MultipartPart} objects from the multipart stream
 * @returns An async generator that yields {@link MultipartPart} objects
 */
export declare function parseMultipartStream(stream: ReadableStream<Uint8Array>, options: ParseMultipartOptions): AsyncGenerator<MultipartPart, void, unknown>;
/**
 * Options for configuring a {@link MultipartParser}.
 */
export type MultipartParserOptions = Omit<ParseMultipartOptions, 'boundary'>;
/**
 * A streaming parser for `multipart/*` HTTP messages.
 */
export declare class MultipartParser {
    #private;
    /**
     * Boundary string used to detect part separators.
     */
    readonly boundary: string;
    /**
     * Maximum header size allowed for each multipart part.
     */
    readonly maxHeaderSize: number;
    /**
     * Maximum file size allowed for each multipart part.
     */
    readonly maxFileSize: number;
    /**
     * Maximum number of parts allowed in a multipart message.
     */
    readonly maxParts: number;
    /**
     * Maximum aggregate content size allowed across all parts.
     */
    readonly maxTotalSize: number;
    /**
     * @param boundary The boundary string used to separate parts
     * @param options Options for the parser
     */
    constructor(boundary: string, options?: MultipartParserOptions);
    /**
     * Write a chunk of data to the parser.
     *
     * @param chunk A chunk of data to write to the parser
     * @yields Parsed {@link MultipartPart} objects that became available from this chunk
     * @returns A generator yielding `MultipartPart` objects as they are parsed
     */
    write(chunk: Uint8Array): Generator<MultipartPart, void, unknown>;
    /**
     * Should be called after all data has been written to the parser.
     *
     * Note: This will throw if the multipart message is incomplete or
     * wasn't properly terminated.
     */
    finish(): void;
}
/**
 * The decoded headers for a multipart part, keyed by lower-case header name.
 */
export interface MultipartHeaders {
    readonly [name: string]: string | undefined;
}
/**
 * A part of a `multipart/*` HTTP message.
 */
export declare class MultipartPart {
    #private;
    /**
     * The raw content of this part as an array of `Uint8Array` chunks.
     */
    readonly content: Uint8Array[];
    /**
     * @param header The raw header bytes
     * @param content The content chunks
     */
    constructor(header: Uint8Array, content: Uint8Array[]);
    /**
     * The content of this part as an `ArrayBuffer`.
     */
    get arrayBuffer(): ArrayBuffer;
    /**
     * The content of this part as a single `Uint8Array`. In `multipart/form-data` messages, this is useful
     * for reading the value of files that were uploaded using `<input type="file">` fields.
     */
    get bytes(): Uint8Array;
    /**
     * The decoded headers associated with this part, keyed by lower-case header name.
     */
    get headers(): MultipartHeaders;
    /**
     * True if this part originated from a file upload.
     */
    get isFile(): boolean;
    /**
     * True if this part originated from a text input field in a form submission.
     */
    get isText(): boolean;
    /**
     * The filename of the part, if it is a file upload.
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
     * The size of the content in bytes.
     */
    get size(): number;
    /**
     * The content of this part as a string. In `multipart/form-data` messages, this is useful for
     * reading the value of parts that originated from `<input type="text">` fields.
     *
     * Note: Do not use this for binary data, use `part.bytes` or `part.arrayBuffer` instead.
     */
    get text(): string;
}
//# sourceMappingURL=multipart.d.ts.map