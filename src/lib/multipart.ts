const CRLF = '\r\n';

const DefaultMaxHeaderSize = 1024 * 1024; // 1 MB
const DefaultMaxPartSize = 1024 * 1024 * 10; // 10 MB

export class MultipartParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MultipartParseError';
	}
}

export interface ContentDisposition {
	type: string | null;
	name: string | null;
	filename: string | null;
	filenameSplat: string | null;
	creationDate: Date | null;
	modificationDate: Date | null;
	readDate: Date | null;
	size: number | null;
}

export class MultipartPart {
	private _parsedContentDisposition: ContentDisposition | null = null;

	constructor(public headers: Headers, public content: Uint8Array) {}

	get contentDisposition(): ContentDisposition {
		if (this._parsedContentDisposition) {
			return this._parsedContentDisposition;
		}

		let header = this.headers.get('Content-Disposition');
		if (!header) {
			return (this._parsedContentDisposition = {
				type: null,
				name: null,
				filename: null,
				filenameSplat: null,
				creationDate: null,
				modificationDate: null,
				readDate: null,
				size: null,
			});
		}

		let parts = header.split(';').map((part) => part.trim());
		let type = parts.shift() || null;
		let params: { [key: string]: string } = {};

		for (let part of parts) {
			let [key, value] = part.split('=');
			if (key && value) {
				params[key.toLowerCase()] = value.replace(/^["']|["']$/g, '');
			}
		}

		return (this._parsedContentDisposition = {
			type,
			name: params['name'] || null,
			filename: params['filename'] || null,
			filenameSplat: params['filename*'] || null,
			creationDate: params['creation-date'] ? new Date(params['creation-date']) : null,
			modificationDate: params['modification-date'] ? new Date(params['modification-date']) : null,
			readDate: params['read-date'] ? new Date(params['read-date']) : null,
			size: params['size'] ? parseInt(params['size'], 10) : null,
		});
	}

	get contentType(): string | null {
		return this.headers.get('content-type') || null;
	}

	get filename(): string | null {
		if (this.contentDisposition.filenameSplat) {
			try {
				let [encodingPart, _languagePart, ...filenameParts] =
					this.contentDisposition.filenameSplat.split("'");
				let encoding = encodingPart.toLowerCase();
				let encodedFilename = filenameParts.join("'");

				let filename = decodeURIComponent(encodedFilename.replace(/%([0-9A-Fa-f]{2})/g, '%$1'));

				if (encoding !== 'utf-8') {
					console.warn(`Unsupported encoding: ${encoding}. Treating as UTF-8.`);
				}

				return filename;
			} catch (error) {
				throw new Error(`Failed to decode internationalized filename*: ${error}`);
			}
		}

		return this.contentDisposition.filename;
	}

	get name(): string | null {
		return this.contentDisposition.name;
	}
}

export function isMultipartFormData(request: Request): boolean {
	let contentType = request.headers.get('Content-Type');
	return contentType != null && contentType.startsWith('multipart/form-data');
}

export interface MultipartParseOptions {
	maxHeaderSize?: number;
	maxPartSize?: number;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const findDoubleCRLF = createSeqFinder(textEncoder.encode(CRLF + CRLF));

/**
 * Parses a multipart/form-data request body and yields each part as a MultipartPart object.
 *
 * Throws MultipartParseError if the parse fails for some reason.
 *
 *
 * Example:
 *
 * ```typescript
 * import { parseMultipartFormData, MultipartParseError } from 'multipart-web-stream';
 *
 * function handleMultipartRequest(request: Request): void {
 *   try {
 *     for await (let part of parseMultipartFormData(request)) {
 *       console.log(part.name);
 *       console.log(part.filename);
 *       console.log(part.contentType);
 *       console.log(new TextDecoder().decode(part.content));
 *     }
 *   } catch (error) {
 *     if (error instanceof MultipartParseError) {
 *       console.error('Failed to parse multipart/form-data:', error.message);
 *     } else {
 *       console.error('An unexpected error occurred:', error);
 *     }
 *   }
 * }
 * ```
 *
 * @param request
 * @param options
 */
export async function* parseMultipartFormData(
	request: Request,
	options: MultipartParseOptions = {}
): AsyncGenerator<MultipartPart> {
	let maxHeaderSize = options.maxHeaderSize || DefaultMaxHeaderSize;
	let maxPartSize = options.maxPartSize || DefaultMaxPartSize;

	if (!request.body) {
		throw new MultipartParseError('Request body is empty');
	}
	if (!isMultipartFormData(request)) {
		throw new MultipartParseError('Request is not multipart/form-data');
	}

	let boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(request.headers.get('Content-Type')!);
	if (!boundaryMatch) {
		throw new MultipartParseError('Invalid Content-Type header: missing boundary');
	}

	let boundary = boundaryMatch[1] || boundaryMatch[2]; // handle quoted and unquoted boundaries
	let boundarySeq = textEncoder.encode(`--${boundary}`);
	let findBoundary = createSeqFinder(boundarySeq);

	let initialBoundaryFound = false;
	let isFinished = false;
	let reader = request.body.getReader();
	let buffer = new Uint8Array(0);
	let boundarySearchStartIndex = 0;

	try {
		while (!isFinished) {
			const { done, value } = await reader.read();
			if (done) {
				if (!isFinished) {
					throw new MultipartParseError('Unexpected end of stream: final boundary not found');
				}
				break;
			}

			buffer = Uint8Array.from([...buffer, ...value]);

			while (true) {
				let boundaryIndex = findBoundary(buffer, boundarySearchStartIndex);
				if (boundaryIndex === -1) {
					// No boundary found, remember the last search index
					boundarySearchStartIndex = Math.max(0, buffer.length - boundarySeq.length);
					break;
				}

				if (initialBoundaryFound) {
					let partData = buffer.subarray(0, boundaryIndex - 2); // -2 to remove \r\n before boundary
					let headerEndIndex = findDoubleCRLF(partData);

					let headers: Headers;
					let content: Uint8Array;
					if (headerEndIndex !== -1) {
						if (headerEndIndex > maxHeaderSize) {
							throw new MultipartParseError(
								`Headers size exceeds maximum allowed size of ${maxHeaderSize} bytes`
							);
						}

						headers = parseHeaders(partData.subarray(0, headerEndIndex));
						content = partData.subarray(headerEndIndex + 4); // +4 to remove \r\n\r\n after headers
					} else {
						// No headers found, treat entire part as content
						headers = new Headers();
						content = partData;
					}

					if (content.length > maxPartSize) {
						throw new MultipartParseError(
							`Part size exceeds maximum allowed size of ${maxPartSize} bytes`
						);
					}

					yield new MultipartPart(headers, content);
				} else {
					initialBoundaryFound = true;
				}

				buffer = buffer.subarray(boundaryIndex + boundarySeq.length);
				boundarySearchStartIndex = 0;

				if (buffer.length > 1 && buffer[0] === 45 && buffer[1] === 45) {
					isFinished = true;
					buffer = buffer.subarray(2); // Keep any data after final boundary
					break;
				}
			}
		}

		if (buffer.length > 0) {
			throw new MultipartParseError('Unexpected data after final boundary');
		}
	} finally {
		reader.releaseLock();
	}
}

function parseHeaders(headerData: Uint8Array): Headers {
	let headers = new Headers();

	let lines = textDecoder.decode(headerData).split(CRLF);
	for (let line of lines) {
		let [key, value] = line.split(':').map((s) => s.trim());
		if (key && value) {
			headers.append(key, value);
		}
	}

	return headers;
}

function createSeqFinder(needle: Uint8Array): (haystack: Uint8Array, offset?: number) => number {
	let skipTable = new Map<number, number>();
	for (let i = 0; i < needle.length - 1; i++) {
		skipTable.set(needle[i], needle.length - 1 - i);
	}

	return (haystack: Uint8Array, offset = 0) => findSeq(haystack, needle, skipTable, offset);
}

function findSeq(
	haystack: Uint8Array,
	needle: Uint8Array,
	skipTable: Map<number, number>,
	offset: number
): number {
	// boyer-moore-horspool algorithm
	if (needle.length === 0) {
		return offset;
	}

	let i = offset + needle.length - 1;
	while (i < haystack.length) {
		let j = needle.length - 1;
		while (j >= 0 && haystack[i] === needle[j]) {
			i--;
			j--;
		}
		if (j < 0) {
			return i + 1;
		}
		i += Math.max(needle.length - j, skipTable.get(haystack[i]) || needle.length);
	}

	return -1;
}
