import { createUwsHeaders } from "./uws-headers.js";
export function createUwsRequest(req, res, state, options, method = req.getCaseSensitiveMethod()) {
    let init = {
        method,
        headers: createRequestHeaders(req),
        signal: getAbortSignal(state),
    };
    if (requestMethodCanHaveBody(method)) {
        init.body = createBodyStream(readUwsRequestBody(res, state));
        init.duplex = 'half';
    }
    return new Request(createRequestUrl(req, options), init);
}
function createRequestHeaders(req) {
    let entries = [];
    req.forEach((key, value) => {
        entries.push([key, value]);
    });
    return createUwsHeaders(entries);
}
function getAbortSignal(state) {
    let controller = (state.controller ??= new AbortController());
    if (state.aborted)
        controller.abort();
    return controller.signal;
}
function createRequestUrl(req, options) {
    let protocol = options?.protocol ?? 'http:';
    let host = options?.host ?? (req.getHeader('host') || 'localhost');
    let query = req.getQuery();
    return `${protocol}//${host}${req.getUrl()}${query === '' ? '' : `?${query}`}`;
}
function createBodyStream(body) {
    let sent = false;
    return new ReadableStream({
        pull: async (controller) => {
            if (sent)
                return;
            sent = true;
            let buffer = await body;
            if (buffer.byteLength !== 0)
                controller.enqueue(bufferToBytes(buffer));
            controller.close();
        },
    });
}
function requestMethodCanHaveBody(method) {
    return method !== 'GET' && method !== 'HEAD';
}
function bufferToBytes(buffer) {
    let bytes = new Uint8Array(buffer.byteLength);
    bytes.set(buffer);
    return bytes;
}
function readUwsRequestBody(res, state) {
    return new Promise((resolve, reject) => {
        let firstChunk;
        let chunks;
        let length = 0;
        state.abortBody = () => {
            reject(new Error('Request aborted'));
        };
        res.onData((chunk, isLast) => {
            if (state.aborted)
                return;
            if (chunk.byteLength !== 0) {
                let buffer = Buffer.from(new Uint8Array(chunk));
                length += buffer.byteLength;
                if (firstChunk == null) {
                    firstChunk = buffer;
                }
                else {
                    chunks ??= [firstChunk];
                    chunks.push(buffer);
                }
            }
            if (isLast) {
                state.abortBody = undefined;
                if (firstChunk == null) {
                    resolve(Buffer.alloc(0));
                }
                else if (chunks == null) {
                    resolve(firstChunk);
                }
                else {
                    resolve(Buffer.concat(chunks, length));
                }
            }
        });
    });
}
