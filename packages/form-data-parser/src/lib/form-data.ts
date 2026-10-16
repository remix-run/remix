import { ContentType } from '@remix-run/headers/content-type'

import {
  type MultipartParserOptions,
  type MultipartPart,
  type StreamingMultipartPart,
  MaxFileSizeExceededError,
  MaxHeaderSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
  isMultipartRequest,
  parseMultipartRequest,
  parseStreamingMultipartRequest,
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
 *
 * The `name` and `type` properties are untrusted client input from the submitted multipart metadata;
 * they do not validate the file contents. The `name` is not sanitized for filesystem use and must
 * not be used directly as a filesystem path, including on files returned in `FormData`. Generate
 * storage names and validate file contents in your upload handler before using files in
 * application-specific contexts.
 *
 * When parsing with the `streamFiles` option, upload handlers receive a streaming file upload
 * instead. It has the same properties and methods but is not an instance of `FileUpload`. See
 * {@link ParseFormDataOptions.streamFiles}.
 */
export class FileUpload extends File {
  /**
   * The name of the `<input>` field used to upload the file.
   */
  readonly fieldName: string

  /**
   * @param part The multipart part containing the file
   * @param fieldName The name of the `<input>` field used to upload the file
   */
  constructor(part: Pick<MultipartPart, 'content' | 'filename' | 'mediaType'>, fieldName: string) {
    super(part.content as BlobPart[], part.filename ?? 'file-upload', {
      type: part.mediaType ?? 'application/octet-stream',
    })

    this.fieldName = fieldName
  }

  /**
   * Returns a stream of the file's contents.
   *
   * @returns A byte stream of the file's contents
   */
  stream(): ReadableStream<Uint8Array<ArrayBuffer>> {
    // Node.js before 24.20.0 and 26.6.0 never frees the contents of a Blob read through
    // `stream()`, so read the file in slices instead (https://github.com/nodejs/node/issues/63574).
    // Remove this override once our minimum supported Node.js version is >=24.20.0.
    let offset = 0
    return new ReadableStream({
      type: 'bytes',
      pull: async (controller) => {
        if (offset >= this.size) {
          controller.close()
          controller.byobRequest?.respond(0)
          return
        }
        let chunk = new Uint8Array(await this.slice(offset, offset + streamChunkSize).arrayBuffer())
        offset += chunk.byteLength
        controller.enqueue(chunk)
      },
    })
  }
}

const streamChunkSize = 64 * 1024

// The file upload handlers receive when parsing with `streamFiles`. Its contents are read directly
// from the request as they arrive, so they can only be read once and its size is not known until
// they have been read.
// Bun's types give `File` instances a construct signature, so implement the members of `FileUpload`
// rather than `FileUpload` itself.
class StreamingFileUpload implements Pick<FileUpload, keyof FileUpload> {
  readonly fieldName: string
  readonly lastModified = Date.now()
  readonly name: string
  readonly type: string
  readonly webkitRelativePath = ''

  #part: StreamingMultipartPart
  #size: number | null = null
  #used = false

  constructor(part: StreamingMultipartPart, fieldName: string) {
    this.#part = part
    this.fieldName = fieldName
    this.name = part.filename ?? 'file-upload'
    this.type = normalizeMediaType(part.mediaType ?? 'application/octet-stream')
  }

  get [Symbol.toStringTag](): string {
    return 'StreamingFileUpload'
  }

  get size(): number {
    if (this.#size === null) {
      throw new TypeError(
        'The size of a streamed file upload is not known until its contents have been read',
      )
    }

    return this.#size
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return (await this.bytes()).buffer
  }

  async bytes(): Promise<Uint8Array<ArrayBuffer>> {
    let chunks: Uint8Array[] = []
    let size = 0
    let reader = this.stream().getReader()
    while (true) {
      let result = await reader.read()
      if (result.done) break
      chunks.push(result.value)
      size += result.value.length
    }

    let buffer = new Uint8Array(size)
    let offset = 0
    for (let chunk of chunks) {
      buffer.set(chunk, offset)
      offset += chunk.length
    }

    return buffer
  }

  async formData(): Promise<FormData> {
    return new Response(await this.bytes(), { headers: { 'Content-Type': this.type } }).formData()
  }

  async json(): Promise<any> {
    return JSON.parse(await this.text())
  }

  slice(): never {
    throw new TypeError('A streamed file upload cannot be sliced')
  }

  stream(): ReadableStream<Uint8Array<ArrayBuffer>> {
    if (this.#used) {
      throw new TypeError('The contents of a streamed file upload can only be read once')
    }
    this.#used = true

    let part = this.#part
    let reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>> | undefined
    let size = 0

    // Don't get a reader until the first read, so a stream that is never read doesn't hold up the
    // parser.
    return new ReadableStream(
      {
        pull: async (controller) => {
          reader ??= part.body.getReader()

          let result = await reader.read().catch((error) => {
            throw toFormDataError(error)
          })

          if (result.done) {
            this.#size = size
            controller.close()
          } else {
            size += result.value.length
            controller.enqueue(result.value)
          }
        },
        cancel(reason) {
          return reader === undefined ? part.body.cancel(reason) : reader.cancel(reason)
        },
      },
      { highWaterMark: 0 },
    )
  }

  async text(): Promise<string> {
    textDecoder ??= new TextDecoder()
    return textDecoder.decode(await this.bytes())
  }
}

let textDecoder: TextDecoder | undefined

// Matches how `File` normalizes its `type` option.
function normalizeMediaType(type: string): string {
  return /^[\x20-\x7e]*$/.test(type) ? type.toLowerCase() : ''
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

function toFormDataError(error: unknown): unknown {
  if (error instanceof FormDataParseError || isParserLimitError(error)) {
    return error
  }

  return new FormDataParseError('Cannot parse form data', { cause: error })
}

async function* parseFormDataParts(
  request: Request,
  parserOptions: MultipartParserOptions,
): AsyncGenerator<MultipartPart, void, unknown> {
  try {
    yield* parseMultipartRequest(request, parserOptions)
  } catch (error) {
    throw toFormDataError(error)
  }
}

async function* parseStreamingFormDataParts(
  request: Request,
  parserOptions: MultipartParserOptions,
): AsyncGenerator<StreamingMultipartPart, void, unknown> {
  try {
    yield* parseStreamingMultipartRequest(request, parserOptions)
  } catch (error) {
    throw toFormDataError(error)
  }
}

function isUrlEncodedRequest(request: Request): boolean {
  let mediaType = ContentType.from(request.headers.get('Content-Type')).mediaType?.toLowerCase()
  return mediaType === 'application/x-www-form-urlencoded'
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
  /**
   * Set `true` to pass each file to the `uploadHandler` as soon as its headers arrive, with its
   * contents read directly from the request, instead of buffering the whole file in memory first.
   * This lets you stream large uploads straight to storage:
   *
   * ```ts
   * let formData = await parseFormData(request, { streamFiles: true }, async (upload) => {
   *   let key = `uploads/${crypto.randomUUID()}`
   *   await storage.set(key, upload)
   *   return key
   * })
   * ```
   *
   * Streamed uploads have the same properties and methods as {@link FileUpload}, with these
   * differences:
   *
   * - Their contents can only be read once, with `stream()`, `bytes()`, `arrayBuffer()`, or `text()`
   * - `size` throws until the contents have been read; enforce size limits with `maxFileSize`
   * - `slice()` is not supported
   * - They are not instances of `FileUpload` or `File`
   *
   * Parts are read in order, so the parser waits for the handler, and for any read of the upload
   * it started, to finish before moving on. Contents the handler doesn't read are discarded. If
   * the handler returns the upload itself, its contents are read into memory and stored in the
   * `FormData` like an ordinary `FileUpload`.
   *
   * @default false
   */
  streamFiles?: boolean
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
 * Accepts `multipart/*` and `application/x-www-form-urlencoded` media types.
 * Unsupported media types throw {@link FormDataParseError} before the body is read.
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
    streamFiles = false,
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
    throw new FormDataParseError('Cannot parse form data')
  }

  let parserOptions: MultipartParserOptions = {
    maxHeaderSize,
    maxFileSize,
    maxParts,
    maxTotalSize,
  }

  if (streamFiles) {
    return parseStreamingMultipartFormData(request, parserOptions, maxFiles, uploadHandler)
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

async function parseStreamingMultipartFormData(
  request: Request,
  parserOptions: MultipartParserOptions,
  maxFiles: number,
  uploadHandler: FileUploadHandler,
): Promise<FormData> {
  let formData = new FormData()
  let fileCount = 0

  for await (let part of parseStreamingFormDataParts(request, parserOptions)) {
    let fieldName = part.name
    if (!fieldName) continue

    if (part.isFile) {
      if (++fileCount > maxFiles) {
        throw new MaxFilesExceededError(maxFiles)
      }

      let upload = new StreamingFileUpload(part, fieldName) as unknown as FileUpload
      let value = await uploadHandler(upload)

      if (value === upload) {
        value = await bufferStreamingUpload(part, fieldName)
      }
      if (value != null) {
        formData.append(fieldName, value)
      }
    } else {
      formData.append(fieldName, await readStreamingPartText(part))
    }
  }

  return formData
}

async function bufferStreamingUpload(
  part: StreamingMultipartPart,
  fieldName: string,
): Promise<FileUpload> {
  if (part.bodyUsed) {
    throw new TypeError(
      'An upload handler cannot return a streamed file upload after reading its contents. ' +
        'Return the stored file or a reference to it instead.',
    )
  }

  let content: Uint8Array
  try {
    content = await part.bytes()
  } catch (error) {
    throw toFormDataError(error)
  }

  return new FileUpload(
    { content: [content], filename: part.filename, mediaType: part.mediaType },
    fieldName,
  )
}

async function readStreamingPartText(part: StreamingMultipartPart): Promise<string> {
  try {
    return await part.text()
  } catch (error) {
    throw toFormDataError(error)
  }
}
