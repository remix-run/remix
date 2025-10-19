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

export interface ParseMultipartOptions {
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
}

/**
 * Parse a `multipart/*` message from a buffer/iterable and yield each part as a `BufferedMultipartPart` object.
 *
 * Note: This is a low-level API that requires manual handling of the content and boundary. If you're
 * building a web server, consider using `parseMultipartRequest(request)` instead.
 *
 * @param message The multipart message as a `Uint8Array` or an iterable of `Uint8Array` chunks
 * @param options Options for the parser
 * @return A generator that yields `BufferedMultipartPart` objects
 */
export async function* parseMultipart(
  message: Uint8Array | Iterable<Uint8Array>,
  options: ParseMultipartOptions,
): AsyncGenerator<BufferedMultipartPart, void, unknown> {
  let parser = new MultipartParser(options.boundary, {
    maxHeaderSize: options.maxHeaderSize,
    maxFileSize: options.maxFileSize,
  })

  if (message instanceof Uint8Array) {
    if (message.length === 0) {
      return // No data to parse
    }
    yield* bufferMultipart(parser.write(message))
  } else {
    for (let chunk of message) {
      yield* bufferMultipart(parser.write(chunk))
    }
  }

  parser.finish()
}
/**
 * Simple Transformer that collects streamed data into buffered one
 */
async function* bufferMultipart(
  asyncParser: AsyncGenerator<StreamedMultipartPart, void, unknown> ,
): AsyncGenerator<BufferedMultipartPart, void, unknown> {
  let {value, done} = await asyncParser.next()
  while (!done) {
    let next = asyncParser.next()
    if (value) {
      let [iterator, buffered] = await Promise.all([next, value.toBuffered()]);
      ({value, done} = iterator)
      yield buffered
    }
  }
}

/**
 * Parse a `multipart/*` message stream and yield each part as a `StreamedMultipartPart` object.
 *
 * Note: This is a low-level API that requires manual handling of the content and boundary. If you're
 * building a web server, consider using `parseMultipartRequest(request)` instead.
 *
 * @param stream A stream containing multipart data as a `ReadableStream<Uint8Array>`
 * @param options Options for the parser
 * @return An async generator that yields `StreamedMultipartPart` objects
 */
export async function* parseMultipartStream(
  stream: ReadableStream<Uint8Array>,
  options: ParseMultipartOptions,
): AsyncGenerator<StreamedMultipartPart, void, unknown> {
  let parser = new MultipartParser(options.boundary, {
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

export type MultipartParserOptions = Omit<ParseMultipartOptions, 'boundary'>

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
export class MultipartParser {
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
  #currentPart: StreamedMultipartPart | null = null

  constructor(boundary: string, options?: MultipartParserOptions) {
    this.boundary = boundary
    this.maxHeaderSize = options?.maxHeaderSize ?? 8 * oneKb
    this.maxFileSize = options?.maxFileSize ?? 2 * oneMb

    this.#findOpeningBoundary = createSearch(`--${boundary}`)
    this.#openingBoundaryLength = 2 + boundary.length // length of '--' + boundary
    this.#findBoundary = createSearch(`\r\n--${boundary}`)
    this.#findPartialTailBoundary = createPartialTailSearch(`\r\n--${boundary}`)
    this.#boundaryLength = 4 + boundary.length // length of '\r\n--' + boundary
  }

  /**
   * Write a chunk of data to the parser.
   *
   * @param chunk A chunk of data to write to the parser
   * @return A generator yielding `StreamedMultipartPart` objects as they are parsed
   */
  async *write(chunk: Uint8Array): AsyncGenerator<StreamedMultipartPart, void, unknown> {
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

        this.#currentPart!.close()

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

        yield this.#currentPart = new StreamedMultipartPart(chunk.subarray(index, headerEndIndex))

        index = headerEndIndex + 4 // Skip header + \r\n\r\n

        this.#state = MultipartParserStateBody

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
    if (this.#currentPart!.contentLength + chunk.length > this.maxFileSize) {
      throw new MaxFileSizeExceededError(this.maxFileSize)
    }

    await this.#currentPart!.appendChunk(chunk)
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
 * A part of a `multipart/*` HTTP message without content.
 */
export class MultipartPart {
  readonly rawHeader: Uint8Array
  #headers?: Headers

  constructor(header: Uint8Array) {
    this.rawHeader = header
  }

  /**
   * The headers associated with this part.
   */
  get headers(): Headers {
    if (!this.#headers) {
      this.#headers = new Headers(decoder.decode(this.rawHeader))
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

}
/**
 * A part of a `multipart/*` HTTP message with content as ReadableStream.
 */
export class StreamedMultipartPart extends MultipartPart {
  #controller: ReadableStreamDefaultController<Uint8Array> | null = null
  #continue: (() => void) | null = null;
  #contentLength = 0
  /**
   * ReadableStream of raw content of this part.
   */
  readonly content: ReadableStream<Uint8Array>


  constructor(rawHeader: Uint8Array) {
    super(rawHeader);
    this.content = new ReadableStream<Uint8Array>({
      start: (controller) => {
        // Save controller so we can enqueue chunks later
        this.#controller = controller
      },
      pull: () => {
        if (this.#continue) {
          this.#continue();
          this.#continue = null;
        }
      }
    })
  }
  /**
   * Expected length of full-length streamed content
   */
  get contentLength(): number {
    return this.#contentLength
  }
  /**
   * Appends chunk to the stream
   */
  async appendChunk(chunk: Uint8Array) {
    if (!this.#controller || !this.#controller.desiredSize) {
      return  // skip appending chunks if stream is closed or dropped
    }
    while (this.#controller.desiredSize <= 0) {
      await new Promise((resolve) => {
        this.#continue = () => resolve(true);
      });
    }
    this.#controller.enqueue(chunk)
    this.#contentLength += chunk.length
  }
  /**
   * Signal end-of-stream
   */
  close() {
    if (this.#controller) {
      this.#controller.close()
    }
  }
  /**
   * Consumes stream of content into buffered content,
   * that could be used to create Blob
   * 
   * Note: This will throw if stream is started thus buffered can't be complete
   * check if content is consumed
   */
  async toBuffered(): Promise<BufferedMultipartPart> {
    return this.toBufferedFromIterator(readStream(this.content))
  }
  /**
   * Bufferization abstraction for Node compatibility
   */
  async toBufferedFromIterator(iterator: AsyncIterable<Uint8Array>): Promise<BufferedMultipartPart> {
    let chunks: Uint8Array[] = [];
    for await (let value of iterator) {
      this.#contentLength -= value.length
      if (value) chunks.push(value);
    }
    if (this.#contentLength !== 0) {
      throw new MultipartParseError("Streaming part content is disturbed and buffer cannot be complete")
    }

    return new BufferedMultipartPart(this.rawHeader, chunks);
  }
}
/**
 * A part of a `multipart/*` HTTP message with buffered content.
 */
export class BufferedMultipartPart extends MultipartPart {
  /**
   * The raw content of this part as an array of `Uint8Array` chunks.
   */
  readonly content: Uint8Array[]

  constructor(rawHeader: Uint8Array, content: Uint8Array[]) {
    super(rawHeader);
    this.content = content;
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
}
