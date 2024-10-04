const TarBlockSize = 512;

export class TarParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TarParseError';
	}
}

export interface TarHeader {
	name: string;
	mode: number;
	uid: number;
	gid: number;
	size: number;
	mtime: number;
	checksum: number;
	type: string;
	linkname: string;
	uname: string;
	gname: string;
	devmajor: number;
	devminor: number;
	prefix: string;
}

const TarFileTypes: Record<string, string> = {
	'0': 'file',
	'1': 'link',
	'2': 'symlink',
	'3': 'character',
	'4': 'block',
	'5': 'directory',
	'6': 'fifo',
	'7': 'contiguous',
};

export function parseTarHeader(buffer: Uint8Array): TarHeader {
	if (buffer.length !== TarBlockSize) {
		throw new TarParseError('Invalid tar header size');
	}

	let decoder = new TextDecoder('ascii');

	function getString(offset: number, size: number) {
		return decoder.decode(buffer.subarray(offset, offset + size)).replace(/\0.*$/, '');
	}

	function getOctal(offset: number, size: number) {
		return parseInt(getString(offset, size), 8);
	}

	// UStar header format
	// Offset  Size    Field
	// 0       100     Filename
	// 100     8       File mode (octal)
	// 108     8       Owner's numeric user ID (octal)
	// 116     8       Group's numeric user ID (octal)
	// 124     12      File size in bytes (octal)
	// 136     12      Last modification time (octal)
	// 148     8       Checksum for header block (octal)
	// 156     1       Link indicator (file type)
	// 157     100     Name of linked file
	// 257     6       UStar indicator "ustar\0"
	// 263     2       UStar version "00"
	// 265     32      Owner username
	// 297     32      Owner groupname
	// 329     8       Device major number (octal)
	// 337     8       Device minor number (octal)
	// 345     155     Filename prefix

	let checksum = getOctal(148, 8);
	if (checksum !== computeHeaderChecksum(buffer)) {
		throw new TarParseError('Invalid tar header checksum');
	}

	let ustarIndicator = getString(257, 6);
	if (ustarIndicator !== 'ustar') {
		throw new TarParseError('Invalid tar header, must be ustar');
	}

	let linkIndicator = String.fromCharCode(buffer[156]);

	return {
		name: getString(0, 100),
		mode: getOctal(100, 8),
		uid: getOctal(108, 8),
		gid: getOctal(116, 8),
		size: getOctal(124, 12),
		mtime: getOctal(136, 12),
		checksum,
		type: TarFileTypes[linkIndicator] || 'unknown',
		linkname: getString(157, 100),
		uname: getString(265, 32),
		gname: getString(297, 32),
		devmajor: getOctal(329, 8),
		devminor: getOctal(337, 8),
		prefix: getString(345, 155),
	};
}

function computeHeaderChecksum(buffer: Uint8Array): number {
	let sum = 0;
	for (let i = 0; i < 512; i++) {
		sum += i >= 148 && i < 156 ? 32 : buffer[i];
	}

	return sum;
}

const enum TarParserState {
  Start,
  Header,
  Body,
  Done,
}

/**
 * A parser for tar archives.
 */
export class TarParser {
  #state = TarParserState.Start;
  #buffer: Uint8Array | null = null;
  #bodyController: ReadableStreamDefaultController<Uint8Array> | null = null;
	#bodyWritten = 0;
  #bodySize = 0; // The declared size of the current body

  /**
   * Parse a stream/buffer multipart message and call the given handler for each part it contains.
   * Resolves when the parse is finished and all handlers resolve.
   */
  async parse(
    message:
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

    if (message instanceof ReadableStream || isAsyncIterable(message)) {
      for await (let chunk of message) {
        this.#write(chunk, handleEntry);
      }
    } else if (message instanceof Uint8Array) {
      this.#write(message, handleEntry);
    } else if (isIterable(message)) {
      for (let chunk of message) {
        this.#write(chunk, handleEntry);
      }
    } else {
      throw new TypeError('Cannot parse tar archive; expected a stream or buffer');
    }

    if (this.#state !== TarParserState.Done) {
      throw new TarParseError('Unexpected end of archive');
    }

    await Promise.all(results);
  }

  #reset(): void {
    this.#state = TarParserState.Start;
    this.#buffer = null;
    this.#bodyController = null;
    this.#bodySize = 0;
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
      }

      if (this.#state === TarParserState.Header) {
      }

      if (this.#state === TarParserState.Start) {
      }
    }
  }

  #writeBody(chunk: Uint8Array): void {
		if (this.#bodyWritten + chunk.length > this.#bodySize) {
			throw new TarParseError('Body size exceeds declared size');
		}

    this.#bodyController!.enqueue(chunk);
		this.#bodyWritten += chunk.length
  }

  #closeBody(): void {
    this.#bodyController!.close();
    this.#bodyController = null;
		this.#bodyWritten = 0
		this.#bodySize = 0
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
    for (let chunk of this.#body) {
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
