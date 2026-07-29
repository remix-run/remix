import * as net from 'node:net';
import { createLazyRequestFactory } from "./lazy-request.js";
import { createRequestAbortError, createRequestLifecycle, isRequestAlreadyAborted, isRequestAbortReason, markRequestAbortReason, observeResponseForRequestLifecycle, } from "./request-abort.js";
// "Internal Server Error"
const internalServerErrorBody = [
    73, 110, 116, 101, 114, 110, 97, 108, 32, 83, 101, 114, 118, 101, 114, 32, 69, 114, 114, 111, 114,
];
/**
 * Wraps a fetch handler in a Node.js request listener that can be used with:
 *
 * - [`http.createServer()`](https://nodejs.org/api/http.html#httpcreateserveroptions-requestlistener)
 * - [`https.createServer()`](https://nodejs.org/api/https.html#httpscreateserveroptions-requestlistener)
 * - [`http2.createServer()`](https://nodejs.org/api/http2.html#http2createserveroptions-onrequesthandler)
 * - [`http2.createSecureServer()`](https://nodejs.org/api/http2.html#http2createsecureserveroptions-onrequesthandler)
 *
 * Example:
 *
 * ```ts
 * import * as http from 'node:http';
 * import { createRequestListener } from 'remix/node-fetch-server';
 *
 * async function handler(request) {
 *   return new Response('Hello, world!');
 * }
 *
 * let server = http.createServer(
 *   createRequestListener(handler)
 * );
 *
 * server.listen(3000);
 * ```
 *
 * @param handler The fetch handler to use for processing incoming requests
 * @param options Request listener options
 * @returns A Node.js request listener function
 */
export function createRequestListener(handler, options) {
    let onError = options?.onError ?? defaultErrorHandler;
    let createLazyRequest = createLazyRequestFactory(options, createRequestWithLifecycle, createHeaders, {
        createLifecycle: createRequestLifecycle,
        observeResponseForLifecycle: observeResponseForRequestLifecycle,
    });
    if (handler.length === 0) {
        let handlerWithoutArgs = handler;
        return async (_req, res) => {
            let isResponseClosed = observeResponseClose(res);
            let response;
            try {
                response = await handlerWithoutArgs();
            }
            catch (error) {
                response = await createErrorResponse(onError, error);
            }
            await sendResponseIfOpen(res, response, isResponseClosed);
        };
    }
    if (handler.length === 1) {
        let requestHandler = handler;
        return (req, res) => {
            let isResponseClosed = observeResponseClose(res);
            let request = createLazyRequest(req, res);
            let response;
            try {
                response = requestHandler(request);
            }
            catch (error) {
                void sendErrorResponseForRequest(res, request, onError, error, isResponseClosed);
                return;
            }
            if (isPromiseLike(response)) {
                void response.then((response) => {
                    void sendResponseForRequest(res, response, request, onError, isResponseClosed);
                }, (error) => {
                    if (isRequestAbortError(request, error))
                        return;
                    void sendErrorResponseForRequest(res, request, onError, error, isResponseClosed);
                });
            }
            else {
                void sendResponseForRequest(res, response, request, onError, isResponseClosed);
            }
        };
    }
    return async (req, res) => {
        let isResponseClosed = observeResponseClose(res);
        let request = createLazyRequest(req, res);
        let client = createClientAddress(req, options);
        let response;
        try {
            response = await handler(request, client);
        }
        catch (error) {
            if (isRequestAbortError(request, error))
                return;
            response = await createErrorResponse(onError, error);
        }
        await sendResponseForRequest(res, response, request, onError, isResponseClosed);
    };
}
function observeResponseClose(res) {
    let responseClosed = false;
    res.once('close', () => {
        responseClosed = true;
    });
    return () => responseClosed || res.destroyed;
}
async function sendResponseIfOpen(res, response, isResponseClosed) {
    if (isResponseClosed())
        return;
    await sendResponse(res, response);
}
async function sendErrorResponseForRequest(res, request, onError, error, isResponseClosed) {
    let response = await createErrorResponse(onError, error);
    if (isResponseClosed() || request.signal.aborted || hasResponseStarted(res))
        return;
    await sendResponse(res, response);
}
async function sendResponseForRequest(res, response, request, onError, isResponseClosed) {
    if (isResponseClosed() || request.signal.aborted)
        return;
    try {
        await sendResponse(res, response);
    }
    catch (error) {
        if (isResponseClosed())
            return;
        if (isRequestAbortError(request, error))
            return;
        if (hasResponseStarted(res)) {
            destroyResponse(res, error);
            void createErrorResponse(onError, error);
            return;
        }
        await sendErrorResponseForRequest(res, request, onError, error, isResponseClosed);
    }
}
async function createErrorResponse(onError, error) {
    try {
        return (await onError(error)) ?? internalServerError();
    }
    catch (error) {
        console.error(`There was an error in the error handler: ${error}`);
        return internalServerError();
    }
}
function defaultErrorHandler(error) {
    console.error(error);
    return internalServerError();
}
function internalServerError() {
    return new Response(new Uint8Array(internalServerErrorBody), {
        status: 500,
        headers: {
            'Content-Type': 'text/plain',
        },
    });
}
function isPromiseLike(value) {
    return typeof value.then === 'function';
}
function isRequestAbortError(request, error) {
    return isRequestAbortReason(error) || (request.signal.aborted && error === request.signal.reason);
}
function hasResponseStarted(res) {
    return res.headersSent;
}
function destroyResponse(res, error) {
    if (res.destroyed)
        return;
    if (error instanceof Error) {
        res.destroy(error);
    }
    else {
        res.destroy();
    }
}
function createRequestBodyStream(req, lifecycle) {
    let bodyController;
    let requestEnded = false;
    let bodyClosed = false;
    function cleanup({ keepErrorListener = false } = {}) {
        req.removeListener('data', onData);
        req.removeListener('end', onEnd);
        if (!keepErrorListener)
            req.removeListener('error', onError);
        req.removeListener('aborted', onAborted);
        req.removeListener('close', onClose);
    }
    function closeBody() {
        if (bodyClosed)
            return;
        bodyClosed = true;
        cleanup();
        bodyController?.close();
    }
    function abortBody(error, { keepErrorListener = false } = {}) {
        if (bodyClosed)
            return;
        bodyClosed = true;
        cleanup({ keepErrorListener });
        lifecycle.abort(error);
        bodyController?.error(error);
    }
    function cancelBody() {
        if (bodyClosed)
            return;
        bodyClosed = true;
        cleanup();
    }
    function onData(chunk) {
        bodyController?.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
    }
    function onEnd() {
        requestEnded = true;
        closeBody();
    }
    function onError(error) {
        markRequestAbortReason(error);
        abortBody(error);
    }
    function onAborted() {
        abortBody(createRequestAbortError(), { keepErrorListener: true });
    }
    function onClose() {
        if (!requestEnded)
            abortBody(createRequestAbortError(), { keepErrorListener: true });
    }
    return new ReadableStream({
        start(controller) {
            bodyController = controller;
            req.once('error', onError);
            if (isRequestAlreadyAborted(req)) {
                abortBody(createRequestAbortError(), { keepErrorListener: true });
                return;
            }
            req.on('data', onData);
            req.once('end', onEnd);
            req.once('aborted', onAborted);
            req.once('close', onClose);
            if (isRequestAlreadyAborted(req)) {
                abortBody(createRequestAbortError(), { keepErrorListener: true });
            }
        },
        cancel() {
            cancelBody();
        },
    });
}
/**
 * Creates a [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) object from
 *
 * - a [`http.IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage)/[`http.ServerResponse`](https://nodejs.org/api/http.html#class-httpserverresponse) pair
 * - a [`http2.Http2ServerRequest`](https://nodejs.org/api/http2.html#class-http2http2serverrequest)/[`http2.Http2ServerResponse`](https://nodejs.org/api/http2.html#class-http2http2serverresponse) pair
 *
 * @param req The incoming request object
 * @param res The server response object
 * @param options Options for creating the request
 * @returns A `Request` object
 */
export function createRequest(req, res, options) {
    let lifecycle = createRequestLifecycle();
    observeResponseForRequestLifecycle(res, lifecycle);
    return createRequestWithLifecycle(req, res, options, lifecycle);
}
function createRequestWithLifecycle(req, res, options, lifecycle) {
    let method = req.method ?? 'GET';
    let headers = createHeaders(req);
    let protocol = getRequestProtocol(req, headers, options);
    let host = getRequestHost(req, headers, options);
    let url = `${protocol}//${host}${req.url}`;
    let init = { method, headers, signal: lifecycle.signal };
    if (method !== 'GET' && method !== 'HEAD') {
        init.body = createRequestBodyStream(req, lifecycle);
        init.duplex = 'half';
    }
    return new Request(url, init);
}
function getRequestProtocol(req, headers, options) {
    return (options?.protocol ??
        (options?.trustProxy ? getForwardedProtocol(headers) : undefined) ??
        ('encrypted' in req.socket && req.socket.encrypted ? 'https:' : 'http:'));
}
function createClientAddress(req, options) {
    let forwardedClient = options?.trustProxy
        ? getForwardedClientAddress(createHeaders(req))
        : undefined;
    let address = forwardedClient?.address ?? req.socket.remoteAddress ?? '';
    return {
        address,
        family: getClientAddressFamily(address, req.socket.remoteFamily),
        port: forwardedClient?.port ?? req.socket.remotePort,
    };
}
function getClientAddressFamily(address, fallbackFamily) {
    let version = net.isIP(address);
    if (version === 4)
        return 'IPv4';
    if (version === 6)
        return 'IPv6';
    return fallbackFamily;
}
function getRequestHost(req, headers, options) {
    let authority = req.headers[':authority'];
    return (options?.host ??
        (options?.trustProxy ? getForwardedHost(headers) : undefined) ??
        headers.get('Host') ??
        (Array.isArray(authority) ? authority[0] : authority) ??
        'localhost');
}
function getForwardedProtocol(headers) {
    return (normalizeForwardedProtocol(getForwardedHeaderParameter(headers.get('Forwarded'), 'proto')) ??
        getXForwardedProtoHeaderProtocol(headers.get('X-Forwarded-Proto')));
}
function getForwardedHost(headers) {
    return (normalizeForwardedHost(getForwardedHeaderParameter(headers.get('Forwarded'), 'host')) ??
        normalizeForwardedHost(getFirstHeaderValue(headers.get('X-Forwarded-Host'))));
}
function getForwardedClientAddress(headers) {
    return (normalizeForwardedClientAddress(getForwardedHeaderParameter(headers.get('Forwarded'), 'for')) ??
        normalizeForwardedClientAddress(getFirstHeaderValue(headers.get('X-Forwarded-For'))));
}
function getForwardedHeaderParameter(value, parameterName) {
    if (value == null)
        return undefined;
    for (let element of splitHeaderValue(value, ',')) {
        for (let parameter of splitHeaderValue(element, ';')) {
            let index = parameter.indexOf('=');
            if (index === -1)
                continue;
            let name = parameter.slice(0, index).trim().toLowerCase();
            if (name !== parameterName)
                continue;
            return unquoteHeaderValue(parameter.slice(index + 1).trim());
        }
    }
    return undefined;
}
function getXForwardedProtoHeaderProtocol(value) {
    return normalizeForwardedProtocol(getFirstHeaderValue(value));
}
function getFirstHeaderValue(value) {
    if (value == null)
        return undefined;
    let firstValue = splitHeaderValue(value, ',')[0];
    return firstValue == null ? undefined : unquoteHeaderValue(firstValue.trim());
}
function normalizeForwardedProtocol(value) {
    if (value == null)
        return undefined;
    let protocol = value.trim().toLowerCase();
    if (protocol.endsWith(':'))
        protocol = protocol.slice(0, -1);
    return protocol === 'http' || protocol === 'https' ? `${protocol}:` : undefined;
}
function normalizeForwardedHost(value) {
    if (value == null)
        return undefined;
    let host = value.trim();
    return host === '' ? undefined : host;
}
function normalizeForwardedClientAddress(value) {
    if (value == null)
        return undefined;
    let input = value.trim();
    if (input === '' || input.toLowerCase() === 'unknown' || input.startsWith('_')) {
        return undefined;
    }
    let address = input;
    let port;
    if (address.startsWith('[')) {
        let end = address.indexOf(']');
        if (end === -1)
            return undefined;
        let portInput = address.slice(end + 1);
        address = address.slice(1, end);
        port = parseForwardedPort(portInput);
    }
    else {
        let colonIndex = address.lastIndexOf(':');
        if (colonIndex !== -1 && address.indexOf(':') === colonIndex) {
            port = parseForwardedPort(address.slice(colonIndex));
            if (port !== undefined)
                address = address.slice(0, colonIndex);
        }
    }
    return net.isIP(address) === 0 ? undefined : { address, port };
}
function parseForwardedPort(value) {
    if (!value.startsWith(':'))
        return undefined;
    let port = Number(value.slice(1));
    return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : undefined;
}
function splitHeaderValue(value, delimiter) {
    let parts = [];
    let start = 0;
    let quoted = false;
    let escaped = false;
    for (let index = 0; index < value.length; index++) {
        let char = value[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (quoted && char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') {
            quoted = !quoted;
            continue;
        }
        if (!quoted && char === delimiter) {
            parts.push(value.slice(start, index));
            start = index + 1;
        }
    }
    parts.push(value.slice(start));
    return parts;
}
function unquoteHeaderValue(value) {
    if (!value.startsWith('"') || !value.endsWith('"'))
        return value;
    let unquoted = '';
    for (let index = 1; index < value.length - 1; index++) {
        let char = value[index];
        if (char === '\\' && index + 1 < value.length - 1) {
            index++;
            unquoted += value[index];
        }
        else {
            unquoted += char;
        }
    }
    return unquoted;
}
/**
 * Creates a [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) object from the headers in a Node.js
 * [`http.IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage)/[`http2.Http2ServerRequest`](https://nodejs.org/api/http2.html#class-http2http2serverrequest).
 *
 * @param req The incoming request object
 * @returns A `Headers` object
 */
export function createHeaders(req) {
    let headers = {};
    for (let [key, value] of Object.entries(req.headers)) {
        if (key.startsWith(':') || value == null)
            continue;
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
    }
    return new Headers(headers);
}
/**
 * Sends a [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) to the client using a Node.js
 * [`http.ServerResponse`](https://nodejs.org/api/http.html#class-httpserverresponse)/[`http2.Http2ServerResponse`](https://nodejs.org/api/http2.html#class-http2http2serverresponse)
 * object.
 *
 * @param res The server response object
 * @param response The response to send
 */
export async function sendResponse(res, response) {
    // Iterate over response.headers so we are sure to send multiple Set-Cookie headers correctly.
    // These would incorrectly be merged into a single header if we tried to use
    // `Object.fromEntries(response.headers.entries())`.
    let headers = {};
    for (let [key, value] of response.headers) {
        if (key in headers) {
            if (Array.isArray(headers[key])) {
                headers[key].push(value);
            }
            else {
                headers[key] = [headers[key], value];
            }
        }
        else {
            headers[key] = value;
        }
    }
    if (res.req.httpVersionMajor === 1) {
        ;
        res.writeHead(response.status, response.statusText, headers);
    }
    else {
        // HTTP/2 doesn't support status messages
        // https://datatracker.ietf.org/doc/html/rfc7540#section-8.1.2.4
        //
        // HTTP2 `res.writeHead()` will safely ignore the statusText parameter, but
        // it will emit a warning which we want to avoid.
        // https://nodejs.org/docs/latest-v22.x/api/http2.html#responsewriteheadstatuscode-statusmessage-headers
        ;
        res.writeHead(response.status, headers);
    }
    if (response.body != null && res.req.method !== 'HEAD') {
        let reader = response.body.getReader();
        let responseClosed = false;
        function cancelBody() {
            responseClosed = true;
            void reader.cancel().catch(() => undefined);
        }
        res.once('close', cancelBody);
        try {
            while (!responseClosed) {
                let result = await reader.read();
                if (result.done)
                    break;
                // @ts-expect-error - Node typings for http2 require a 2nd parameter to write but it's optional
                if (res.write(result.value) === false) {
                    await waitForDrainOrClose(res);
                    if (responseClosed || res.destroyed)
                        return;
                }
            }
        }
        finally {
            res.removeListener('close', cancelBody);
            reader.releaseLock();
        }
        if (responseClosed)
            return;
    }
    res.end();
}
async function waitForDrainOrClose(res) {
    if (res.destroyed)
        return;
    await new Promise((resolve) => {
        function cleanup() {
            res.removeListener('close', onClose);
            res.removeListener('drain', onDrain);
        }
        function onClose() {
            cleanup();
            resolve();
        }
        function onDrain() {
            cleanup();
            resolve();
        }
        res.once('close', onClose);
        res.once('drain', onDrain);
    });
}
