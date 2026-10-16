import { ContentDisposition } from '@remix-run/headers/content-disposition'
import { ContentType } from '@remix-run/headers/content-type'

import {
  encodeAsciiPattern,
  createSearch,
  createPartialTailSearch,
  type SearchFunction,
  type PartialTailSearchFunction,
} from './buffer-search.ts'
import { readStream } from './read-stream.ts'

/**
 * The base class for errors thrown by the multipart parser.
 */
export class MultipartParseError extends Error {
  /**
   * @param message The error message
   */
  constructor(message: string) {
    super(message)
    this.name = 'MultipartParseError'
  }
}

/**
 * An error thrown when the maximum allowed size of a header is exceeded.
 */
export class MaxHeaderSizeExceededError extends MultipartParseError {
  /**
   * @param maxHeaderSize The maximum header size that was exceeded
   */
  constructor(maxHeaderSize: number) {
    super(`Multipart header size exceeds maximum allowed size of ${maxHeaderSize} bytes`)
    this.name = 'MaxHeaderSizeExceededError'
  }
}

/**
 * An error thrown when the maximum allowed size of a file is exceeded.
 */
export class MaxFileSizeExceededError extends MultipartParseError {
  /**
   * @param maxFileSize The maximum file size that was exceeded
   */
  constructor(maxFileSize: number) {
    super(`File size exceeds maximum allowed size of ${maxFileSize} bytes`)
    this.name = 'MaxFileSizeExceededError'
  }
}

/**
 * An error thrown when the maximum allowed number of multipart parts is exceeded.
 */
export class MaxPartsExceededError extends MultipartParseError {
  /**
   * @param maxParts The maximum number of parts that was exceeded
   */
  constructor(maxParts: number) {
    super(`Multipart part count exceeds maximum allowed count of ${maxParts}`)
    this.name = 'MaxPartsExceededError'
  }
}

/**
 * An error thrown when the maximum allowed aggregate multipart content size is exceeded.
 */
export class MaxTotalSizeExceededError extends MultipartParseError {
  /**
   * @param maxTotalSize The maximum total size that was exceeded
   */
  constructor(maxTotalSize: number) {
    super(`Multipart content size exceeds maximum allowed size of ${maxTotalSize} bytes`)
    this.name = 'MaxTotalSizeExceededError'
  }
}

/**
 * Options for parsing a multipart message.
 */
export interface ParseMultipartOptions {
  /**
   * The boundary string used to separate parts in the multipart message,
   * e.g. the `boundary` parameter in the `Content-Type` header.
   * Boundaries may not exceed 70 characters.
   */
  boundary: string
  /**
   * The maximum allowed size of a header in bytes. If an individual part's header
   * exceeds this size, a `MaxHeaderSizeExceededError` will be thrown.
   *
   * @default 8192 (8 KiB)
   */
  maxHeaderSize?: number
  /**
   * The maximum allowed size of a file in bytes. If an individual part's content
   * exceeds this size, a `MaxFileSizeExceededError` will be thrown.
   *
   * @default 2097152 (2 MiB)
   */
  maxFileSize?: number
  /**
   * The maximum allowed number of parts in the multipart message. If this limit
   * is exceeded, a `MaxPartsExceededError` will be thrown.
   *
   * @default 1000
   */
  maxParts?: number
  /**
   * The maximum allowed aggregate size of all part content in bytes. If this
   * limit is exceeded, a `MaxTotalSizeExceededError` will be thrown.
   *
   * @default `maxFileSize * 20 + 1048576` (1 MiB)
   */
  maxTotalSize?: number
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
export function* parseMultipart(
  message: Uint8Array | Iterable<Uint8Array>,
  options: ParseMultipartOptions,
): Generator<MultipartPart, void, unknown> {
  let parser = new MultipartParser(options.boundary, {
    maxHeaderSize: options.maxHeaderSize,
    maxFileSize: options.maxFileSize,
    maxParts: options.maxParts,
    maxTotalSize: options.maxTotalSize,
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
export async function* parseMultipartStream(
  stream: ReadableStream<Uint8Array>,
  options: ParseMultipartOptions,
): AsyncGenerator<MultipartPart, void, unknown> {
  let parser = new MultipartParser(options.boundary, {
    maxHeaderSize: options.maxHeaderSize,
    maxFileSize: options.maxFileSize,
    maxParts: options.maxParts,
    maxTotalSize: options.maxTotalSize,
  })

  for await (let chunk of readStream(stream)) {
    if (chunk.length === 0) {
      continue // No data to parse
    }

    yield* parser.write(chunk)
  }

  parser.finish()
}

/**
 * Parse a `multipart/*` message stream and yield each part as soon as its headers arrive, with
 * its content available as a stream. Unlike {@link parseMultipartStream}, part content is never
 * buffered in memory.
 *
 * Parts are read in order, so read or cancel each part's body before continuing to the next part.
 * If a part's body has not been read when you continue, its content is discarded. If a read is in
 * progress, the parser waits for it to finish.
 *
 * Note: This is a low-level API that requires manual handling of the content and boundary.
 * If you're building a web server, consider using
 * {@link import('./multipart-request.ts').parseStreamingMultipartRequest} instead.
 *
 * @param stream A stream containing multipart data as a `ReadableStream<Uint8Array>`
 * @param options Options for the parser
 * @yields {@link StreamingMultipartPart} objects as their headers are parsed
 * @returns An async generator that yields {@link StreamingMultipartPart} objects
 */
export async function* parseStreamingMultipart(
  stream: ReadableStream<Uint8Array>,
  options: ParseMultipartOptions,
): AsyncGenerator<StreamingMultipartPart, void, unknown> {
  validateBoundary(options.boundary)

  let maxFileSize = options.maxFileSize ?? defaultMaxFileSize
  let reader = new StreamingMultipartReader(stream, options.boundary, {
    maxHeaderSize: options.maxHeaderSize ?? defaultMaxHeaderSize,
    maxFileSize,
    maxParts: options.maxParts ?? defaultMaxParts,
    maxTotalSize: options.maxTotalSize ?? getDefaultMaxTotalSize(maxFileSize),
  })

  yield* reader.parts()
}

/**
 * Options for configuring a {@link MultipartParser}.
 */
export type MultipartParserOptions = Omit<ParseMultipartOptions, 'boundary'>

const MultipartParserStateStart = 0
const MultipartParserStateAfterBoundary = 1
const MultipartParserStateBoundaryPadding = 2
const MultipartParserStateHeader = 3
const MultipartParserStateBody = 4
const MultipartParserStateClosingBoundary = 5
const MultipartParserStateEpilogue = 6
const MultipartParserStateDone = 7

const findDoubleNewline = createSearch('\r\n\r\n')

const oneKb = 1024
const oneMb = 1024 * oneKb
// RFC 2046 limits boundary values to 70 characters:
// https://www.rfc-editor.org/rfc/rfc2046#section-5.1.1
const maxBoundaryLength = 70
const defaultMaxHeaderSize = 8 * oneKb
const defaultMaxFileSize = 2 * oneMb
const defaultMaxParts = 1000
const defaultMaxTotalSizePartAllowance = 20

// Yielded by `MultipartScanner#scan()`: a part's raw header when the part begins and `partEnd`
// when it ends. Content in between goes to the scanner's content callback.
type ScanEvent = { header: Uint8Array } | typeof partEnd

const partEnd = null

interface ScannerLimits {
  maxHeaderSize: number
  maxFileSize: number
  maxTotalSize: number
}

class MultipartScanner {
  #onContent: (chunk: Uint8Array) => void
  #maxHeaderSize: number
  #maxFileSize: number
  #maxTotalSize: number
  #findOpeningBoundary: SearchFunction
  #openingBoundaryLength: number
  #findBoundary: SearchFunction
  #findPartialTailBoundary: PartialTailSearchFunction
  #boundaryLength: number
  #boundaryBytes: Uint8Array

  #state = MultipartParserStateStart
  #atStartOfStream = true
  #buffer: Uint8Array | null = null
  #inPart = false
  #contentLength = 0
  #totalContentLength = 0

  constructor(boundary: string, limits: ScannerLimits, onContent: (chunk: Uint8Array) => void) {
    this.#onContent = onContent
    this.#maxHeaderSize = limits.maxHeaderSize
    this.#maxFileSize = limits.maxFileSize
    this.#maxTotalSize = limits.maxTotalSize

    this.#findOpeningBoundary = createSearch(`--${boundary}`)
    this.#openingBoundaryLength = 2 + boundary.length // length of '--' + boundary
    let boundaryPattern = `\r\n--${boundary}`
    this.#findBoundary = createSearch(boundaryPattern)
    this.#findPartialTailBoundary = createPartialTailSearch(boundaryPattern)
    this.#boundaryLength = 4 + boundary.length // length of '\r\n--' + boundary
    this.#boundaryBytes = encodeAsciiPattern(boundaryPattern)
  }

  *scan(chunk: Uint8Array): Generator<ScanEvent, void, unknown> {
    if (this.#state === MultipartParserStateDone) {
      throw new MultipartParseError('Unexpected data after end of stream')
    }
    if (this.#state === MultipartParserStateEpilogue) return

    let index = 0
    let chunkLength = chunk.length

    if (this.#buffer !== null) {
      if (this.#state === MultipartParserStateBody) {
        let carry = this.#buffer
        let carryResult = this.#analyzeCarryBoundary(carry, chunk)

        if (carryResult.kind === 'none') {
          this.#append(carry)
        } else if (carryResult.kind === 'partial') {
          let content = carry.subarray(0, carryResult.start)
          this.#append(content)

          let tailLength = carry.length + chunk.length - carryResult.start
          let tail = new Uint8Array(tailLength)
          let carryTail = carry.subarray(carryResult.start)
          tail.set(carryTail, 0)
          tail.set(chunk, carryTail.length)
          this.#buffer = tail
          return
        } else {
          let content = carry.subarray(0, carryResult.start)
          this.#append(content)

          this.#state = MultipartParserStateAfterBoundary

          let carryAfterStart = carry.length - carryResult.start
          index = this.#boundaryLength - carryAfterStart
        }
      } else {
        let newChunk = new Uint8Array(this.#buffer.length + chunkLength)
        newChunk.set(this.#buffer, 0)
        newChunk.set(chunk, this.#buffer.length)
        chunk = newChunk
        chunkLength = chunk.length
      }

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
            let content = index === 0 ? chunk : chunk.subarray(index)
            this.#append(content)
          } else {
            let content = chunk.subarray(index, partialTailIndex)
            this.#append(content)
            this.#buffer = chunk.subarray(partialTailIndex)
          }

          break
        }

        let content = chunk.subarray(index, boundaryIndex)
        this.#append(content)

        index = boundaryIndex + this.#boundaryLength

        this.#state = MultipartParserStateAfterBoundary
      }

      if (this.#state === MultipartParserStateAfterBoundary) {
        if (chunkLength - index < 2) {
          this.#buffer = chunk.subarray(index)
          break
        }

        if (chunk[index] === 45 && chunk[index + 1] === 45) {
          index += 2
          this.#state = MultipartParserStateClosingBoundary
          if (this.#inPart) {
            this.#inPart = false
            yield partEnd
          }
        } else {
          this.#state = MultipartParserStateBoundaryPadding
        }
      }

      if (
        this.#state === MultipartParserStateBoundaryPadding ||
        this.#state === MultipartParserStateClosingBoundary
      ) {
        let closing = this.#state === MultipartParserStateClosingBoundary
        while (chunk[index] === 32 || chunk[index] === 9) {
          index++
        }

        if (index === chunkLength || (chunk[index] === 13 && chunkLength - index === 1)) {
          this.#buffer = chunk.subarray(index)
          break
        }

        if (chunk[index] !== 13 || chunk[index + 1] !== 10) {
          throw new MultipartParseError('Invalid multipart boundary ending')
        }

        index += 2 // Skip \r\n after boundary
        this.#state = closing ? MultipartParserStateEpilogue : MultipartParserStateHeader

        if (!closing && this.#inPart) {
          this.#inPart = false
          yield partEnd
        }
        if (closing) break
      }

      if (this.#state === MultipartParserStateHeader) {
        if (chunkLength - index < 4) {
          this.#buffer = chunk.subarray(index)
          break
        }

        let headerEndIndex = findDoubleNewline(chunk, index)

        if (headerEndIndex === -1) {
          if (chunkLength - index > this.#maxHeaderSize) {
            throw new MaxHeaderSizeExceededError(this.#maxHeaderSize)
          }

          this.#buffer = chunk.subarray(index)
          break
        }

        if (headerEndIndex - index > this.#maxHeaderSize) {
          throw new MaxHeaderSizeExceededError(this.#maxHeaderSize)
        }

        let header = chunk.subarray(index, headerEndIndex)
        this.#inPart = true
        this.#contentLength = 0

        index = headerEndIndex + 4 // Skip header + \r\n\r\n

        this.#state = MultipartParserStateBody

        yield { header }
        continue
      }

      if (this.#state === MultipartParserStateStart) {
        if (chunkLength < this.#openingBoundaryLength) {
          this.#buffer = chunk
          break
        }

        if (this.#atStartOfStream && this.#findOpeningBoundary(chunk) === 0) {
          index = this.#openingBoundaryLength
          this.#state = MultipartParserStateAfterBoundary
          continue
        }

        let boundaryIndex = this.#findBoundary(chunk)
        if (boundaryIndex === -1) {
          // RFC 2046 preamble: keep a tail so the opening boundary can be
          // split across chunks.
          let keep = this.#boundaryLength - 1
          if (chunkLength <= keep) {
            this.#buffer = chunk
          } else {
            this.#atStartOfStream = false
            this.#buffer = chunk.subarray(chunkLength - keep)
          }
          break
        }

        index = boundaryIndex + this.#boundaryLength
        this.#state = MultipartParserStateAfterBoundary
      }
    }
  }

  #append(chunk: Uint8Array): void {
    if (chunk.length === 0) {
      return
    }

    if (this.#contentLength + chunk.length > this.#maxFileSize) {
      throw new MaxFileSizeExceededError(this.#maxFileSize)
    }

    if (this.#totalContentLength + chunk.length > this.#maxTotalSize) {
      throw new MaxTotalSizeExceededError(this.#maxTotalSize)
    }

    this.#contentLength += chunk.length
    this.#totalContentLength += chunk.length
    this.#onContent(chunk)
  }

  #analyzeCarryBoundary(
    carry: Uint8Array,
    chunk: Uint8Array,
  ): { kind: 'none' } | { kind: 'partial'; start: number } | { kind: 'full'; start: number } {
    let totalLength = carry.length + chunk.length

    for (let start = 0; start < carry.length; ++start) {
      let availableLength = totalLength - start
      let compareLength = Math.min(this.#boundaryLength, availableLength)

      let matched = true
      for (let i = 0; i < compareLength; ++i) {
        let sourceIndex = start + i
        let sourceByte =
          sourceIndex < carry.length ? carry[sourceIndex] : chunk[sourceIndex - carry.length]
        if (sourceByte !== this.#boundaryBytes[i]) {
          matched = false
          break
        }
      }

      if (!matched) {
        continue
      }

      if (availableLength >= this.#boundaryLength) {
        return { kind: 'full', start }
      }

      return { kind: 'partial', start }
    }

    return { kind: 'none' }
  }

  finish(): void {
    if (this.#state === MultipartParserStateClosingBoundary) {
      if (this.#buffer !== null && this.#buffer.length > 0) {
        throw new MultipartParseError('Invalid multipart boundary ending')
      }

      this.#state = MultipartParserStateDone
    }

    if (this.#state === MultipartParserStateEpilogue) {
      this.#state = MultipartParserStateDone
    }
    if (this.#state !== MultipartParserStateDone) {
      throw new MultipartParseError('Multipart stream not finished')
    }
  }
}

/**
 * A streaming parser for `multipart/*` HTTP messages.
 */
export class MultipartParser {
  /**
   * Boundary string used to detect part separators.
   */
  readonly boundary: string

  /**
   * Maximum header size allowed for each multipart part.
   */
  readonly maxHeaderSize: number

  /**
   * Maximum file size allowed for each multipart part.
   */
  readonly maxFileSize: number

  /**
   * Maximum number of parts allowed in a multipart message.
   */
  readonly maxParts: number

  /**
   * Maximum aggregate content size allowed across all parts.
   */
  readonly maxTotalSize: number

  #scanner: MultipartScanner
  #header: Uint8Array | null = null
  #content: Uint8Array[] = []
  #partCount = 0

  /**
   * @param boundary The boundary string used to separate parts
   * @param options Options for the parser
   */
  constructor(boundary: string, options?: MultipartParserOptions) {
    validateBoundary(boundary)

    this.boundary = boundary
    this.maxHeaderSize = options?.maxHeaderSize ?? defaultMaxHeaderSize
    this.maxFileSize = options?.maxFileSize ?? defaultMaxFileSize
    this.maxParts = options?.maxParts ?? defaultMaxParts
    this.maxTotalSize = options?.maxTotalSize ?? getDefaultMaxTotalSize(this.maxFileSize)
    this.#scanner = new MultipartScanner(boundary, this, (chunk) => this.#content.push(chunk))
  }

  /**
   * Write a chunk of data to the parser.
   *
   * The final part is yielded when both closing hyphens arrive. Consume all chunks
   * and call {@link MultipartParser.finish} to validate the complete message;
   * malformed closing suffixes may throw after the final part has been yielded.
   *
   * @param chunk A chunk of data to write to the parser
   * @yields Parsed {@link MultipartPart} objects that became available from this chunk
   * @returns A generator yielding `MultipartPart` objects as they are parsed
   */
  *write(chunk: Uint8Array): Generator<MultipartPart, void, unknown> {
    for (let event of this.#scanner.scan(chunk)) {
      if (event === partEnd) {
        if (++this.#partCount > this.maxParts) {
          throw new MaxPartsExceededError(this.maxParts)
        }

        yield new MultipartPart(this.#header!, this.#content)
      } else {
        this.#header = event.header
        this.#content = []
      }
    }
  }

  /**
   * Validate completion after all chunks have been written to the parser.
   *
   * Throws if the message is incomplete or its closing delimiter is malformed,
   * even if {@link MultipartParser.write} has already yielded the final part.
   */
  finish(): void {
    this.#scanner.finish()
  }
}

function validateBoundary(boundary: string): void {
  if (boundary.length > maxBoundaryLength) {
    throw new MultipartParseError(
      `Multipart boundary exceeds maximum length of ${maxBoundaryLength} characters`,
    )
  }
}

function getDefaultMaxTotalSize(maxFileSize: number): number {
  return maxFileSize * defaultMaxTotalSizePartAllowance + oneMb
}

interface StreamingPartState {
  controller: ReadableStreamDefaultController<Uint8Array<ArrayBuffer>>
  // The part's end has been reached
  ended: boolean
  // The body was pulled or canceled
  used: boolean
  // Content is no longer delivered to the body, because it was canceled or is being drained
  discarding: boolean
  settled: PromiseWithResolvers<void>
}

class StreamingMultipartReader {
  #reader: ReadableStreamDefaultReader<Uint8Array>
  #scanner: MultipartScanner
  #maxParts: number
  #partCount = 0
  #scan: Iterator<ScanEvent> | null = null
  #content: Uint8Array[] = []
  #event: ScanEvent | undefined = undefined
  #inputDone = false
  #failed = false
  #error: unknown = undefined
  #current: StreamingPartState | null = null
  #queue: Promise<unknown> = Promise.resolve()

  constructor(
    stream: ReadableStream<Uint8Array>,
    boundary: string,
    limits: ScannerLimits & { maxParts: number },
  ) {
    this.#reader = stream.getReader()
    this.#maxParts = limits.maxParts
    this.#scanner = new MultipartScanner(boundary, limits, (chunk) => this.#content.push(chunk))
  }

  async *parts(): AsyncGenerator<StreamingMultipartPart, void, unknown> {
    let finished = false

    try {
      while (true) {
        let item = await this.#serialize(() => this.#next())
        if (item === undefined) {
          finished = true
          return
        }

        // Content and part ends only occur inside a part, so this is the start of the next part.
        let header = (item as { header: Uint8Array }).header
        if (++this.#partCount > this.#maxParts) {
          throw new MaxPartsExceededError(this.#maxParts)
        }

        let part = this.#createPart()
        this.#current = part.state
        yield new StreamingMultipartPart(header, part.body)
        await this.#settle(part.state)
      }
    } finally {
      if (!finished) {
        this.#fail(
          new MultipartParseError('Multipart parsing was stopped before the end of the stream'),
        )
      }
    }
  }

  #createPart(): { state: StreamingPartState; body: ReadableStream<Uint8Array<ArrayBuffer>> } {
    let state = {
      ended: false,
      used: false,
      discarding: false,
      settled: Promise.withResolvers<void>(),
    } as StreamingPartState

    let body = new ReadableStream<Uint8Array<ArrayBuffer>>(
      {
        start(controller) {
          state.controller = controller
        },
        pull: () => {
          state.used = true
          return this.#serialize(() => this.#deliverNext(state))
        },
        cancel() {
          state.used = true
          state.discarding = true
          state.settled.resolve()
        },
      },
      { highWaterMark: 0 },
    )

    return { state, body }
  }

  // Waits for a part body that is being read to finish, then discards whatever is left of it.
  async #settle(state: StreamingPartState): Promise<void> {
    if (!state.ended && state.used && !state.discarding) {
      await state.settled.promise
    }

    if (!state.ended && !state.discarding) {
      state.discarding = true
      try {
        state.controller.error(
          new TypeError('Multipart part body is no longer available after moving to the next part'),
        )
      } catch {}
    }

    while (!state.ended) {
      await this.#serialize(() => this.#deliverNext(state))
    }
  }

  async #deliverNext(state: StreamingPartState): Promise<void> {
    if (state.ended) return

    let item = await this.#next()
    if (item instanceof Uint8Array) {
      if (!state.discarding) {
        state.controller.enqueue(item as Uint8Array<ArrayBuffer>)
      }
    } else if (item === partEnd) {
      state.ended = true
      if (!state.discarding) {
        state.controller.close()
      }
      state.settled.resolve()
    } else {
      // The scanner throws before the input ends inside a part, and only ends parts it started.
      throw new MultipartParseError('Unexpected multipart part boundary')
    }
  }

  // Returns the next content chunk or scan event in message order, or `undefined` at the end of
  // the input. Callers must be serialized.
  async #next(): Promise<Uint8Array | ScanEvent | undefined> {
    if (this.#failed) throw this.#error

    try {
      while (true) {
        if (this.#content.length > 0) {
          return this.#content.shift()
        }

        if (this.#event !== undefined) {
          let event = this.#event
          this.#event = undefined
          return event
        }

        if (this.#scan !== null) {
          let result = this.#scan.next()
          if (result.done) {
            this.#scan = null
          } else {
            this.#event = result.value
          }
          continue
        }

        if (this.#inputDone) return undefined

        let result = await this.#reader.read()
        if (result.done) {
          this.#inputDone = true
          this.#reader.releaseLock()
          this.#scanner.finish()
        } else if (result.value.length > 0) {
          this.#scan = this.#scanner.scan(result.value)
        }
      }
    } catch (error) {
      this.#fail(error)
      throw error
    }
  }

  #fail(error: unknown): void {
    if (this.#failed) return

    this.#failed = true
    this.#error = error

    let current = this.#current
    if (current !== null && !current.ended) {
      if (!current.discarding) {
        try {
          current.controller.error(error)
        } catch {}
      }
      current.settled.resolve()
    }

    if (!this.#inputDone) {
      this.#inputDone = true
      this.#reader.cancel(error).catch(() => {})
    }
  }

  #serialize<result>(task: () => Promise<result>): Promise<result> {
    let result = this.#queue.then(task)
    this.#queue = result.catch(() => {})
    return result
  }
}

let decoder: TextDecoder | undefined

function decodeUtf8(input: Uint8Array): string {
  decoder ??= new TextDecoder('utf-8', { fatal: true })
  return decoder.decode(input as BufferSource)
}

/**
 * The decoded headers for a multipart part, keyed by lower-case header name.
 */
export interface MultipartHeaders {
  readonly [name: string]: string | undefined
}

function parseMultipartHeaders(raw: string): MultipartHeaders {
  let headers: Record<string, string> = Object.create(null)

  for (let line of raw.split('\r\n')) {
    let match = line.match(/^([^:]+):(.*)/)
    if (match) {
      let name = match[1].trim().toLowerCase()
      let value = match[2].trim()
      let existingValue = headers[name]
      headers[name] = existingValue === undefined ? value : `${existingValue}, ${value}`
    }
  }

  return Object.freeze(headers)
}

/**
 * A part of a `multipart/*` HTTP message.
 */
export class MultipartPart {
  /**
   * The raw content of this part as an array of `Uint8Array` chunks.
   */
  readonly content: Uint8Array[]

  #header: Uint8Array
  #headers?: MultipartHeaders

  /**
   * @param header The raw header bytes
   * @param content The content chunks
   */
  constructor(header: Uint8Array, content: Uint8Array[]) {
    this.#header = header
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
   * The decoded headers associated with this part, keyed by lower-case header name.
   */
  get headers(): MultipartHeaders {
    if (!this.#headers) {
      this.#headers = parseMultipartHeaders(decodeUtf8(this.#header))
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
   * The filename from the part's `Content-Disposition` header, preferring a decoded `filename*`
   * over `filename` when available. This is untrusted client input without filesystem sanitization.
   * Do not use it, or a `File.name` derived from it, directly as a filesystem path. Generate a
   * storage name in your application instead.
   */
  get filename(): string | undefined {
    return ContentDisposition.from(this.headers['content-disposition'] ?? null).preferredFilename
  }

  /**
   * The media type of the part.
   */
  get mediaType(): string | undefined {
    return ContentType.from(this.headers['content-type'] ?? null).mediaType
  }

  /**
   * The name of the part, usually the `name` of the field in the `<form>` that submitted the request.
   */
  get name(): string | undefined {
    return ContentDisposition.from(this.headers['content-disposition'] ?? null).name
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
    return decodeUtf8(this.bytes)
  }
}

/**
 * A part of a `multipart/*` HTTP message whose content is streamed as it arrives, yielded by
 * {@link parseStreamingMultipart}. Its content can be read once, either through
 * {@link StreamingMultipartPart.body} or with {@link StreamingMultipartPart.bytes} or
 * {@link StreamingMultipartPart.text}.
 */
export class StreamingMultipartPart {
  #header: Uint8Array
  #headers?: MultipartHeaders
  #body: ReadableStream<Uint8Array<ArrayBuffer>>
  #bodyUsed = false

  /**
   * @param header The raw header bytes
   * @param body A stream of the part's content
   */
  constructor(header: Uint8Array, body: ReadableStream<Uint8Array<ArrayBuffer>>) {
    this.#header = header
    this.#body = body
  }

  /**
   * A stream of this part's content. Accessing it marks the body as used.
   */
  get body(): ReadableStream<Uint8Array<ArrayBuffer>> {
    this.#bodyUsed = true
    return this.#body
  }

  /**
   * True once the content has been accessed through {@link StreamingMultipartPart.body},
   * {@link StreamingMultipartPart.bytes}, or {@link StreamingMultipartPart.text}.
   */
  get bodyUsed(): boolean {
    return this.#bodyUsed
  }

  /**
   * Reads all of this part's content into a single `Uint8Array`.
   *
   * @returns A promise that resolves to the part's content
   */
  async bytes(): Promise<Uint8Array<ArrayBuffer>> {
    if (this.#bodyUsed) {
      throw new TypeError('Multipart part body has already been used')
    }

    let chunks: Uint8Array[] = []
    let size = 0
    for await (let chunk of readStream(this.body)) {
      chunks.push(chunk)
      size += chunk.length
    }

    let buffer = new Uint8Array(size)
    let offset = 0
    for (let chunk of chunks) {
      buffer.set(chunk, offset)
      offset += chunk.length
    }

    return buffer
  }

  /**
   * The decoded headers associated with this part, keyed by lower-case header name.
   */
  get headers(): MultipartHeaders {
    if (!this.#headers) {
      this.#headers = parseMultipartHeaders(decodeUtf8(this.#header))
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
   * The filename from the part's `Content-Disposition` header, preferring a decoded `filename*`
   * over `filename` when available. This is untrusted client input without filesystem sanitization.
   * Do not use it, or a `File.name` derived from it, directly as a filesystem path. Generate a
   * storage name in your application instead.
   */
  get filename(): string | undefined {
    return ContentDisposition.from(this.headers['content-disposition'] ?? null).preferredFilename
  }

  /**
   * The media type of the part.
   */
  get mediaType(): string | undefined {
    return ContentType.from(this.headers['content-type'] ?? null).mediaType
  }

  /**
   * The name of the part, usually the `name` of the field in the `<form>` that submitted the request.
   */
  get name(): string | undefined {
    return ContentDisposition.from(this.headers['content-disposition'] ?? null).name
  }

  /**
   * Reads all of this part's content as a UTF-8 string.
   *
   * Note: Do not use this for binary data, use `part.body` or `part.bytes()` instead.
   *
   * @returns A promise that resolves to the part's content as a string
   */
  async text(): Promise<string> {
    return decodeUtf8(await this.bytes())
  }
}
