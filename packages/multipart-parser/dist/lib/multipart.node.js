import { Readable } from 'node:stream';
import { ContentType } from '@remix-run/headers/content-type';
import { MultipartParseError, parseMultipart as parseMultipartWeb, parseMultipartStream as parseMultipartStreamWeb, } from './multipart.js';
import { getMultipartBoundary } from './multipart-request.js';
/**
 * Parse a `multipart/*` Node.js `Buffer` and yield each part as a {@link MultipartPart} object.
 *
 * Note: This is a low-level API that requires manual handling of the content and boundary.
 * If you're building a web server, consider using {@link parseMultipartRequest} instead.
 *
 * @param message The multipart message as a `Buffer` or an iterable of `Buffer` chunks
 * @param options Options for the parser
 * @yields Parsed {@link MultipartPart} objects from the multipart message
 * @returns A generator yielding {@link MultipartPart} objects
 */
export function* parseMultipart(message, options) {
    yield* parseMultipartWeb(message, options);
}
/**
 * Parse a `multipart/*` Node.js `Readable` stream and yield each part as a
 * {@link MultipartPart} object.
 *
 * Note: This is a low-level API that requires manual handling of the stream and boundary.
 * If you're building a web server, consider using {@link parseMultipartRequest} instead.
 *
 * @param stream A Node.js `Readable` stream containing multipart data
 * @param options Options for the parser
 * @yields Parsed {@link MultipartPart} objects from the multipart stream
 * @returns An async generator yielding {@link MultipartPart} objects
 */
export async function* parseMultipartStream(stream, options) {
    yield* parseMultipartStreamWeb(Readable.toWeb(stream), options);
}
/**
 * Returns true if the given request is a multipart request.
 *
 * @param req The Node.js `http.IncomingMessage` object to check
 * @returns `true` if the request is a multipart request, `false` otherwise
 */
export function isMultipartRequest(req) {
    let mediaType = ContentType.from(req.headers['content-type'] ?? null).mediaType?.toLowerCase();
    return mediaType?.startsWith('multipart/') ?? false;
}
/**
 * Parse a multipart Node.js request and yield each part as a {@link MultipartPart} object.
 *
 * @param req The Node.js `http.IncomingMessage` object containing multipart data
 * @param options Options for the parser, such as `maxHeaderSize`, `maxFileSize`, `maxParts`,
 * and `maxTotalSize`
 * @yields Parsed {@link MultipartPart} objects from the multipart request body
 * @returns An async generator yielding {@link MultipartPart} objects
 */
export async function* parseMultipartRequest(req, options) {
    if (!isMultipartRequest(req)) {
        throw new MultipartParseError('Request is not a multipart request');
    }
    let boundary = getMultipartBoundary(req.headers['content-type']);
    if (!boundary) {
        throw new MultipartParseError('Invalid Content-Type header: missing boundary');
    }
    yield* parseMultipartStream(req, {
        boundary,
        maxHeaderSize: options?.maxHeaderSize,
        maxFileSize: options?.maxFileSize,
        maxParts: options?.maxParts,
        maxTotalSize: options?.maxTotalSize,
    });
}
