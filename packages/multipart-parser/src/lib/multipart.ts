import Headers from '@remix-run/headers'

import { readStream } from './read-stream.ts'
import type { SearchFunction, PartialTailSearchFunction } from './buffer-search.ts'
import { createSearch, createPartialTailSearch } from './buffer-search.ts'

/**
 * The base class for errors thrown by the multipart parser.
 */
export class MultipartParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MultipartParseError'
  }
}

/**
 * An error thrown when the maximum allowed size of a header is exceeded.
 */
export class MaxHeaderSizeExceededError extends MultipartParseError {
  constructor(maxHeaderSize: number) {
    super(`Multipart header size exceeds maximum allowed size of ${maxHeaderSize} bytes`)
    this.name = 'MaxHeaderSizeExceededError'
  }
}

/**
 * An error thrown when the maximum allowed size of a file is exceeded.
 */
export class MaxFileSizeExceededError extends MultipartParseError {
  constructor(maxFileSize: number) {
    super(`File size exceeds maximum allowed size of ${maxFileSize} bytes`)
    this.name = 'MaxFileSizeExceededError'
  }
}

export type MultipartPartType<S extends boolean | undefined> = S extends true ? MultipartPart : MultipartContentPart

export interface ParseMultipartOptions<S extends boolean | undefined> {
  /**
   * The boundary string used to separate parts in the multipart message,
   * e.g. the `boundary` parameter in the `Content-Type` header.
   */
  boundary: string
  /**
   * The maximum allowed size of a header in bytes. If an individual part's header
   * exceeds this size, a `MaxHeaderSizeExceededError` will be thrown.
   *
   * Default: 8 KiB
   */
  maxHeaderSize?: number
  /**
   * The maximum allowed size of a file in bytes. If an individual part's content
   * exceeds this size, a `MaxFileSizeExceededError` will be thrown.
   *
   * Default: 2 MiB
   */
  maxFileSize?: number

  /**
   * If `true`, the parser will only store the size of each part's content,
   * and will not store the actual content in memory. You must set `onEmitBytes`
   * to get the content of each part as it is received.
   * 
   * This is useful for handling large file uploads without consuming
   * large amounts of memory.
   * 
   * If this is set to `true`, the `content`, `bytes`, and `text` properties of each part
   * will be undefined, and only the `size` property will be available.
   * 
   * Default: `false`
   */
  onlyStreamContents?: S

  /**
   * A callback that is called each time a new part is created. This can be used to
   * perform any setup or initialization for the part before any data is received.
   * 
   * The part will contain the full header information, but the content will be empty.
   * 
   * The callback will be awaited so you can return a promise to create backpressure.
   * 
   * @param part The multipart part that was just created
   * @returns Promise to be awaited before continuing parsing
   */
  onCreatePart?(part: MultipartPartType<S>): Promise<void> | void

  /**
   * A callback that is called each time a chunk of bytes is received and parsed.
   * This can be used to process the data as it is received, to stream 
   * it to disk or to a cloud storage service.
   * 
   * The callback will be awaited so you can return a promise to create backpressure.
   * 
   * @param part The multipart part being emitted
   * @param chunk The chunk of data being emitted
   * @returns Promise to be awaited before continuing parsing
   */
  onEmitBytes?(part: MultipartPartType<S>, chunk: Uint8Array): Promise<void> | void

}

/**
 * Parse a `multipart/*` message from a buffer/iterable and yield each part as a `MultipartPart` object.
 *
 * Note: This is a low-level API that requires manual handling of the content and boundary. If you're
 * building a web server, consider using `parseMultipartRequest(request)` instead.
 *
 * @param message The multipart message as a `Uint8Array` or an iterable of `Uint8Array` chunks
 * @param options Options for the parser
 * @return A generator that yields `MultipartPart` objects
 */
export async function* parseMultipart<S extends boolean | undefined>(
  message: Uint8Array | Iterable<Uint8Array>,
  options: ParseMultipartOptions<S>,
): AsyncGenerator<MultipartPartType<S>, void, unknown> {
  let parser = new MultipartParser<S>(options.boundary, {
    maxHeaderSize: options.maxHeaderSize,
    maxFileSize: options.maxFileSize,
  })

  if (message instanceof Uint8Array) {
    if (message.length === 0) {
      return // No data to parse
    }

    yield* parser.write(message)
  } else {
    for (let chunk of message) {
      yield* parser.write(chunk)
    }
  }

  parser.finish()
}

/**
 * Parse a `multipart/*` message stream and yield each part as a `MultipartPart` object.
 *
 * Note: This is a low-level API that requires manual handling of the content and boundary. If you're
 * building a web server, consider using `parseMultipartRequest(request)` instead.
 *
 * @param stream A stream containing multipart data as a `ReadableStream<Uint8Array>`
 * @param options Options for the parser
 * @return An async generator that yields `MultipartPart` objects
 */
export async function* parseMultipartStream<S extends boolean | undefined>(
  stream: ReadableStream<Uint8Array>,
  options: ParseMultipartOptions<S>,
): AsyncGenerator<MultipartPartType<S>, void, unknown> {
  let parser = new MultipartParser<S>(options.boundary, {
    maxHeaderSize: options.maxHeaderSize,
    maxFileSize: options.maxFileSize,
  })

  for await (let chunk of readStream(stream)) {
    if (chunk.length === 0) {
      continue // No data to parse
    }

    yield* parser.write(chunk)
  }

  parser.finish()
}

export type MultipartParserOptions<S extends boolean | undefined> = Omit<ParseMultipartOptions<S>, 'boundary'>

const MultipartParserStateStart = 0
const MultipartParserStateAfterBoundary = 1
const MultipartParserStateHeader = 2
const MultipartParserStateBody = 3
const MultipartParserStateDone = 4

const findDoubleNewline = createSearch('\r\n\r\n')

const oneKb = 1024
const oneMb = 1024 * oneKb

/**
 * A streaming parser for `multipart/*` HTTP messages.
 */
export class MultipartParser<S extends boolean | undefined> {
  readonly boundary: string
  readonly maxHeaderSize: number
  readonly maxFileSize: number

  #findOpeningBoundary: SearchFunction
  #openingBoundaryLength: number
  #findBoundary: SearchFunction
  #findPartialTailBoundary: PartialTailSearchFunction
  #boundaryLength: number

  #state = MultipartParserStateStart
  #buffer: Uint8Array | null = null
  #currentPart: MultipartContentPart | MultipartPart | null = null
  #contentLength = 0

  #onlyStreamContents: boolean
  #onCreatePart?: (part: MultipartPart) => Promise<void> | void
  #onEmitBytes?: (part: MultipartPart, chunk: Uint8Array) => Promise<void> | void

  constructor(boundary: string, options?: MultipartParserOptions<any>) {
    this.boundary = boundary
    this.maxHeaderSize = options?.maxHeaderSize ?? 8 * oneKb
    this.maxFileSize = options?.maxFileSize ?? 2 * oneMb

    this.#findOpeningBoundary = createSearch(`--${boundary}`)
    this.#openingBoundaryLength = 2 + boundary.length // length of '--' + boundary
    this.#findBoundary = createSearch(`\r\n--${boundary}`)
    this.#findPartialTailBoundary = createPartialTailSearch(`\r\n--${boundary}`)
    this.#boundaryLength = 4 + boundary.length // length of '\r\n--' + boundary

    this.#onCreatePart = options?.onCreatePart
    this.#onEmitBytes = options?.onEmitBytes
    this.#onlyStreamContents = options?.onlyStreamContents ?? false
  }

  /**
   * Write a chunk of data to the parser.
   *
   * @param chunk A chunk of data to write to the parser
   * @return A generator yielding `MultipartPart` objects as they are parsed
   */
  write(chunk: Uint8Array): AsyncGenerator<MultipartPartType<S>, void, unknown>;
  async *write(chunk: Uint8Array): AsyncGenerator<MultipartPart | MultipartContentPart, void, unknown> {
    if (this.#state === MultipartParserStateDone) {
      throw new MultipartParseError('Unexpected data after end of stream')
    }

    let index = 0
    let chunkLength = chunk.length

    if (this.#buffer !== null) {
      let newChunk = new Uint8Array(this.#buffer.length + chunkLength)
      newChunk.set(this.#buffer, 0)
      newChunk.set(chunk, this.#buffer.length)
      chunk = newChunk
      chunkLength = chunk.length
      this.#buffer = null
    }

    while (true) {
      if (this.#state === MultipartParserStateBody) {
        if (chunkLength - index < this.#boundaryLength) {
          this.#buffer = chunk.subarray(index)
          break
        }

        let boundaryIndex = this.#findBoundary(chunk, index)

        if (boundaryIndex === -1) {
          // No boundary found, but there may be a partial match at the end of the chunk.
          let partialTailIndex = this.#findPartialTailBoundary(chunk)

          if (partialTailIndex === -1) {
            await this.#append(index === 0 ? chunk : chunk.subarray(index))
          } else {
            await this.#append(chunk.subarray(index, partialTailIndex))
            this.#buffer = chunk.subarray(partialTailIndex)
          }

          break
        }

        await this.#append(chunk.subarray(index, boundaryIndex))

        yield this.#currentPart!

        index = boundaryIndex + this.#boundaryLength

        this.#state = MultipartParserStateAfterBoundary
      }

      if (this.#state === MultipartParserStateAfterBoundary) {
        if (chunkLength - index < 2) {
          this.#buffer = chunk.subarray(index)
          break
        }

        if (chunk[index] === 45 && chunk[index + 1] === 45) {
          this.#state = MultipartParserStateDone
          break
        }

        index += 2 // Skip \r\n after boundary

        this.#state = MultipartParserStateHeader
      }

      if (this.#state === MultipartParserStateHeader) {
        if (chunkLength - index < 4) {
          this.#buffer = chunk.subarray(index)
          break
        }

        let headerEndIndex = findDoubleNewline(chunk, index)

        if (headerEndIndex === -1) {
          if (chunkLength - index > this.maxHeaderSize) {
            throw new MaxHeaderSizeExceededError(this.maxHeaderSize)
          }

          this.#buffer = chunk.subarray(index)
          break
        }

        if (headerEndIndex - index > this.maxHeaderSize) {
          throw new MaxHeaderSizeExceededError(this.maxHeaderSize)
        }

        const header = chunk.subarray(index, headerEndIndex)
        this.#currentPart = this.#onlyStreamContents
          ? new MultipartPart(header)
          : new MultipartContentPart(header, [])

        this.#contentLength = 0

        index = headerEndIndex + 4 // Skip header + \r\n\r\n

        this.#state = MultipartParserStateBody

        await this.#onCreatePart?.(this.#currentPart)

        continue
      }

      if (this.#state === MultipartParserStateStart) {
        if (chunkLength < this.#openingBoundaryLength) {
          this.#buffer = chunk
          break
        }

        if (this.#findOpeningBoundary(chunk) !== 0) {
          throw new MultipartParseError('Invalid multipart stream: missing initial boundary')
        }

        index = this.#openingBoundaryLength

        this.#state = MultipartParserStateAfterBoundary
      }
    }
  }

  async #append(chunk: Uint8Array): Promise<void> {
    if (this.#contentLength + chunk.length > this.maxFileSize) {
      throw new MaxFileSizeExceededError(this.maxFileSize)
    }

    if (this.#currentPart!.hasContents()) {
      this.#currentPart!.content.push(chunk)
    } else {
      this.#currentPart!.size += chunk.length
    }

    await this.#onEmitBytes?.(this.#currentPart!, chunk)

    this.#contentLength += chunk.length
  }

  /**
   * Should be called after all data has been written to the parser.
   *
   * Note: This will throw if the multipart message is incomplete or
   * wasn't properly terminated.
   *
   * @return void
   */
  finish(): void {
    if (this.#state !== MultipartParserStateDone) {
      throw new MultipartParseError('Multipart stream not finished')
    }
  }
}

const decoder = new TextDecoder('utf-8', { fatal: true })

/**
 * A part of a `multipart/*` HTTP message.
 */
export class MultipartPart {

  #header: Uint8Array
  #headers?: Headers
  #size: number = 0

  constructor(header: Uint8Array) {
    this.#header = header
  }

  /**
   * The size of the content emitted so far in bytes.
   */
  get size(): number {
    return this.#size
  }
  set size(value: number) {
    this.#size = value
  }

  /**
   * The headers associated with this part.
   */
  get headers(): Headers {
    if (!this.#headers) {
      this.#headers = new Headers(decoder.decode(this.#header))
    }

    return this.#headers
  }

  /**
   * True if this part originated from a file upload.
   */
  get isFile(): boolean {
    return this.filename !== undefined || this.mediaType === 'application/octet-stream'
  }

  /**
   * True if this part originated from a text input field in a form submission.
   */
  get isText(): boolean {
    return !this.isFile
  }

  /**
   * The filename of the part, if it is a file upload.
   */
  get filename(): string | undefined {
    return this.headers.contentDisposition.preferredFilename
  }

  /**
   * The media type of the part.
   */
  get mediaType(): string | undefined {
    return this.headers.contentType.mediaType
  }

  /**
   * The name of the part, usually the `name` of the field in the `<form>` that submitted the request.
   */
  get name(): string | undefined {
    return this.headers.contentDisposition.name
  }

  hasContents(): this is MultipartContentPart {
    return false;
  }

}

export class MultipartContentPart extends MultipartPart {

  /**
   * The raw content of this part as an array of `Uint8Array` chunks.
   */
  readonly content: Uint8Array[]

  constructor(header: Uint8Array, content: Uint8Array[]) {
    super(header);
    this.content = content
  }

  /**
   * The content of this part as an `ArrayBuffer`.
   */
  get arrayBuffer(): ArrayBuffer {
    return this.bytes.buffer as ArrayBuffer
  }

  /**
   * The content of this part as a single `Uint8Array`. In `multipart/form-data` messages, this is useful
   * for reading the value of files that were uploaded using `<input type="file">` fields.
   */
  get bytes(): Uint8Array {
    let buffer = new Uint8Array(this.size)

    let offset = 0
    for (let chunk of this.content) {
      buffer.set(chunk, offset)
      offset += chunk.length
    }

    return buffer
  }

  /**
   * The size of the content in bytes.
   */
  get size(): number {
    let size = 0

    for (let chunk of this.content) {
      size += chunk.length
    }

    return size
  }

  /**
   * The content of this part as a string. In `multipart/form-data` messages, this is useful for
   * reading the value of parts that originated from `<input type="text">` fields.
   *
   * Note: Do not use this for binary data, use `part.bytes` or `part.arrayBuffer` instead.
   */
  get text(): string {
    return decoder.decode(this.bytes)
  }

  hasContents(): this is MultipartContentPart {
    return true;
  }
}
