import {
  type MultipartParserOptions,
  type MultipartPart,
  MaxFileSizeExceededError,
  MaxHeaderSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
  isMultipartRequest,
  parseMultipartRequest,
} from '@remix-run/multipart-parser'

/**
 * The base class for errors thrown by the form data parser.
 */
export class FormDataParseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'FormDataParseError'
  }
}

/**
 * An error thrown when the maximum number of files allowed in a request is exceeded.
 */
export class MaxFilesExceededError extends FormDataParseError {
  constructor(maxFiles: number) {
    super(`Maximum number of files exceeded: ${maxFiles}`)
    this.name = 'MaxFilesExceededError'
  }
}

/**
 * A file that was uploaded as part of a `multipart/form-data` request.
 */
export class FileUpload extends File {
  /**
   * The name of the `<input>` field used to upload the file.
   */
  readonly fieldName: string

  constructor(part: MultipartPart, fieldName: string) {
    super(part.content as BlobPart[], part.filename ?? 'file-upload', {
      type: part.mediaType ?? 'application/octet-stream',
    })

    this.fieldName = fieldName
  }
}

/**
 * A function used for handling file uploads.
 *
 * @param file The uploaded file
 * @returns A value to store in `FormData`, or `void`/`null` to skip
 */
export interface FileUploadHandler {
  /**
   * Transforms an uploaded file into the value stored in the parsed {@link FormData}.
   */
  (file: FileUpload): void | null | string | Blob | Promise<void | null | string | Blob>
}

function defaultFileUploadHandler(file: FileUpload): File {
  // By default just keep the file around in memory.
  return file
}

const oneKb = 1024
const oneMb = oneKb * oneKb
const defaultMaxFiles = 20
const defaultMaxFileSize = 2 * oneMb
const defaultMaxParts = 1000

function isParserLimitError(error: unknown): boolean {
  return (
    error instanceof MaxHeaderSizeExceededError ||
    error instanceof MaxFileSizeExceededError ||
    error instanceof MaxPartsExceededError ||
    error instanceof MaxTotalSizeExceededError
  )
}

async function* parseFormDataParts(
  request: Request,
  parserOptions: MultipartParserOptions,
): AsyncGenerator<MultipartPart, void, unknown> {
  try {
    yield* parseMultipartRequest(request, parserOptions)
  } catch (error) {
    if (error instanceof FormDataParseError || isParserLimitError(error)) {
      throw error
    }

    throw new FormDataParseError('Cannot parse form data', { cause: error })
  }
}

function isUrlEncodedRequest(request: Request): boolean {
  let contentType = request.headers.get('Content-Type')
  return contentType != null && contentType.startsWith('application/x-www-form-urlencoded')
}

function validateUrlEncodedPartCount(partCount: number, maxParts: number): void {
  if (partCount > maxParts) {
    throw new MaxPartsExceededError(maxParts)
  }
}

async function readUrlEncodedBody(
  request: Request,
  maxParts: number,
  maxTotalSize: number,
): Promise<Uint8Array> {
  if (request.body == null) {
    return new Uint8Array()
  }

  let reader = request.body.getReader()
  let chunks: Uint8Array[] = []
  let partCount = 0
  let totalSize = 0
  let hasPartBytes = false

  try {
    while (true) {
      let result = await reader.read()
      if (result.done) break

      totalSize += result.value.length
      if (totalSize > maxTotalSize) {
        throw new MaxTotalSizeExceededError(maxTotalSize)
      }

      for (let byte of result.value) {
        if (byte === 38) {
          if (hasPartBytes) {
            validateUrlEncodedPartCount(++partCount, maxParts)
            hasPartBytes = false
          }
        } else {
          hasPartBytes = true
        }
      }

      chunks.push(result.value)
    }

    if (hasPartBytes) {
      validateUrlEncodedPartCount(++partCount, maxParts)
    }
  } finally {
    reader.releaseLock()
  }

  let body = new Uint8Array(totalSize)
  let offset = 0

  for (let chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.length
  }

  return body
}

let urlEncodedDecoder: TextDecoder | undefined

async function parseUrlEncodedFormData(
  request: Request,
  maxParts: number,
  maxTotalSize: number,
): Promise<FormData> {
  let bytes = await readUrlEncodedBody(request, maxParts, maxTotalSize)
  urlEncodedDecoder ??= new TextDecoder()

  let searchParams = new URLSearchParams(urlEncodedDecoder.decode(bytes as BufferSource))
  let formData = new FormData()

  for (let [name, value] of searchParams) {
    formData.append(name, value)
  }

  return formData
}

/**
 * Options for parsing form data.
 */
export interface ParseFormDataOptions extends MultipartParserOptions {
  /**
   * The maximum number of files that can be uploaded in a single request. If this limit is
   * exceeded, a `MaxFilesExceededError` will be thrown.
   *
   * @default 20
   */
  maxFiles?: number
}

/**
 * Parses a [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) body into a [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
 * object. This is useful when accessing the data contained in a HTTP `multipart/form-data` request
 * generated by a HTML `<form>` element.
 *
 * This is a drop-in replacement for [the built-in `request.formData()` API](https://developer.mozilla.org/en-US/docs/Web/API/Request/formData)
 * with the main difference being the ability to customize the handling of file uploads. Instead of
 * keeping all files in memory, the `uploadHandler` allows you to store the file on disk or a
 * cloud storage service.
 *
 * @param request The `Request` object to parse
 * @param uploadHandler A function that handles file uploads. It receives a `File` object and may return any value that is valid in a `FormData` object
 * @returns A `Promise` that resolves to a `FormData` object containing the parsed data
 */
export async function parseFormData(
  request: Request,
  uploadHandler?: FileUploadHandler,
): Promise<FormData>
/**
 * @param request The `Request` object to parse
 * @param options Options for the parser
 * @param uploadHandler A function that handles file uploads. It receives a `File` object and may return any value that is valid in a `FormData` object
 */
export async function parseFormData(
  request: Request,
  options?: ParseFormDataOptions,
  uploadHandler?: FileUploadHandler,
): Promise<FormData>
export async function parseFormData(
  request: Request,
  optionsOrUploadHandler?: ParseFormDataOptions | FileUploadHandler,
  uploadHandler?: FileUploadHandler,
): Promise<FormData> {
  if (typeof optionsOrUploadHandler === 'function') {
    uploadHandler = optionsOrUploadHandler
    optionsOrUploadHandler = {}
  } else if (optionsOrUploadHandler == null) {
    optionsOrUploadHandler = {}
  }
  if (uploadHandler == null) {
    uploadHandler = defaultFileUploadHandler
  }

  let {
    maxFiles = defaultMaxFiles,
    maxHeaderSize,
    maxFileSize = defaultMaxFileSize,
    maxParts = defaultMaxParts,
    maxTotalSize = maxFiles * maxFileSize + oneMb,
  } = optionsOrUploadHandler

  if (isUrlEncodedRequest(request)) {
    try {
      return await parseUrlEncodedFormData(request, maxParts, maxTotalSize)
    } catch (error) {
      if (error instanceof FormDataParseError || isParserLimitError(error)) {
        throw error
      }

      throw new FormDataParseError('Cannot parse form data', { cause: error })
    }
  }

  if (!isMultipartRequest(request)) {
    try {
      return await request.formData()
    } catch (error) {
      throw new FormDataParseError('Cannot parse form data', { cause: error })
    }
  }

  let parserOptions: MultipartParserOptions = {
    maxHeaderSize,
    maxFileSize,
    maxParts,
    maxTotalSize,
  }

  let formData = new FormData()
  let fileCount = 0

  for await (let part of parseFormDataParts(request, parserOptions)) {
    let fieldName = part.name
    if (!fieldName) continue

    if (part.isFile) {
      if (++fileCount > maxFiles) {
        throw new MaxFilesExceededError(maxFiles)
      }

      let value = await uploadHandler(new FileUpload(part, fieldName))
      if (value != null) {
        formData.append(fieldName, value)
      }
    } else {
      formData.append(fieldName, part.text)
    }
  }

  return formData
}
