const TarBlockSize = 512;

export class TarParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TarParseError';
  }
}

export interface TarHeader {
  name: string;
  mode: number | null;
  uid: number | null;
  gid: number | null;
  size: number;
  mtime: number | null;
  type: string;
  linkname: string | null;
  uname: string;
  gname: string;
  devmajor: number | null;
  devminor: number | null;
  pax: Record<string, string> | null;
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
};

const ZeroOffset = '0'.charCodeAt(0);
const UstarMagic = new Uint8Array([0x75, 0x73, 0x74, 0x61, 0x72, 0x00]); // "ustar\0"
const UstarVersion = new Uint8Array([ZeroOffset, ZeroOffset]); // "00"
const GnuMagic = new Uint8Array([0x75, 0x73, 0x74, 0x61, 0x72, 0x20]); // "ustar "
const GnuVersion = new Uint8Array([0x20, 0x00]); // " \0"

export interface ParseTarHeaderOptions {
  /**
   * Set false to disallow unknown header formats. Defaults to true.
   */
  allowUnknownFormat?: boolean;
  /**
   * The label (encoding) for filenames. Defaults to 'utf-8'.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API/Encodings)
   */
  filenameEncoding?: string;
}

/**
 * Parses a tar header block.
 * @param block The tar header block
 * @param options
 * @returns The parsed tar header
 */
export function parseTarHeader(block: Uint8Array, options?: ParseTarHeaderOptions): TarHeader {
  if (block.length !== TarBlockSize) {
    throw new TarParseError('Invalid tar header size');
  }

  let allowUnknownFormat = options?.allowUnknownFormat ?? true;
  let filenameEncoding = options?.filenameEncoding ?? 'utf-8';

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

  let checksum = getOctal(block, 148, 8);
  if (checksum !== computeChecksum(block)) {
    throw new TarParseError(
      'Invalid tar header. Maybe the tar is corrupted or needs to be gunzipped?',
    );
  }

  let typeFlag = block[156] === 0 ? 0 : block[156] - ZeroOffset;
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
  };

  let magic = block.subarray(257, 263);
  let version = block.subarray(263, 265);
  if (buffersEqual(magic, UstarMagic) && buffersEqual(version, UstarVersion)) {
    // UStar (posix) format
    if (block[345] !== 0) {
      let prefix = getString(block, 345, 155);
      header.name = prefix + '/' + header.name;
    }
  } else if (buffersEqual(magic, GnuMagic) && buffersEqual(version, GnuVersion)) {
    // GNU format
  } else if (!allowUnknownFormat) {
    throw new TarParseError('Invalid tar header, unknown format');
  }

  return header;
}

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function indexOf(buffer: Uint8Array, value: number, offset: number, end: number): number {
  for (; offset < end; offset++) {
    if (buffer[offset] === value) return offset;
  }
  return end;
}

const Utf8Decoder = new TextDecoder();

function getString(buffer: Uint8Array, offset: number, size: number, label = 'utf-8') {
  return new TextDecoder(label).decode(
    buffer.subarray(offset, indexOf(buffer, 0, offset, offset + size)),
  );
}

function getOctal(buffer: Uint8Array, offset: number, size: number) {
  let value = buffer.subarray(offset, offset + size);
  offset = 0;

  if (value[offset] & 0x80) return parse256(value);

  // Older versions of tar can prefix with spaces
  while (offset < value.length && value[offset] === 32) offset++;
  let end = clamp(indexOf(value, 32, offset, value.length), value.length, value.length);
  while (offset < end && value[offset] === 0) offset++;
  if (end === offset) return 0;

  return parseInt(Utf8Decoder.decode(value.subarray(offset, end)), 8);
}

/* Copied from the tar-stream repo who copied it from the node-tar repo.
 */
function parse256(buf: Uint8Array): number | null {
  // first byte MUST be either 80 or FF
  // 80 for positive, FF for 2's comp
  let positive;
  if (buf[0] === 0x80) positive = true;
  else if (buf[0] === 0xff) positive = false;
  else return null;

  // build up a base-256 tuple from the least sig to the highest
  let tuple = [];
  let i;
  for (i = buf.length - 1; i > 0; i--) {
    const byte = buf[i];
    if (positive) tuple.push(byte);
    else tuple.push(0xff - byte);
  }

  let sum = 0;
  let len = tuple.length;
  for (i = 0; i < len; i++) {
    sum += tuple[i] * Math.pow(256, i);
  }

  return positive ? sum : -1 * sum;
}

function clamp(index: number, len: number, defaultValue: number): number {
  if (typeof index !== 'number') return defaultValue;
  index = ~~index; // Coerce to integer.
  if (index >= len) return len;
  if (index >= 0) return index;
  index += len;
  if (index >= 0) return index;
  return 0;
}

function computeChecksum(block: Uint8Array): number {
  let sum = 8 * 32;
  for (let i = 0; i < 148; i++) sum += block[i];
  for (let i = 156; i < 512; i++) sum += block[i];
  return sum;
}

const enum TarParserState {
  Start,
  Header,
  AfterHeader,
  Body,
  AfterBody,
  Done,
}

export type TarParserOptions = ParseTarHeaderOptions;

/**
 * A parser for tar archives.
 */
export class TarParser {
  #state = TarParserState.Start;
  #buffer: Uint8Array | null = null;
  #bodyController: ReadableStreamDefaultController<Uint8Array> | null = null;
  #bodyWritten = 0;
  #bodySize = 0; // The declared size of the current body
  #header: TarHeader | null = null;
  #longHeader = false;
  #gnuLongPath: string | null = null;
  #gnuLongLinkPath: string | null = null;
  #paxGlobal: Record<string, string> | null = null;
  #pax: Record<string, string> | null = null;

  #allowUnknownFormat: boolean;
  #filenameEncoding: string;

  constructor(options?: TarParserOptions) {
    this.#allowUnknownFormat = options?.allowUnknownFormat ?? true;
    this.#filenameEncoding = options?.filenameEncoding ?? 'utf-8';
  }

  /**
   * Parse a stream/buffer tar archive and call the given handler for each entry it contains.
   * Resolves when the parse is finished and all handlers resolve.
   */
  async parse(
    archive:
      | ReadableStream<Uint8Array>
      | Uint8Array
      | Iterable<Uint8Array>
      | AsyncIterable<Uint8Array>,
    handler: (entry: TarEntry) => void,
  ): Promise<void> {
    if (this.#state !== TarParserState.Start) {
      this.#reset();
    }

    let results: unknown[] = [];

    function handleEntry(entry: TarEntry): void {
      results.push(handler(entry));
    }

    if (archive instanceof ReadableStream || isAsyncIterable(archive)) {
      for await (let chunk of archive) {
        this.#write(chunk, handleEntry);
      }
    } else if (archive instanceof Uint8Array) {
      this.#write(archive, handleEntry);
    } else if (isIterable(archive)) {
      for (let chunk of archive) {
        this.#write(chunk, handleEntry);
      }
    } else {
      throw new TypeError('Cannot parse tar archive; expected a stream or buffer');
    }

    if (
      this.#state !== TarParserState.Done &&
      !(this.#buffer === null || this.#buffer.length === 0)
    ) {
      throw new TarParseError('Unexpected end of archive');
    }

    await Promise.all(results);
  }

  #reset(): void {
    this.#state = TarParserState.Start;
    this.#buffer = null;
    this.#bodyController = null;
    this.#bodySize = 0;
    this.#header = null;
    this.#longHeader = false;
    this.#gnuLongPath = null;
    this.#gnuLongLinkPath = null;
    this.#paxGlobal = null;
    this.#pax = null;
  }

  #write(chunk: Uint8Array, handler: (entry: TarEntry) => void): void {
    if (this.#state === TarParserState.Done) {
      throw new TarParseError('Unexpected data after end of archive');
    }

    let index = 0;
    let chunkLength = chunk.length;

    if (this.#buffer !== null) {
      let newChunk = new Uint8Array(this.#buffer.length + chunkLength);
      newChunk.set(this.#buffer, 0);
      newChunk.set(chunk, this.#buffer.length);
      chunk = newChunk;
      chunkLength = chunk.length;
      this.#buffer = null;
    }

    while (true) {
      if (this.#state === TarParserState.Body) {
        let remaining = this.#bodySize - this.#bodyWritten;

        if (chunkLength - index < remaining) {
          this.#writeBody(index === 0 ? chunk : chunk.subarray(index));
          break;
        }

        this.#writeBody(chunk.subarray(index, index + remaining));
        this.#closeBody();

        index += remaining;

        this.#state = TarParserState.AfterBody;
      }

      if (this.#state === TarParserState.AfterBody) {
        let padding = overflow(this.#bodySize);

        if (chunkLength - index < padding) {
          this.#buffer = chunk.subarray(index);
          break;
        }

        index += padding;

        this.#state = TarParserState.Header;
      }

      if (this.#state === TarParserState.Start || this.#state === TarParserState.Header) {
        if (chunkLength - index < TarBlockSize) {
          this.#buffer = chunk.subarray(index);
          break;
        }

        let block = chunk.subarray(index, index + TarBlockSize);
        index += TarBlockSize;

        if (isZeroBlock(block)) {
          this.#header = null;
        } else {
          this.#header = parseTarHeader(block, {
            allowUnknownFormat: this.#allowUnknownFormat,
            filenameEncoding: this.#filenameEncoding,
          });

          switch (this.#header.type) {
            case 'gnu-long-path':
            case 'gnu-long-link-path':
            case 'pax-global-header':
            case 'pax-header':
              this.#longHeader = true;
              break;
            default:
              if (this.#gnuLongPath) {
                this.#header.name = this.#gnuLongPath;
                this.#gnuLongPath = null;
              }

              if (this.#gnuLongLinkPath) {
                this.#header.linkname = this.#gnuLongLinkPath;
                this.#gnuLongLinkPath = null;
              }

              if (this.#pax) {
                if (this.#pax.path) this.#header.name = this.#pax.path;
                if (this.#pax.linkpath) this.#header.linkname = this.#pax.linkpath;
                if (this.#pax.size) this.#header.size = parseInt(this.#pax.size, 10);
                this.#header.pax = this.#pax;
                this.#pax = null;
              }
          }
        }

        this.#state = TarParserState.AfterHeader;
      }

      if (this.#state === TarParserState.AfterHeader) {
        // Either we are at the end of the archive ...
        if (this.#header === null) {
          if (chunkLength - index < TarBlockSize) {
            this.#buffer = chunk.subarray(index);
            break;
          }

          let nextBlock = chunk.subarray(index, index + TarBlockSize);
          if (isZeroBlock(nextBlock)) {
            this.#state = TarParserState.Done;
            break;
          } else {
            throw new TarParseError('Invalid end of archive marker');
          }
        }

        // ... or we found a long header that we need to finish parsing ...
        if (this.#longHeader) {
          let padding = overflow(this.#header.size);

          if (chunkLength - index < this.#header.size + padding) {
            this.#buffer = chunk.subarray(index);
            break;
          }

          let buffer = chunk.subarray(index, index + this.#header.size);
          index += this.#header.size + padding;

          switch (this.#header.type) {
            case 'gnu-long-path':
              this.#gnuLongPath = decodeLongPath(buffer);
              break;
            case 'gnu-long-link-path':
              this.#gnuLongLinkPath = decodeLongPath(buffer);
              break;
            case 'pax-global-header':
              this.#paxGlobal = decodePax(buffer);
              break;
            case 'pax-header':
              this.#pax =
                this.#paxGlobal === null
                  ? decodePax(buffer)
                  : Object.assign({}, this.#paxGlobal, decodePax(buffer));
              break;
          }

          this.#longHeader = false;

          this.#state = TarParserState.Header;
          continue;
        }

        // ... or it's the beginning of a new entry.
        this.#bodySize = this.#header.size;

        let entry = new TarEntry(
          this.#header,
          new ReadableStream({
            start: (controller) => {
              this.#bodyController = controller;
            },
          }),
        );

        handler(entry);

        this.#state = TarParserState.Body;
      }
    }
  }

  #writeBody(chunk: Uint8Array): void {
    if (this.#bodyWritten + chunk.length > this.#bodySize) {
      throw new TarParseError('Body size exceeds declared size');
    }

    this.#bodyController!.enqueue(chunk);
    this.#bodyWritten += chunk.length;
  }

  #closeBody(): void {
    this.#bodyController!.close();
    this.#bodyController = null;
    this.#bodyWritten = 0;
  }
}

function isIterable<T>(value: unknown): value is Iterable<T> {
  return typeof value === 'object' && value != null && Symbol.iterator in value;
}

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return typeof value === 'object' && value != null && Symbol.asyncIterator in value;
}

function isZeroBlock(buffer: Uint8Array): boolean {
  return buffer.every((byte) => byte === 0);
}

function decodeLongPath(buffer: Uint8Array): string {
  return Utf8Decoder.decode(buffer);
}

function decodePax(buffer: Uint8Array): Record<string, string> {
  let pax: Record<string, string> = {};

  while (buffer.length) {
    let i = 0;
    while (i < buffer.length && buffer[i] !== 32) i++;

    let len = parseInt(Utf8Decoder.decode(buffer.subarray(0, i)), 10);
    if (!len) break;

    let val = Utf8Decoder.decode(buffer.subarray(i + 1, len - 1));
    let eq = val.indexOf('=');
    if (eq === -1) break;

    pax[val.slice(0, eq)] = val.slice(eq + 1);

    buffer = buffer.subarray(len);
  }

  return pax;
}

function overflow(size: number): number {
  size &= 511;
  return size && 512 - size;
}

/**
 * An entry in a tar archive.
 */
export class TarEntry {
  #header: TarHeader;
  #body: ReadableStream<Uint8Array>;
  #bodyUsed = false;

  constructor(header: TarHeader, body: ReadableStream<Uint8Array>) {
    this.#header = header;
    this.#body = body;
  }

  /**
   * The content of this entry as an `ArrayBuffer`.
   */
  async arrayBuffer(): Promise<ArrayBuffer> {
    return (await this.bytes()).buffer as ArrayBuffer;
  }

  /**
   * The content of this entry as a `ReadableStream<Uint8Array>`.
   */
  get body(): ReadableStream<Uint8Array> {
    return this.#body;
  }

  /**
   * Whether the body of this entry has been consumed.
   */
  get bodyUsed(): boolean {
    return this.#bodyUsed;
  }

  /**
   * The content of this entry buffered into a single `Uint8Array`.
   */
  async bytes(): Promise<Uint8Array> {
    if (this.#bodyUsed) {
      throw new Error('Body is already consumed or is being consumed');
    }

    this.#bodyUsed = true;

    let result = new Uint8Array(this.size);
    let offset = 0;
    for await (let chunk of this.#body) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * The raw header info associated with this entry.
   */
  get header(): TarHeader {
    return this.#header;
  }

  /**
   * The name of this entry.
   */
  get name(): string {
    // TODO: handle prefix
    return this.header.name;
  }

  /**
   * The size of this entry in bytes.
   */
  get size(): number {
    return this.header.size;
  }

  /**
   * The content of this entry as a string.
   *
   * Note: Do not use this for binary data, use `await entry.bytes()` or stream `entry.body` directly instead.
   */
  async text(): Promise<string> {
    return new TextDecoder().decode(await this.bytes());
  }
}
