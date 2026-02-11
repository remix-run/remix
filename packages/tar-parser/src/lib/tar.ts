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
 * The parsed header of a tar entry.
 */
export interface TarHeader {
  name: string
  mode: number | null
  uid: number | null
  gid: number | null
  size: number
  mtime: number | null
  type: string
  linkname: string | null
  uname: string
  gname: string
  devmajor: number | null
  devminor: number | null
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
  let header: TarHeader = {
    name: getString(block, 0, 100, filenameEncoding),
    mode: getOctal(block, 100, 8),
    uid: getOctal(block, 108, 8),
    gid: getOctal(block, 116, 8),
    size: getOctal(block, 124, 12) ?? 0,
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

type TarArchiveSource =
  | ReadableStream<Uint8Array>
  | Uint8Array
  | Iterable<Uint8Array>
  | AsyncIterable<Uint8Array>

type TarEntryHandler = (entry: TarEntry) => void | Promise<void>

/**
 * Options for parsing a tar archive.
 */
export type ParseTarOptions = ParseTarHeaderOptions

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
 * Options for configuring a `TarParser`.
 */
export type TarParserOptions = ParseTarHeaderOptions

/**
 * A parser for tar archives.
 */
export class TarParser {
  #buffer: Uint8Array | null = null
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
  constructor(options?: TarParserOptions) {
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

    let results: unknown[] = []

    function handleEntry(entry: TarEntry): void {
      results.push(handler(entry))
    }

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
  }

  #reset(): void {
    this.#buffer = null
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

    this.#header = parseTarHeader(block, this.#options)

    switch (this.#header.type) {
      case 'gnu-long-path':
      case 'gnu-long-link-path':
      case 'pax-global-header':
      case 'pax-header':
        this.#longHeader = true
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

    if (this.#pax) {
      if (this.#pax.path) this.#header.name = this.#pax.path
      if (this.#pax.linkpath) this.#header.linkname = this.#pax.linkpath
      if (this.#pax.size) this.#header.size = parseInt(this.#pax.size, 10)
      this.#header.pax = this.#pax
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
        this.#paxGlobal = decodePax(buffer)
        break
      case 'pax-header':
        this.#pax =
          this.#paxGlobal !== null
            ? Object.assign({}, this.#paxGlobal, decodePax(buffer))
            : decodePax(buffer)
        break
    }

    this.#missing = overflow(this.#header!.size)
  }

  #parseBody(): void {
    if (this.#missing >= this.#buffer!.length) {
      this.#bodyController!.enqueue(this.#buffer!)
      this.#missing -= this.#buffer!.length
      this.#buffer = null
    } else {
      this.#bodyController!.enqueue(this.#read(this.#missing))
      this.#bodyController!.close()
      this.#bodyController = null
      this.#missing = overflow(this.#header!.size)
    }
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
   * The content of this entry buffered into a single typed array.
   *
   * @returns A promise that resolves to a `Uint8Array`
   */
  async bytes(): Promise<Uint8Array> {
    if (this.#bodyUsed) {
      throw new Error('Body is already consumed or is being consumed')
    }

    this.#bodyUsed = true

    let result = new Uint8Array(this.size)
    let offset = 0
    for await (let chunk of readStream(this.#body)) {
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
