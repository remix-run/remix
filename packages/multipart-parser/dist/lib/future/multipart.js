import { ContentDisposition } from '@remix-run/headers/content-disposition';
import { ContentType } from '@remix-run/headers/content-type';
import { encodeAsciiPattern, createSearch, createPartialTailSearch, } from '../buffer-search.js';
import { MaxFileSizeExceededError, MaxHeaderSizeExceededError, MaxPartsExceededError, MaxTotalSizeExceededError, MultipartParseError, decodeUtf8, parseMultipartHeaders, } from '../multipart.js';
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
export async function* parseMultipartStream(stream, options) {
    let { boundary } = options;
    if (boundary.length > maxBoundaryLength) {
        throw new MultipartParseError(`Multipart boundary exceeds maximum length of ${maxBoundaryLength} characters`);
    }
    let maxFileSize = options.maxFileSize ?? defaultMaxFileSize;
    let reader = new MultipartReader(stream, boundary, {
        maxHeaderSize: options.maxHeaderSize ?? defaultMaxHeaderSize,
        maxFileSize,
        maxParts: options.maxParts ?? defaultMaxParts,
        maxTotalSize: options.maxTotalSize ?? maxFileSize * defaultMaxTotalSizePartAllowance + oneMb,
    });
    yield* reader.parts();
}
const MultipartParserStateStart = 0;
const MultipartParserStateAfterBoundary = 1;
const MultipartParserStateBoundaryPadding = 2;
const MultipartParserStateHeader = 3;
const MultipartParserStateBody = 4;
const MultipartParserStateClosingBoundary = 5;
const MultipartParserStateEpilogue = 6;
const MultipartParserStateDone = 7;
const findDoubleNewline = createSearch('\r\n\r\n');
const oneKb = 1024;
const oneMb = 1024 * oneKb;
// RFC 2046 limits boundary values to 70 characters:
// https://www.rfc-editor.org/rfc/rfc2046#section-5.1.1
const maxBoundaryLength = 70;
const defaultMaxHeaderSize = 8 * oneKb;
const defaultMaxFileSize = 2 * oneMb;
const defaultMaxParts = 1000;
const defaultMaxTotalSizePartAllowance = 20;
const partEnd = null;
// Returned by `MultipartReader.take()` when more input must be read before the next item.
const pending = Symbol('pending');
class MultipartScanner {
    #onItem;
    #maxHeaderSize;
    #maxFileSize;
    #maxTotalSize;
    #findOpeningBoundary;
    #openingBoundaryLength;
    #findBoundary;
    #findPartialTailBoundary;
    #boundaryLength;
    #boundaryBytes;
    #state = MultipartParserStateStart;
    #atStartOfStream = true;
    #buffer = null;
    #inPart = false;
    #contentLength = 0;
    #totalContentLength = 0;
    constructor(boundary, limits, onItem) {
        this.#onItem = onItem;
        this.#maxHeaderSize = limits.maxHeaderSize;
        this.#maxFileSize = limits.maxFileSize;
        this.#maxTotalSize = limits.maxTotalSize;
        this.#findOpeningBoundary = createSearch(`--${boundary}`);
        this.#openingBoundaryLength = 2 + boundary.length; // length of '--' + boundary
        let boundaryPattern = `\r\n--${boundary}`;
        this.#findBoundary = createSearch(boundaryPattern);
        this.#findPartialTailBoundary = createPartialTailSearch(boundaryPattern);
        this.#boundaryLength = 4 + boundary.length; // length of '\r\n--' + boundary
        this.#boundaryBytes = encodeAsciiPattern(boundaryPattern);
    }
    write(chunk) {
        if (this.#state === MultipartParserStateDone) {
            throw new MultipartParseError('Unexpected data after end of stream');
        }
        if (this.#state === MultipartParserStateEpilogue)
            return;
        let index = 0;
        let chunkLength = chunk.length;
        if (this.#buffer !== null) {
            if (this.#state === MultipartParserStateBody) {
                let carry = this.#buffer;
                let carryResult = this.#analyzeCarryBoundary(carry, chunk);
                if (carryResult.kind === 'none') {
                    this.#append(carry);
                }
                else if (carryResult.kind === 'partial') {
                    let content = carry.subarray(0, carryResult.start);
                    this.#append(content);
                    let tailLength = carry.length + chunk.length - carryResult.start;
                    let tail = new Uint8Array(tailLength);
                    let carryTail = carry.subarray(carryResult.start);
                    tail.set(carryTail, 0);
                    tail.set(chunk, carryTail.length);
                    this.#buffer = tail;
                    return;
                }
                else {
                    let content = carry.subarray(0, carryResult.start);
                    this.#append(content);
                    this.#state = MultipartParserStateAfterBoundary;
                    let carryAfterStart = carry.length - carryResult.start;
                    index = this.#boundaryLength - carryAfterStart;
                }
            }
            else {
                let newChunk = new Uint8Array(this.#buffer.length + chunkLength);
                newChunk.set(this.#buffer, 0);
                newChunk.set(chunk, this.#buffer.length);
                chunk = newChunk;
                chunkLength = chunk.length;
            }
            this.#buffer = null;
        }
        while (true) {
            if (this.#state === MultipartParserStateBody) {
                if (chunkLength - index < this.#boundaryLength) {
                    this.#buffer = chunk.subarray(index);
                    break;
                }
                let boundaryIndex = this.#findBoundary(chunk, index);
                if (boundaryIndex === -1) {
                    // No boundary found, but there may be a partial match at the end of the chunk.
                    let partialTailIndex = this.#findPartialTailBoundary(chunk);
                    if (partialTailIndex === -1) {
                        let content = index === 0 ? chunk : chunk.subarray(index);
                        this.#append(content);
                    }
                    else {
                        let content = chunk.subarray(index, partialTailIndex);
                        this.#append(content);
                        this.#buffer = chunk.subarray(partialTailIndex);
                    }
                    break;
                }
                let content = chunk.subarray(index, boundaryIndex);
                this.#append(content);
                index = boundaryIndex + this.#boundaryLength;
                this.#state = MultipartParserStateAfterBoundary;
            }
            if (this.#state === MultipartParserStateAfterBoundary) {
                if (chunkLength - index < 2) {
                    this.#buffer = chunk.subarray(index);
                    break;
                }
                if (chunk[index] === 45 && chunk[index + 1] === 45) {
                    index += 2;
                    this.#state = MultipartParserStateClosingBoundary;
                    if (this.#inPart) {
                        this.#inPart = false;
                        this.#onItem(partEnd);
                    }
                }
                else {
                    this.#state = MultipartParserStateBoundaryPadding;
                }
            }
            if (this.#state === MultipartParserStateBoundaryPadding ||
                this.#state === MultipartParserStateClosingBoundary) {
                let closing = this.#state === MultipartParserStateClosingBoundary;
                while (chunk[index] === 32 || chunk[index] === 9) {
                    index++;
                }
                if (index === chunkLength || (chunk[index] === 13 && chunkLength - index === 1)) {
                    this.#buffer = chunk.subarray(index);
                    break;
                }
                if (chunk[index] !== 13 || chunk[index + 1] !== 10) {
                    throw new MultipartParseError('Invalid multipart boundary ending');
                }
                index += 2; // Skip \r\n after boundary
                this.#state = closing ? MultipartParserStateEpilogue : MultipartParserStateHeader;
                if (!closing && this.#inPart) {
                    this.#inPart = false;
                    this.#onItem(partEnd);
                }
                if (closing)
                    break;
            }
            if (this.#state === MultipartParserStateHeader) {
                if (chunkLength - index < 4) {
                    this.#buffer = chunk.subarray(index);
                    break;
                }
                let headerEndIndex = findDoubleNewline(chunk, index);
                if (headerEndIndex === -1) {
                    if (chunkLength - index > this.#maxHeaderSize) {
                        throw new MaxHeaderSizeExceededError(this.#maxHeaderSize);
                    }
                    this.#buffer = chunk.subarray(index);
                    break;
                }
                if (headerEndIndex - index > this.#maxHeaderSize) {
                    throw new MaxHeaderSizeExceededError(this.#maxHeaderSize);
                }
                let header = chunk.subarray(index, headerEndIndex);
                this.#inPart = true;
                this.#contentLength = 0;
                index = headerEndIndex + 4; // Skip header + \r\n\r\n
                this.#state = MultipartParserStateBody;
                this.#onItem({ header });
                continue;
            }
            if (this.#state === MultipartParserStateStart) {
                if (chunkLength < this.#openingBoundaryLength) {
                    this.#buffer = chunk;
                    break;
                }
                if (this.#atStartOfStream && this.#findOpeningBoundary(chunk) === 0) {
                    index = this.#openingBoundaryLength;
                    this.#state = MultipartParserStateAfterBoundary;
                    continue;
                }
                let boundaryIndex = this.#findBoundary(chunk);
                if (boundaryIndex === -1) {
                    // RFC 2046 preamble: keep a tail so the opening boundary can be
                    // split across chunks.
                    let keep = this.#boundaryLength - 1;
                    if (chunkLength <= keep) {
                        this.#buffer = chunk;
                    }
                    else {
                        this.#atStartOfStream = false;
                        this.#buffer = chunk.subarray(chunkLength - keep);
                    }
                    break;
                }
                index = boundaryIndex + this.#boundaryLength;
                this.#state = MultipartParserStateAfterBoundary;
            }
        }
    }
    #append(chunk) {
        if (chunk.length === 0) {
            return;
        }
        if (this.#contentLength + chunk.length > this.#maxFileSize) {
            throw new MaxFileSizeExceededError(this.#maxFileSize);
        }
        if (this.#totalContentLength + chunk.length > this.#maxTotalSize) {
            throw new MaxTotalSizeExceededError(this.#maxTotalSize);
        }
        this.#contentLength += chunk.length;
        this.#totalContentLength += chunk.length;
        this.#onItem(chunk);
    }
    #analyzeCarryBoundary(carry, chunk) {
        let totalLength = carry.length + chunk.length;
        for (let start = 0; start < carry.length; ++start) {
            let availableLength = totalLength - start;
            let compareLength = Math.min(this.#boundaryLength, availableLength);
            let matched = true;
            for (let i = 0; i < compareLength; ++i) {
                let sourceIndex = start + i;
                let sourceByte = sourceIndex < carry.length ? carry[sourceIndex] : chunk[sourceIndex - carry.length];
                if (sourceByte !== this.#boundaryBytes[i]) {
                    matched = false;
                    break;
                }
            }
            if (!matched) {
                continue;
            }
            if (availableLength >= this.#boundaryLength) {
                return { kind: 'full', start };
            }
            return { kind: 'partial', start };
        }
        return { kind: 'none' };
    }
    finish() {
        if (this.#state === MultipartParserStateClosingBoundary) {
            if (this.#buffer !== null && this.#buffer.length > 0) {
                throw new MultipartParseError('Invalid multipart boundary ending');
            }
            this.#state = MultipartParserStateDone;
        }
        if (this.#state === MultipartParserStateEpilogue) {
            this.#state = MultipartParserStateDone;
        }
        if (this.#state !== MultipartParserStateDone) {
            throw new MultipartParseError('Multipart stream not finished');
        }
    }
}
class MultipartReader {
    #reader;
    #scanner;
    #maxParts;
    #partCount = 0;
    #items = [];
    #index = 0;
    #inputDone = false;
    #failed = false;
    #error = undefined;
    #scanError = undefined;
    #current = null;
    constructor(stream, boundary, limits) {
        this.#reader = stream.getReader();
        this.#maxParts = limits.maxParts;
        this.#scanner = new MultipartScanner(boundary, limits, (item) => this.#items.push(item));
    }
    async *parts() {
        let finished = false;
        try {
            while (true) {
                let item = this.take();
                if (item === pending)
                    item = await this.next();
                if (item === undefined) {
                    finished = true;
                    return;
                }
                // Content and part ends are consumed by the part they belong to, so this is a header.
                if (++this.#partCount > this.#maxParts) {
                    throw new MaxPartsExceededError(this.#maxParts);
                }
                let content = new PartContent(this);
                this.#current = content;
                yield new MultipartPart(item.header, content);
                if (!content.ended)
                    await content.settle();
            }
        }
        catch (error) {
            this.#fail(error);
            throw error;
        }
        finally {
            if (!finished) {
                this.#fail(new MultipartParseError('Multipart parsing was stopped before the end of the stream'));
            }
        }
    }
    // Returns the next item in message order, or `undefined` at the end of the message. Only one
    // caller reads at a time: the current part's content, or `parts()` once it is settled.
    async next() {
        while (true) {
            let item = this.take();
            if (item !== pending)
                return item;
            await this.read();
        }
    }
    // Returns the next item that has already been scanned, or `pending` if more input must be read
    // first. Reading scanned items synchronously avoids an await per item for small parts.
    take() {
        if (this.#failed)
            throw this.#error;
        if (this.#index < this.#items.length)
            return this.#items[this.#index++];
        // Report a scan error only after the items scanned before it have been read.
        if (this.#scanError !== undefined) {
            this.#fail(this.#scanError);
            throw this.#scanError;
        }
        return this.#inputDone ? undefined : pending;
    }
    // Reads and scans the next chunk of input.
    async read() {
        try {
            let result = await this.#reader.read();
            if (result.done) {
                this.#inputDone = true;
                this.#reader.releaseLock();
                this.#scanner.finish();
            }
            else if (result.value.length > 0) {
                this.#items = [];
                this.#index = 0;
                try {
                    this.#scanner.write(result.value);
                }
                catch (error) {
                    this.#scanError = error;
                }
            }
        }
        catch (error) {
            this.#fail(error);
            throw error;
        }
    }
    #fail(error) {
        if (this.#failed)
            return;
        this.#failed = true;
        this.#error = error;
        this.#current?.fail();
        if (!this.#inputDone) {
            this.#inputDone = true;
            this.#reader.cancel(error).catch(() => { });
        }
    }
}
// The content of one part. It is read at most once, through `chunks()`.
class PartContent {
    #reader;
    #started = false;
    #ended = false;
    #discarding = false;
    #settled = Promise.withResolvers();
    constructor(reader) {
        this.#reader = reader;
    }
    get ended() {
        return this.#ended;
    }
    get used() {
        return this.#started;
    }
    async *chunks() {
        this.#start();
        try {
            while (true) {
                if (this.#discarding) {
                    throw new TypeError('Multipart part body is no longer available after moving to the next part');
                }
                let item = this.#reader.take();
                if (item === pending) {
                    await this.#reader.read();
                }
                else if (item instanceof Uint8Array) {
                    yield item;
                }
                else if (item === partEnd) {
                    this.#ended = true;
                    return;
                }
                else {
                    // The scanner throws before the message ends inside a part, and only ends parts it started.
                    throw new MultipartParseError('Unexpected multipart part boundary');
                }
            }
        }
        finally {
            this.#discarding ||= !this.#ended;
            this.#settled.resolve();
        }
    }
    // Reads all of the content. Content that has already been scanned is collected synchronously.
    async readAll() {
        this.#start();
        let chunks = [];
        try {
            if (this.#discarding) {
                throw new TypeError('Multipart part body is no longer available after moving to the next part');
            }
            while (true) {
                let item = this.#reader.take();
                if (item === pending) {
                    await this.#reader.read();
                }
                else if (item instanceof Uint8Array) {
                    chunks.push(item);
                }
                else if (item === partEnd) {
                    this.#ended = true;
                    return chunks;
                }
                else {
                    throw new MultipartParseError('Unexpected multipart part boundary');
                }
            }
        }
        finally {
            this.#discarding ||= !this.#ended;
            this.#settled.resolve();
        }
    }
    // Waits for a read that is in progress to finish, then discards whatever is left of the content.
    async settle() {
        if (this.#started)
            await this.#settled.promise;
        if (this.#ended)
            return;
        this.#discarding = true;
        while (true) {
            let item = this.#reader.take();
            if (item === pending) {
                await this.#reader.read();
            }
            else if (item === partEnd) {
                break;
            }
            else if (!(item instanceof Uint8Array)) {
                throw new MultipartParseError('Unexpected multipart part boundary');
            }
        }
        this.#ended = true;
    }
    #start() {
        if (this.#started) {
            throw new TypeError('Multipart part body has already been used');
        }
        this.#started = true;
    }
    // Stops waiting for a read in progress, which fails on its own when it next reads from the message.
    fail() {
        this.#settled.resolve();
    }
}
/**
 * A part of a `multipart/*` HTTP message, yielded as soon as its headers arrive. Its content is
 * streamed from the message and can be read once, with {@link MultipartPart.body},
 * {@link MultipartPart.bytes}, {@link MultipartPart.text}, or `for await...of`.
 */
export class MultipartPart {
    #header;
    #headers;
    #content;
    #body;
    /**
     * @param header The raw header bytes
     * @param content The part's content
     */
    constructor(header, content) {
        this.#header = header;
        this.#content = content;
    }
    /**
     * A stream of this part's content. Accessing it starts reading the content, so the next part
     * isn't yielded until the stream is read to the end, canceled, or errors.
     */
    get body() {
        if (this.#body === undefined) {
            let chunks = this.#content.chunks();
            // Start reading now. A stream doesn't pull until after its start step, so a read that begins
            // before moving to the next part could otherwise be discarded before its first pull.
            let first = chunks.next();
            first.catch(() => { });
            this.#body = new ReadableStream({
                async pull(controller) {
                    let result = await (first ?? chunks.next());
                    first = undefined;
                    if (result.done) {
                        controller.close();
                    }
                    else {
                        controller.enqueue(result.value);
                    }
                },
                async cancel() {
                    await chunks.return();
                },
            }, { highWaterMark: 0 });
        }
        return this.#body;
    }
    /**
     * True once this part's content has been read, a read of it has started, or its
     * {@link MultipartPart.body} has been accessed.
     */
    get bodyUsed() {
        return this.#content.used;
    }
    /**
     * The decoded headers associated with this part, keyed by lower-case header name.
     */
    get headers() {
        if (!this.#headers) {
            this.#headers = parseMultipartHeaders(decodeUtf8(this.#header));
        }
        return this.#headers;
    }
    /**
     * True if this part originated from a file upload.
     */
    get isFile() {
        return this.filename !== undefined || this.mediaType === 'application/octet-stream';
    }
    /**
     * The filename from the part's `Content-Disposition` header, preferring a decoded `filename*`
     * over `filename` when available. This is untrusted client input without filesystem sanitization.
     * Do not use it, or a `File.name` derived from it, directly as a filesystem path. Generate a
     * storage name in your application instead.
     */
    get filename() {
        return ContentDisposition.from(this.headers['content-disposition'] ?? null).preferredFilename;
    }
    /**
     * The media type of the part.
     */
    get mediaType() {
        return ContentType.from(this.headers['content-type'] ?? null).mediaType;
    }
    /**
     * The name of the part, usually the `name` of the field in the `<form>` that submitted the request.
     */
    get name() {
        return ContentDisposition.from(this.headers['content-disposition'] ?? null).name;
    }
    /**
     * Reads all of this part's content into a single `Uint8Array`.
     *
     * @returns A promise that resolves to the part's content
     */
    async bytes() {
        return concat(await this.#content.readAll());
    }
    /**
     * Reads all of this part's content as a UTF-8 string. In `multipart/form-data` messages, this is
     * useful for reading the value of parts that originated from `<input type="text">` fields.
     *
     * Note: Do not use this for binary data, use `part.body` or `part.bytes()` instead.
     *
     * @returns A promise that resolves to the part's content as a string
     */
    async text() {
        let chunks = await this.#content.readAll();
        // Most text fields arrive in a single chunk, so decode it without copying.
        return decodeUtf8(chunks.length === 1 ? chunks[0] : concat(chunks));
    }
    /**
     * Iterates over the chunks of this part's content.
     *
     * @returns An async iterator of the part's content chunks
     */
    [Symbol.asyncIterator]() {
        return this.#content.chunks();
    }
}
function concat(chunks) {
    let size = 0;
    for (let chunk of chunks)
        size += chunk.length;
    let buffer = new Uint8Array(size);
    let offset = 0;
    for (let chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
    }
    return buffer;
}
