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
}
/**
 * Parse a `multipart/*` message from a buffer/iterable and yield each part as a `MultipartPart` object.
 *
 * Note: This is a low-level API that requires manual handling of the content and boundary. If you're
 * building a web server, consider using `parseMultipartRequest(request)` instead.
 *
 * @param message The multipart message as a `Uint8Array` or an iterable of `Uint8Array` chunks
 * @param options Options for the parser
 * @returns A generator that yields `MultipartPart` objects
 */
export declare function parseMultipart(message: Uint8Array | Iterable<Uint8Array>, options: ParseMultipartOptions): Generator<MultipartPart, void, unknown>;
/**
 * Parse a `multipart/*` message stream and yield each part as a `MultipartPart` object.
 *
 * Note: This is a low-level API that requires manual handling of the content and boundary. If you're
 * building a web server, consider using `parseMultipartRequest(request)` instead.
 *
 * @param stream A stream containing multipart data as a `ReadableStream<Uint8Array>`
 * @param options Options for the parser
 * @returns An async generator that yields `MultipartPart` objects
 */
export declare function parseMultipartStream(stream: ReadableStream<Uint8Array>, options: ParseMultipartOptions): AsyncGenerator<MultipartPart, void, unknown>;
/**
 * Options for configuring a `MultipartParser`.
 */
export type MultipartParserOptions = Omit<ParseMultipartOptions, 'boundary'>;
/**
 * A streaming parser for `multipart/*` HTTP messages.
 */
export declare class MultipartParser {
    #private;
    readonly boundary: string;
    readonly maxHeaderSize: number;
    readonly maxFileSize: number;
    /**
     * @param boundary The boundary string used to separate parts
     * @param options Options for the parser
     */
    constructor(boundary: string, options?: MultipartParserOptions);
    /**
     * Write a chunk of data to the parser.
     *
     * @param chunk A chunk of data to write to the parser
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
     * The headers associated with this part.
     */
    get headers(): Headers;
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