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
 * A file that was uploaded as part of a `multipart/form-data` request.
 */
export class FileUpload extends File {
    /**
     * The name of the `<input>` field used to upload the file.
     */
    fieldName;
    constructor(part, fieldName) {
        super(part.content, part.filename ?? 'file-upload', {
            type: part.mediaType ?? 'application/octet-stream',
        });
        this.fieldName = fieldName;
    }
}
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
async function* parseFormDataParts(request, parserOptions) {
    try {
        yield* parseMultipartRequest(request, parserOptions);
    }
    catch (error) {
        if (error instanceof FormDataParseError || isParserLimitError(error)) {
            throw error;
        }
        throw new FormDataParseError('Cannot parse form data', { cause: error });
    }
}
function isUrlEncodedRequest(request) {
    let contentType = request.headers.get('Content-Type');
    return contentType != null && contentType.startsWith('application/x-www-form-urlencoded');
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
            if (error instanceof FormDataParseError || isParserLimitError(error)) {
                throw error;
            }
            throw new FormDataParseError('Cannot parse form data', { cause: error });
        }
    }
    if (!isMultipartRequest(request)) {
        try {
            return await request.formData();
        }
        catch (error) {
            throw new FormDataParseError('Cannot parse form data', { cause: error });
        }
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
            let value = await uploadHandler(new FileUpload(part, fieldName));
            if (value != null) {
                formData.append(fieldName, value);
            }
        }
        else {
            formData.append(fieldName, part.text);
        }
    }
    return formData;
}
