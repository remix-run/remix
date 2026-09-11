import { readStream } from './read-stream.ts'
import {
  buffersEqual,
  concatChunks,
  computeChecksum,
  decodeLongPath,
  decodePax,
  getOctal,
  getString,
  overflow,
} from './utils.ts'

const TarBlockSize = 512

/**
 * An error thrown when parsing a tar archive fails.
 */
export class TarParseError extends Error {
  /**
   * @param message The error message
   */
  constructor(message: string) {
    super(message)
    this.name = 'TarParseError'
  }
}

/**
 * An error thrown when a tar entry exceeds the maximum allowed body size.
 */
export class MaxEntrySizeExceededError extends TarParseError {
  /**
   * @param maxEntrySize The maximum entry size that was exceeded
   */
  constructor(maxEntrySize: number) {
    super(`Tar entry size exceeds maximum allowed size of ${maxEntrySize} bytes`)
    this.name = 'MaxEntrySizeExceededError'
  }
}

/**
 * An error thrown when a tar archive exceeds the maximum allowed total size.
 */
export class MaxTotalSizeExceededError extends TarParseError {
  /**
   * @param maxTotalSize The maximum total size that was exceeded
   */
  constructor(maxTotalSize: number) {
    super(`Tar archive size exceeds maximum allowed size of ${maxTotalSize} bytes`)
    this.name = 'MaxTotalSizeExceededError'
  }
}

/**
 * An error thrown when a tar archive exceeds the maximum allowed number of entries.
 */
export class MaxEntriesExceededError extends TarParseError {
  /**
   * @param maxEntries The maximum entry count that was exceeded
   */
  constructor(maxEntries: number) {
    super(`Tar entry count exceeds maximum allowed count of ${maxEntries}`)
    this.name = 'MaxEntriesExceededError'
  }
}

/**
 * The parsed header of a tar entry.
 */
export interface TarHeader {
  /**
   * Entry path stored in the archive.
   */
  name: string

  /**
   * File mode parsed from the header, or `null` when unavailable.
   */
  mode: number | null

  /**
   * Numeric user ID parsed from the header, or `null` when unavailable.
   */
  uid: number | null

  /**
   * Numeric group ID parsed from the header, or `null` when unavailable.
   */
  gid: number | null

  /**
   * Entry size in bytes. Parsed sizes are non-negative safe integers.
   */
  size: number

  /**
   * Last modification time parsed from the header, or `null` when unavailable.
   */
  mtime: number | null

  /**
   * Normalized entry type such as `file` or `directory`.
   */
  type: string

  /**
   * Linked path target for link entries, or `null` when not present.
   */
  linkname: string | null

  /**
   * User name parsed from the header.
   */
  uname: string

  /**
   * Group name parsed from the header.
   */
  gname: string

  /**
   * Major device number for device entries, or `null` when unavailable.
   */
  devmajor: number | null

  /**
   * Minor device number for device entries, or `null` when unavailable.
   */
  devminor: number | null

  /**
   * Decoded PAX metadata attached to the entry, or `null` when none is present.
   */
  pax: Record<string, string> | null
}

const TarFileTypes: Record<string, string> = {
  '0': 'file',
  '1': 'link',
  '2': 'symlink',
  '3': 'character-device',
  '4': 'block-device',
  '5': 'directory',
  '6': 'fifo',
  '7': 'contiguous-file',
  '27': 'gnu-long-link-path',
  '28': 'gnu-long-path',
  '30': 'gnu-long-path',
  '55': 'pax-global-header',
  '72': 'pax-header',
}

const ZeroOffset = '0'.charCodeAt(0)
const UstarMagic = new Uint8Array([0x75, 0x73, 0x74, 0x61, 0x72, 0x00]) // "ustar\0"
const UstarVersion = new Uint8Array([ZeroOffset, ZeroOffset]) // "00"
const GnuMagic = new Uint8Array([0x75, 0x73, 0x74, 0x61, 0x72, 0x20]) // "ustar "
const GnuVersion = new Uint8Array([0x20, 0x00]) // " \0"

/**
 * Options for parsing tar headers.
 */
export interface ParseTarHeaderOptions {
  /**
   * Set `false` to disallow unknown header formats.
   *
   * @default true
   */
  allowUnknownFormat?: boolean
  /**
   * The label (encoding) for filenames.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API/Encodings)
   *
   * @default 'utf-8'
   */
  filenameEncoding?: string
}

/**
 * Parses a tar header block.
 *
 * @param block The tar header block
 * @param options Options that control how the header is parsed
 * @returns The parsed tar header
 */
export function parseTarHeader(block: Uint8Array, options?: ParseTarHeaderOptions): TarHeader {
  let header = decodeTarHeader(block, options)
  return { ...header, size: parseEntrySize(block.subarray(124, 136)) }
}

function decodeTarHeader(
  block: Uint8Array,
  options?: ParseTarHeaderOptions,
): Omit<TarHeader, 'size'> {
  if (block.length !== TarBlockSize) {
    throw new TarParseError('Invalid tar header size')
  }

  let allowUnknownFormat = options?.allowUnknownFormat ?? true
  let filenameEncoding = options?.filenameEncoding ?? 'utf-8'

  // Tar header format
  // Offset  Size    Field
  // 0       100     Filename
  // 100     8       File mode (octal)
  // 108     8       Owner's numeric user ID (octal)
  // 116     8       Group's numeric user ID (octal)
  // 124     12      File size in bytes (octal)
  // 136     12      Last modification time (octal)
  // 148     8       Checksum for header block (octal)
  // 156     1       Type flag
  // 157     100     Name of linked file
  // 257     6       Magic string "ustar\0" or "ustar "
  // 263     2       Version "00" or " \0"
  // 265     32      Owner username
  // 297     32      Owner groupname
  // 329     8       Device major number (octal)
  // 337     8       Device minor number (octal)
  // 345     155     Filename prefix (ustar only)

  let checksum = getOctal(block, 148, 8)
  if (checksum !== computeChecksum(block)) {
    throw new TarParseError(
      'Invalid tar header. Maybe the tar is corrupted or needs to be gunzipped?',
    )
  }

  let typeFlag = block[156] === 0 ? 0 : block[156] - ZeroOffset
  let header: Omit<TarHeader, 'size'> = {
    name: getString(block, 0, 100, filenameEncoding),
    mode: getOctal(block, 100, 8),
    uid: getOctal(block, 108, 8),
    gid: getOctal(block, 116, 8),
    mtime: getOctal(block, 136, 12),
    type: TarFileTypes[typeFlag] ?? 'unknown',
    linkname: block[157] === 0 ? null : getString(block, 157, 100, filenameEncoding),
    uname: getString(block, 265, 32),
    gname: getString(block, 297, 32),
    devmajor: getOctal(block, 329, 8),
    devminor: getOctal(block, 337, 8),
    pax: null,
  }

  let magic = block.subarray(257, 263)
  let version = block.subarray(263, 265)
  if (buffersEqual(magic, UstarMagic) && buffersEqual(version, UstarVersion)) {
    // UStar (posix) format
    if (block[345] !== 0) {
      let prefix = getString(block, 345, 155)
      header.name = prefix + '/' + header.name
    }
  } else if (buffersEqual(magic, GnuMagic) && buffersEqual(version, GnuVersion)) {
    // GNU format
  } else if (!allowUnknownFormat) {
    throw new TarParseError('Invalid tar header, unknown format')
  }

  return header
}

function parseEntrySize(value: Uint8Array | string): number {
  let size: number | null
  if (typeof value === 'string') {
    size = value === '' || /[^0-9]/.test(value) ? null : Number(value)
  } else if (value[0] & 0x80) {
    size = value[0] === 0x80 ? getOctal(value, 0, value.length) : null
  } else {
    let octal = new TextDecoder().decode(value).replace(/^[\0 ]+|[\0 ]+$/g, '')
    size = /[^0-7]/.test(octal) ? null : parseInt(octal || '0', 8)
  }

  if (size === null || !Number.isSafeInteger(size) || size < 0) {
    throw new TarParseError('Invalid tar entry size')
  }

  return size
}

function isLongHeader(type: string): boolean {
  return (
    type === 'gnu-long-path' ||
    type === 'gnu-long-link-path' ||
    type === 'pax-global-header' ||
    type === 'pax-header'
  )
}

type TarArchiveSource =
  | ReadableStream<Uint8Array>
  | Uint8Array
  | Iterable<Uint8Array>
  | AsyncIterable<Uint8Array>

type TarEntryHandler = (entry: TarEntry) => void | Promise<void>

/**
 * Options for parsing a tar archive.
 */
export interface ParseTarOptions extends ParseTarHeaderOptions {
  /**
   * Maximum entry body size in bytes, including PAX/GNU metadata entries.
   * Checked before reading the body or calling the handler. Exceeding the limit
   * throws a {@link MaxEntrySizeExceededError}. Defaults to 2 MiB (2097152 bytes).
   * Must be a non-negative safe integer, or `Infinity` to disable the limit.
   */
  maxEntrySize?: number
  /**
   * Maximum archive size in bytes, including headers, padding, and metadata.
   * Counts all input bytes, after decompression if performed upstream. Exceeding
   * the limit throws a {@link MaxTotalSizeExceededError}. Defaults to 20 MiB
   * (20971520 bytes). Must be a non-negative safe integer, or `Infinity` to disable
   * the limit.
   */
  maxTotalSize?: number
  /**
   * Maximum number of entries, including PAX/GNU metadata entries. Padding and
   * end-of-archive markers do not count. Checked before processing each entry;
   * exceeding the limit throws a {@link MaxEntriesExceededError}. Defaults to 5000.
   * Must be a non-negative safe integer, or `Infinity` to disable the limit.
   */
  maxEntries?: number
}

/**
 * Parse a tar archive and call the given handler for each entry it contains.
 *
 * ```ts
 * import { parseTar } from 'remix/tar-parser';
 *
 * await parseTar(archive, (entry) => {
 *  console.log(entry.name);
 * });
 * ```
 *
 * @param archive The tar archive source data
 * @param handler A function to call for each entry in the archive
 * @returns A promise that resolves when the parse is finished
 */
export async function parseTar(archive: TarArchiveSource, handler: TarEntryHandler): Promise<void>
/**
 * Parse a tar archive with the given options and call the handler for each entry.
 *
 * @param archive The tar archive source data
 * @param options Options that control parsing and size limits
 * @param handler A function to call for each entry in the archive
 * @returns A promise that resolves when parsing and all handlers finish
 */
export async function parseTar(
  archive: TarArchiveSource,
  options: ParseTarOptions,
  handler: TarEntryHandler,
): Promise<void>
export async function parseTar(
  archive: TarArchiveSource,
  options: ParseTarOptions | TarEntryHandler,
  handler?: TarEntryHandler,
): Promise<void> {
  let opts: ParseTarOptions | undefined
  if (typeof options === 'function') {
    handler = options
  } else {
    opts = options
  }

  let parser = new TarParser(opts)
  await parser.parse(archive, handler!)
}

/**
 * Options for configuring a {@link TarParser}.
 */
export type TarParserOptions = ParseTarOptions

/**
 * A parser for tar archives.
 */
export class TarParser {
  /**
   * Maximum entry body size in bytes, including PAX/GNU metadata entries.
   */
  readonly maxEntrySize: number

  /**
   * Maximum archive input size in bytes, including headers, padding, and metadata.
   */
  readonly maxTotalSize: number

  /**
   * Maximum number of entries, including PAX/GNU metadata entries.
   */
  readonly maxEntries: number

  #buffer: Uint8Array | null = null
  #totalSize = 0
  #entryCount = 0
  #missing = 0
  #header: TarHeader | null = null
  #bodyController: ReadableStreamDefaultController<Uint8Array> | null = null
  #longHeader = false
  #gnuLongPath: string | null = null
  #gnuLongLinkPath: string | null = null
  #paxGlobal: Record<string, string> | null = null
  #pax: Record<string, string> | null = null

  #options?: TarParserOptions

  /**
   * @param options Options that control how the tar archive is parsed
   */
  constructor(options: TarParserOptions = {}) {
    let {
      maxEntrySize = 2 * 1024 * 1024,
      maxTotalSize = 20 * 1024 * 1024,
      maxEntries = 5000,
    } = options

    if (maxEntrySize !== Infinity && (!Number.isSafeInteger(maxEntrySize) || maxEntrySize < 0)) {
      throw new TypeError('maxEntrySize must be a non-negative safe integer or Infinity')
    }
    if (maxTotalSize !== Infinity && (!Number.isSafeInteger(maxTotalSize) || maxTotalSize < 0)) {
      throw new TypeError('maxTotalSize must be a non-negative safe integer or Infinity')
    }
    if (maxEntries !== Infinity && (!Number.isSafeInteger(maxEntries) || maxEntries < 0)) {
      throw new TypeError('maxEntries must be a non-negative safe integer or Infinity')
    }

    this.maxEntrySize = maxEntrySize
    this.maxTotalSize = maxTotalSize
    this.maxEntries = maxEntries
    this.#options = options
  }

  /**
   * Parse a stream/buffer tar archive and call the given handler for each entry it contains.
   * Resolves when the parse is finished and all handlers resolve.
   *
   * @param archive The tar archive source data
   * @param handler A function to call for each entry in the archive
   * @returns A promise that resolves when the parse is finished
   */
  async parse(archive: TarArchiveSource, handler: TarEntryHandler): Promise<void> {
    this.#reset()

    let results: Promise<void>[] = []

    function handleEntry(entry: TarEntry): void {
      let result = Promise.resolve(handler(entry))
      // A handler may reject before the archive finishes streaming.
      result.catch(() => {})
      results.push(result)
    }

    try {
      if (archive instanceof ReadableStream) {
        for await (let chunk of readStream(archive)) {
          this.#write(chunk, handleEntry)
        }
      } else if (isAsyncIterable(archive)) {
        for await (let chunk of archive) {
          this.#write(chunk, handleEntry)
        }
      } else if (archive instanceof Uint8Array) {
        this.#write(archive, handleEntry)
      } else if (isIterable(archive)) {
        for (let chunk of archive) {
          this.#write(chunk, handleEntry)
        }
      } else {
        throw new TypeError('Cannot parse tar archive; expected a stream or buffer')
      }

      if (this.#missing !== 0) {
        throw new TarParseError('Unexpected end of archive')
      }

      await Promise.all(results)
    } catch (error) {
      this.#bodyController?.error(error)
      this.#bodyController = null
      throw error
    }
  }

  #reset(): void {
    this.#buffer = null
    this.#totalSize = 0
    this.#entryCount = 0
    this.#missing = 0
    this.#header = null
    this.#bodyController = null
    this.#longHeader = false
    this.#gnuLongPath = null
    this.#gnuLongLinkPath = null
    this.#paxGlobal = null
    this.#pax = null
  }

  #write(chunk: Uint8Array, handler: TarEntryHandler): void {
    if (chunk.byteLength > this.maxTotalSize - this.#totalSize) {
      throw new MaxTotalSizeExceededError(this.maxTotalSize)
    }
    this.#totalSize += chunk.byteLength

    if (this.#buffer !== null) {
      this.#buffer = concatChunks(this.#buffer, chunk)
    } else {
      this.#buffer = chunk
    }

    while (this.#buffer !== null && this.#buffer.length > 0) {
      if (this.#missing > 0) {
        if (this.#bodyController !== null) {
          this.#parseBody()
          continue
        }

        if (this.#longHeader) {
          if (this.#missing > this.#buffer.length) break
          this.#parseLongHeader()
          continue
        }

        if (this.#missing >= this.#buffer.length) {
          this.#missing -= this.#buffer.length
          this.#buffer = null
          break
        }

        this.#buffer = this.#buffer.subarray(this.#missing)
        this.#missing = 0
      }

      if (this.#buffer.length < TarBlockSize) break
      this.#parseHeader(handler)
    }
  }

  #parseHeader(handler: TarEntryHandler): void {
    let block = this.#read(TarBlockSize)

    if (isZeroBlock(block)) {
      this.#header = null
      return
    }

    if (++this.#entryCount > this.maxEntries) {
      throw new MaxEntriesExceededError(this.maxEntries)
    }

    let header = decodeTarHeader(block, this.#options)
    this.#longHeader = isLongHeader(header.type)
    let pax = this.#pax
    if (this.#paxGlobal !== null) {
      pax = { ...this.#paxGlobal, ...pax }
    }
    this.#header = {
      ...header,
      size: parseEntrySize((!this.#longHeader && pax?.size) || block.subarray(124, 136)),
    }

    if (this.#header.size > this.maxEntrySize) {
      throw new MaxEntrySizeExceededError(this.maxEntrySize)
    }

    if (this.#longHeader) {
      this.#missing = this.#header.size
      return
    }

    if (this.#gnuLongPath) {
      this.#header.name = this.#gnuLongPath
      this.#gnuLongPath = null
    }

    if (this.#gnuLongLinkPath) {
      this.#header.linkname = this.#gnuLongLinkPath
      this.#gnuLongLinkPath = null
    }

    if (pax) {
      if (pax.path) this.#header.name = pax.path
      if (pax.linkpath) this.#header.linkname = pax.linkpath
      this.#header.pax = pax
      this.#pax = null
    }

    if (this.#header.size === 0 || this.#header.type === 'directory') {
      let emptyBody = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      handler(new TarEntry(this.#header, emptyBody))
      this.#bodyController = null
      this.#missing = 0
      return
    }

    let body = new ReadableStream({
      start: (controller) => {
        this.#bodyController = controller
      },
    })

    handler(new TarEntry(this.#header, body))

    this.#missing = this.#header.size
  }

  #parseLongHeader(): void {
    this.#longHeader = false

    let buffer = this.#read(this.#header!.size)

    switch (this.#header!.type) {
      case 'gnu-long-path':
        this.#gnuLongPath = decodeLongPath(buffer)
        break
      case 'gnu-long-link-path':
        this.#gnuLongLinkPath = decodeLongPath(buffer)
        break
      case 'pax-global-header':
        this.#paxGlobal = { ...this.#paxGlobal, ...decodePax(buffer) }
        break
      case 'pax-header':
        this.#pax = decodePax(buffer)
        break
    }

    this.#missing = overflow(this.#header!.size)
  }

  #parseBody(): void {
    if (this.#missing > this.#buffer!.length) {
      this.#bodyController!.enqueue(this.#buffer!)
      this.#missing -= this.#buffer!.length
      this.#buffer = null
      return
    }

    this.#bodyController!.enqueue(this.#read(this.#missing))
    this.#bodyController!.close()
    this.#bodyController = null
    this.#missing = overflow(this.#header!.size)
  }

  #read(size: number): Uint8Array {
    let result = this.#buffer!.subarray(0, size)
    this.#buffer = this.#buffer!.subarray(size)
    return result
  }
}

function isIterable<T>(value: unknown): value is Iterable<T> {
  return typeof value === 'object' && value != null && Symbol.iterator in value
}

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return typeof value === 'object' && value != null && Symbol.asyncIterator in value
}

function isZeroBlock(buffer: Uint8Array): boolean {
  return buffer.every((byte) => byte === 0)
}

/**
 * An entry in a tar archive.
 */
export class TarEntry {
  #header: TarHeader
  #body: ReadableStream<Uint8Array>
  #bodyUsed = false

  /**
   * @param header The header info for this entry
   * @param body The entry's content as a stream
   */
  constructor(header: TarHeader, body: ReadableStream<Uint8Array>) {
    this.#header = header
    this.#body = body
  }

  /**
   * The content of this entry as an [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer).
   *
   * @returns A promise that resolves to an `ArrayBuffer`
   */
  async arrayBuffer(): Promise<ArrayBuffer> {
    return (await this.bytes()).buffer as ArrayBuffer
  }

  /**
   * The content of this entry as a `ReadableStream<Uint8Array>`.
   */
  get body(): ReadableStream<Uint8Array> {
    return this.#body
  }

  /**
   * Whether the body of this entry has been consumed.
   */
  get bodyUsed(): boolean {
    return this.#bodyUsed
  }

  /**
   * The content of this entry buffered into a single typed array using the bytes received.
   * Rejects if parsing fails before the entry's body is complete.
   *
   * @returns A promise that resolves to a `Uint8Array`
   */
  async bytes(): Promise<Uint8Array> {
    if (this.#bodyUsed) {
      throw new Error('Body is already consumed or is being consumed')
    }

    this.#bodyUsed = true

    let chunks: Uint8Array[] = []
    let length = 0
    for await (let chunk of readStream(this.#body)) {
      chunks.push(new Uint8Array(chunk))
      length += chunk.length
    }

    let result = new Uint8Array(length)
    let offset = 0
    for (let chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result
  }

  /**
   * The raw header info associated with this entry.
   */
  get header(): TarHeader {
    return this.#header
  }

  /**
   * The name of this entry.
   */
  get name(): string {
    return this.header.name
  }

  /**
   * The size of this entry in bytes.
   */
  get size(): number {
    return this.header.size
  }

  /**
   * The content of this entry as a string.
   *
   * Note: Do not use this for binary data, use `await entry.bytes()` or stream `entry.body` directly instead.
   *
   * @returns A promise that resolves to the entry's content as a string
   */
  async text(): Promise<string> {
    return new TextDecoder().decode(await this.bytes())
  }
}
