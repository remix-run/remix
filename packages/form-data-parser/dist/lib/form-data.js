import { isMultipartRequest, parseMultipartRequest, } from '@remix-run/multipart-parser';
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
    if (!isMultipartRequest(request)) {
        try {
            return await request.formData();
        }
        catch (error) {
            throw new FormDataParseError('Cannot parse form data', { cause: error });
        }
    }
    let { maxFiles = 20, ...parserOptions } = optionsOrUploadHandler;
    let formData = new FormData();
    let fileCount = 0;
    try {
        for await (let part of parseMultipartRequest(request, parserOptions)) {
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
    }
    catch (error) {
        if (error instanceof FormDataParseError) {
            throw error;
        }
        throw new FormDataParseError('Cannot parse form data', { cause: error });
    }
    return formData;
}
