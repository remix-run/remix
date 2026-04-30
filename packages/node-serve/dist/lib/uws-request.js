import { createUwsHeaders } from "./uws-headers.js";
export function createUwsRequest(req, res, state, options, method = req.getCaseSensitiveMethod()) {
    return new UwsRequest(req, res, state, options, method);
}
class UwsRequest {
    #request;
    #headers;
    #bodyPromise;
    #bodyUsed = false;
    #method;
    #url;
    #protocol;
    #host;
    #path;
    #query;
    #state;
    constructor(req, res, state, options, method) {
        this.#state = state;
        this.#method = method;
        let entries = [];
        req.forEach((key, value) => {
            entries.push([key, value]);
        });
        this.#headers = createUwsHeaders(entries);
        this.#protocol = options?.protocol ?? 'http:';
        this.#host = options?.host ?? (req.getHeader('host') || 'localhost');
        this.#path = req.getUrl();
        this.#query = req.getQuery();
        if (requestMethodCanHaveBody(this.#method)) {
            this.#bodyPromise = readUwsRequestBody(res, state);
        }
    }
    #materialize() {
        if (this.#request != null)
            return this.#request;
        let init = {
            method: this.#method,
            headers: this.#headers,
            signal: this.signal,
        };
        if (requestMethodCanHaveBody(this.#method)) {
            init.body = this.#createBodyStream();
            init.duplex = 'half';
        }
        return (this.#request = new Request(this.url, init));
    }
    #createBodyStream() {
        let sent = false;
        return new ReadableStream({
            pull: async (controller) => {
                if (sent)
                    return;
                sent = true;
                let body = await this.#readBody();
                if (body.byteLength !== 0)
                    controller.enqueue(bufferToBytes(body));
                controller.close();
            },
        });
    }
    get body() {
        return this.#materialize().body;
    }
    get bodyUsed() {
        return this.#bodyUsed || this.#request?.bodyUsed === true;
    }
    get cache() {
        return this.#materialize().cache;
    }
    get credentials() {
        return this.#materialize().credentials;
    }
    get destination() {
        return this.#materialize().destination;
    }
    get headers() {
        return this.#headers;
    }
    get integrity() {
        return this.#materialize().integrity;
    }
    get keepalive() {
        return this.#materialize().keepalive;
    }
    get method() {
        return this.#method;
    }
    get mode() {
        return this.#materialize().mode;
    }
    get redirect() {
        return this.#materialize().redirect;
    }
    get referrer() {
        return this.#materialize().referrer;
    }
    get referrerPolicy() {
        return this.#materialize().referrerPolicy;
    }
    get signal() {
        let controller = (this.#state.controller ??= new AbortController());
        if (this.#state.aborted)
            controller.abort();
        return controller.signal;
    }
    get url() {
        return (this.#url ??= `${this.#protocol}//${this.#host}${this.#path}${this.#query === '' ? '' : `?${this.#query}`}`);
    }
    arrayBuffer() {
        if (this.#request != null && !this.#bodyUsed)
            return this.#request.arrayBuffer();
        return this.#consumeBody().then(bufferToArrayBuffer);
    }
    blob() {
        if (this.#request != null && !this.#bodyUsed)
            return this.#request.blob();
        return this.#consumeBody().then((body) => new Blob([bufferToBytes(body)]));
    }
    bytes() {
        if (this.#request != null && !this.#bodyUsed)
            return this.#request.bytes();
        return this.#consumeBody().then(bufferToBytes);
    }
    clone() {
        if (this.bodyUsed)
            throw bodyUnusable();
        return this.#materialize().clone();
    }
    formData() {
        return this.#materialize().formData();
    }
    json() {
        if (this.#request != null && !this.#bodyUsed)
            return this.#request.json();
        return this.text().then(JSON.parse);
    }
    text() {
        if (this.#request != null && !this.#bodyUsed)
            return this.#request.text();
        return this.#consumeBody().then((body) => body.toString());
    }
    #consumeBody() {
        if (!requestMethodCanHaveBody(this.#method))
            return Promise.resolve(Buffer.alloc(0));
        if (this.#bodyUsed)
            return Promise.reject(bodyUnusable());
        this.#bodyUsed = true;
        return this.#readBody();
    }
    #readBody() {
        return this.#bodyPromise ?? Promise.resolve(Buffer.alloc(0));
    }
}
Object.setPrototypeOf(UwsRequest.prototype, Request.prototype);
function requestMethodCanHaveBody(method) {
    return method !== 'GET' && method !== 'HEAD';
}
function bufferToArrayBuffer(buffer) {
    return bufferToBytes(buffer).buffer;
}
function bufferToBytes(buffer) {
    let bytes = new Uint8Array(buffer.byteLength);
    bytes.set(buffer);
    return bytes;
}
function bodyUnusable() {
    return new TypeError('Body is unusable: Body has already been read');
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
