import { ContentType } from '@remix-run/headers/content-type';
import { MaxFileSizeExceededError, MaxHeaderSizeExceededError, MaxPartsExceededError, MaxTotalSizeExceededError, isMultipartRequest, parseMultipartRequest, } from '@remix-run/multipart-parser';
/**
 * The base class for errors thrown by the form data parser.
 */
export class FormDataParseError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = 'FormDataParseError';
    }
}
/**
 * An error thrown when the maximum number of files allowed in a request is exceeded.
 */
export class MaxFilesExceededError extends FormDataParseError {
    constructor(maxFiles) {
        super(`Maximum number of files exceeded: ${maxFiles}`);
        this.name = 'MaxFilesExceededError';
    }
}
/**
 * A file that was uploaded as part of a `multipart/form-data` request, passed to a
 * {@link FileUploadHandler} as soon as its headers arrive.
 *
 * Its contents are streamed from the request as you read them, so you can store large uploads
 * without holding them in memory. It has the properties and methods of a
 * [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File), with these differences:
 *
 * - Its contents can only be read once, with `stream()`, `bytes()`, `arrayBuffer()`, or `text()`
 * - `size` throws until its contents have been read; limit upload size with `maxFileSize`
 * - `slice()` is not supported
 * - It is not a `File` instance, so pass `stream()` to APIs that read a `File` natively, like
 *   `new Response()`
 *
 * The `name` and `type` properties are untrusted client input from the submitted multipart metadata;
 * they do not validate the file contents. The `name` is not sanitized for filesystem use and must
 * not be used directly as a filesystem path, including on files returned in `FormData`. Generate
 * storage names and validate file contents in your upload handler before using files in
 * application-specific contexts.
 */
// Bun's types give `File` instances a construct signature, so implement the members of `File`
// rather than `File` itself.
export class FileUpload {
    /**
     * The name of the `<input>` field used to upload the file.
     */
    fieldName;
    /**
     * The time the upload was received, in milliseconds since the Unix epoch.
     */
    lastModified = Date.now();
    /**
     * The name of the file, from the multipart `Content-Disposition` header.
     */
    name;
    /**
     * The media type of the file, from the multipart `Content-Type` header.
     */
    type;
    /**
     * Always an empty string.
     */
    webkitRelativePath = '';
    #part;
    #size = null;
    #used = false;
    /**
     * @param part The multipart part containing the file
     * @param fieldName The name of the `<input>` field used to upload the file
     */
    constructor(part, fieldName) {
        this.#part = part;
        this.fieldName = fieldName;
        this.name = part.filename ?? 'file-upload';
        // Normalize the type the same way `File` does on this runtime.
        this.type = new File([], '', { type: part.mediaType ?? 'application/octet-stream' }).type;
    }
    get [Symbol.toStringTag]() {
        return 'FileUpload';
    }
    /**
     * The size of the file in bytes. Throws until the file's contents have been read.
     */
    get size() {
        if (this.#size === null) {
            throw new TypeError('The size of a file upload is not known until its contents have been read. ' +
                'Use the maxFileSize option to limit the size of uploads.');
        }
        return this.#size;
    }
    /**
     * Reads the file's contents into an `ArrayBuffer`.
     *
     * @returns A promise that resolves to the file's contents
     */
    async arrayBuffer() {
        return (await this.bytes()).buffer;
    }
    /**
     * Reads the file's contents into a `Uint8Array`.
     *
     * @returns A promise that resolves to the file's contents
     */
    async bytes() {
        let chunks = await this.#readChunks();
        let buffer = new Uint8Array(this.#size);
        let offset = 0;
        for (let chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
        }
        return buffer;
    }
    /**
     * Parses the file's contents as form data, using its `type` as the content type.
     *
     * @returns A promise that resolves to the parsed `FormData`
     */
    async formData() {
        return new Response(await this.bytes(), { headers: { 'Content-Type': this.type } }).formData();
    }
    /**
     * Parses the file's contents as JSON.
     *
     * @returns A promise that resolves to the parsed value
     */
    async json() {
        return JSON.parse(await this.text());
    }
    /**
     * Not supported, because the file's contents are streamed from the request.
     */
    slice() {
        throw new TypeError('A file upload cannot be sliced');
    }
    /**
     * Returns a stream of the file's contents.
     *
     * @returns A stream of the file's contents
     */
    stream() {
        let chunks = this.#chunks();
        return new ReadableStream({
            async pull(controller) {
                let result = await chunks.next();
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
    /**
     * Reads the file's contents as a UTF-8 string.
     *
     * @returns A promise that resolves to the file's contents
     */
    async text() {
        textDecoder ??= new TextDecoder();
        return textDecoder.decode(await this.bytes());
    }
    /**
     * Throws, so a file upload isn't silently converted to a string by APIs that expect a `File`,
     * like `FormData#append()` or `new Response()`.
     */
    toString() {
        throw new TypeError('Cannot convert a FileUpload to a string. Use .stream() for Response and other streaming APIs.');
    }
    // Marks the upload used and reads its chunks, counting its size and wrapping parse errors.
    #chunks() {
        if (this.#used) {
            throw new TypeError('The contents of a file upload can only be read once');
        }
        if (closedUploads.has(this)) {
            throw new TypeError('The contents of a file upload are not available after the upload handler returns. ' +
                'Read them in the upload handler instead.');
        }
        this.#used = true;
        return countChunks(this.#part, (size) => {
            this.#size = size;
        });
    }
    async #readChunks() {
        let chunks = [];
        for await (let chunk of this.#chunks())
            chunks.push(chunk);
        return chunks;
    }
}
async function* countChunks(part, onDone) {
    let size = 0;
    try {
        for await (let chunk of part) {
            size += chunk.length;
            yield chunk;
        }
    }
    catch (error) {
        throw toFormDataError(error);
    }
    onDone(size);
}
let textDecoder;
// Uploads whose upload handler has returned. Reads that started before then may continue, but new
// reads would find that the parser has discarded the contents.
const closedUploads = new WeakSet();
// A file upload that was read into memory, for when an upload handler returns the upload itself.
export class BufferedFile extends File {
    stream() {
        // Node.js before 24.20.0 and 26.6.0 never frees the contents of a Blob read through
        // `stream()`, so read the file in slices instead (https://github.com/nodejs/node/issues/63574).
        // Remove this override once our minimum supported Node.js version is >=24.20.0.
        let offset = 0;
        return new ReadableStream({
            type: 'bytes',
            pull: async (controller) => {
                if (offset >= this.size) {
                    controller.close();
                    controller.byobRequest?.respond(0);
                    return;
                }
                let chunk = new Uint8Array(await this.slice(offset, offset + streamChunkSize).arrayBuffer());
                offset += chunk.byteLength;
                controller.enqueue(chunk);
            },
        });
    }
}
const streamChunkSize = 64 * 1024;
function defaultFileUploadHandler(file) {
    // By default just keep the file around in memory.
    return file;
}
const oneKb = 1024;
const oneMb = oneKb * oneKb;
const defaultMaxFiles = 20;
const defaultMaxFileSize = 2 * oneMb;
const defaultMaxParts = 1000;
function isParserLimitError(error) {
    return (error instanceof MaxHeaderSizeExceededError ||
        error instanceof MaxFileSizeExceededError ||
        error instanceof MaxPartsExceededError ||
        error instanceof MaxTotalSizeExceededError);
}
function toFormDataError(error) {
    if (error instanceof FormDataParseError || isParserLimitError(error)) {
        return error;
    }
    return new FormDataParseError('Cannot parse form data', { cause: error });
}
function isUrlEncodedRequest(request) {
    let mediaType = ContentType.from(request.headers.get('Content-Type')).mediaType?.toLowerCase();
    return mediaType === 'application/x-www-form-urlencoded';
}
function validateUrlEncodedPartCount(partCount, maxParts) {
    if (partCount > maxParts) {
        throw new MaxPartsExceededError(maxParts);
    }
}
async function readUrlEncodedBody(request, maxParts, maxTotalSize) {
    if (request.body == null) {
        return new Uint8Array();
    }
    let reader = request.body.getReader();
    let chunks = [];
    let partCount = 0;
    let totalSize = 0;
    let hasPartBytes = false;
    try {
        while (true) {
            let result = await reader.read();
            if (result.done)
                break;
            totalSize += result.value.length;
            if (totalSize > maxTotalSize) {
                throw new MaxTotalSizeExceededError(maxTotalSize);
            }
            for (let byte of result.value) {
                if (byte === 38) {
                    if (hasPartBytes) {
                        validateUrlEncodedPartCount(++partCount, maxParts);
                        hasPartBytes = false;
                    }
                }
                else {
                    hasPartBytes = true;
                }
            }
            chunks.push(result.value);
        }
        if (hasPartBytes) {
            validateUrlEncodedPartCount(++partCount, maxParts);
        }
    }
    finally {
        reader.releaseLock();
    }
    let body = new Uint8Array(totalSize);
    let offset = 0;
    for (let chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
    }
    return body;
}
let urlEncodedDecoder;
async function parseUrlEncodedFormData(request, maxParts, maxTotalSize) {
    let bytes = await readUrlEncodedBody(request, maxParts, maxTotalSize);
    urlEncodedDecoder ??= new TextDecoder();
    let searchParams = new URLSearchParams(urlEncodedDecoder.decode(bytes));
    let formData = new FormData();
    for (let [name, value] of searchParams) {
        formData.append(name, value);
    }
    return formData;
}
export async function parseFormData(request, optionsOrUploadHandler, uploadHandler) {
    if (typeof optionsOrUploadHandler === 'function') {
        uploadHandler = optionsOrUploadHandler;
        optionsOrUploadHandler = {};
    }
    else if (optionsOrUploadHandler == null) {
        optionsOrUploadHandler = {};
    }
    if (uploadHandler == null) {
        uploadHandler = defaultFileUploadHandler;
    }
    let { maxFiles = defaultMaxFiles, maxHeaderSize, maxFileSize = defaultMaxFileSize, maxParts = defaultMaxParts, maxTotalSize = maxFiles * maxFileSize + oneMb, } = optionsOrUploadHandler;
    if (isUrlEncodedRequest(request)) {
        try {
            return await parseUrlEncodedFormData(request, maxParts, maxTotalSize);
        }
        catch (error) {
            throw toFormDataError(error);
        }
    }
    if (!isMultipartRequest(request)) {
        throw new FormDataParseError('Cannot parse form data');
    }
    let parserOptions = {
        maxHeaderSize,
        maxFileSize,
        maxParts,
        maxTotalSize,
    };
    let formData = new FormData();
    let fileCount = 0;
    for await (let part of parseFormDataParts(request, parserOptions)) {
        let fieldName = part.name;
        if (!fieldName)
            continue;
        if (part.isFile) {
            if (++fileCount > maxFiles) {
                throw new MaxFilesExceededError(maxFiles);
            }
            let upload = new FileUpload(part, fieldName);
            let value = await uploadHandler(upload);
            closedUploads.add(upload);
            if (value === upload) {
                value = await bufferUpload(part, upload);
            }
            if (value != null) {
                formData.append(fieldName, value);
            }
        }
        else {
            formData.append(fieldName, await readText(part));
        }
    }
    return formData;
}
async function* parseFormDataParts(request, parserOptions) {
    try {
        yield* parseMultipartRequest(request, parserOptions);
    }
    catch (error) {
        throw toFormDataError(error);
    }
}
async function bufferUpload(part, upload) {
    if (part.bodyUsed) {
        throw new TypeError('An upload handler cannot return a file upload after reading its contents. ' +
            'Return the stored file or a reference to it instead.');
    }
    let chunks = [];
    try {
        for await (let chunk of part)
            chunks.push(chunk);
    }
    catch (error) {
        throw toFormDataError(error);
    }
    return new BufferedFile(chunks, upload.name, {
        type: part.mediaType ?? 'application/octet-stream',
        lastModified: upload.lastModified,
    });
}
async function readText(part) {
    try {
        return await part.text();
    }
    catch (error) {
        throw toFormDataError(error);
    }
}
