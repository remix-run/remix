import { createLazyHeaders } from "./lazy-headers.js";
export function createLazyRequest(req, res, options, createRequest, createHeaders) {
    return new LazyRequest(req, res, options, createRequest, createHeaders);
}
export function createLazyRequestFactory(options, createRequest, createHeaders) {
    class BoundLazyRequest {
        #request;
        #headers;
        #bodyUsed = false;
        #req;
        #res;
        #method;
        constructor(req, res) {
            this.#req = req;
            this.#res = res;
            this.#method = req.method ?? 'GET';
        }
        #materialize() {
            return (this.#request ??= createRequest(this.#req, this.#res, options));
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
            return (this.#headers ??= createLazyHeaders(this.#req, createHeaders));
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
            return this.#materialize().signal;
        }
        get url() {
            return this.#materialize().url;
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
            return this.#consumeTextBody();
        }
        #consumeBody() {
            if (!requestMethodCanHaveBody(this.#method))
                return Promise.resolve(Buffer.alloc(0));
            if (this.#bodyUsed)
                return Promise.reject(bodyUnusable());
            this.#bodyUsed = true;
            return readRequestBody(this.#req);
        }
        #consumeTextBody() {
            if (!requestMethodCanHaveBody(this.#method))
                return Promise.resolve('');
            if (this.#bodyUsed)
                return Promise.reject(bodyUnusable());
            this.#bodyUsed = true;
            return readRequestText(this.#req);
        }
    }
    Object.setPrototypeOf(BoundLazyRequest.prototype, Request.prototype);
    return (req, res) => new BoundLazyRequest(req, res);
}
class LazyRequest {
    #request;
    #headers;
    #bodyUsed = false;
    #req;
    #res;
    #options;
    #createRequest;
    #createHeaders;
    #method;
    constructor(req, res, options, createRequest, createHeaders) {
        this.#req = req;
        this.#res = res;
        this.#options = options;
        this.#createRequest = createRequest;
        this.#createHeaders = createHeaders;
        this.#method = req.method ?? 'GET';
    }
    #materialize() {
        return (this.#request ??= this.#createRequest(this.#req, this.#res, this.#options));
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
        return (this.#headers ??= createLazyHeaders(this.#req, this.#createHeaders));
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
        return this.#materialize().signal;
    }
    get url() {
        return this.#materialize().url;
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
        return this.#consumeTextBody();
    }
    #consumeBody() {
        if (!requestMethodCanHaveBody(this.#method))
            return Promise.resolve(Buffer.alloc(0));
        if (this.#bodyUsed)
            return Promise.reject(bodyUnusable());
        this.#bodyUsed = true;
        return readRequestBody(this.#req);
    }
    #consumeTextBody() {
        if (!requestMethodCanHaveBody(this.#method))
            return Promise.resolve('');
        if (this.#bodyUsed)
            return Promise.reject(bodyUnusable());
        this.#bodyUsed = true;
        return readRequestText(this.#req);
    }
}
Object.setPrototypeOf(LazyRequest.prototype, Request.prototype);
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
function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        let firstChunk;
        let chunks;
        let length = 0;
        function cleanup() {
            req.off('data', onData);
            req.off('end', onEnd);
            req.off('error', onError);
        }
        function onData(buffer) {
            length += buffer.byteLength;
            if (firstChunk == null) {
                firstChunk = buffer;
            }
            else {
                chunks ??= [firstChunk];
                chunks.push(buffer);
            }
        }
        function onEnd() {
            cleanup();
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
        function onError(error) {
            cleanup();
            reject(error);
        }
        req.on('data', onData);
        req.once('end', onEnd);
        req.once('error', onError);
    });
}
function readRequestText(req) {
    return new Promise((resolve, reject) => {
        let firstChunk;
        let chunks;
        let length = 0;
        function cleanup() {
            req.off('data', onData);
            req.off('end', onEnd);
            req.off('error', onError);
        }
        function onData(buffer) {
            length += buffer.byteLength;
            if (firstChunk == null) {
                firstChunk = buffer;
            }
            else {
                chunks ??= [firstChunk];
                chunks.push(buffer);
            }
        }
        function onEnd() {
            cleanup();
            if (firstChunk == null) {
                resolve('');
            }
            else if (chunks == null) {
                resolve(firstChunk.toString());
            }
            else {
                resolve(Buffer.concat(chunks, length).toString());
            }
        }
        function onError(error) {
            cleanup();
            reject(error);
        }
        req.on('data', onData);
        req.once('end', onEnd);
        req.once('error', onError);
    });
}
