export function createLazyHeaders(req, createHeaders) {
    return new LazyHeaders(req, createHeaders);
}
class LazyHeaders {
    #headers;
    #rawEntries;
    #req;
    #createHeaders;
    constructor(req, createHeaders) {
        this.#req = req;
        this.#createHeaders = createHeaders;
    }
    #materialize() {
        return (this.#headers ??= this.#createHeaders(this.#req));
    }
    #getRawEntries() {
        if (this.#rawEntries !== undefined)
            return this.#rawEntries;
        if (this.#req.httpVersionMajor !== 1) {
            this.#rawEntries = null;
            return null;
        }
        let entries = Object.entries(this.#req.headers);
        for (let [, value] of entries) {
            if (typeof value !== 'string') {
                this.#rawEntries = null;
                return null;
            }
        }
        this.#rawEntries = entries;
        return this.#rawEntries;
    }
    append(name, value) {
        this.#materialize().append(name, value);
    }
    delete(name) {
        this.#materialize().delete(name);
    }
    get(name) {
        return this.#materialize().get(name);
    }
    getSetCookie() {
        return this.#materialize().getSetCookie();
    }
    has(name) {
        return this.#materialize().has(name);
    }
    set(name, value) {
        this.#materialize().set(name, value);
    }
    entries() {
        return this[Symbol.iterator]();
    }
    forEach(callbackfn, thisArg) {
        if (this.#headers != null) {
            this.#headers.forEach(callbackfn, thisArg);
            return;
        }
        let rawEntries = this.#getRawEntries();
        if (rawEntries != null) {
            for (let [key, value] of rawEntries) {
                callbackfn.call(thisArg, value, key, this);
            }
            return;
        }
        for (let [key, value] of Object.entries(this.#req.headers)) {
            if (key.startsWith(':') || value == null)
                continue;
            callbackfn.call(thisArg, Array.isArray(value) ? value.join(', ') : value, key, this);
        }
    }
    keys() {
        let iterator = this[Symbol.iterator]();
        return {
            [Symbol.dispose]() { },
            [Symbol.iterator]() {
                return this;
            },
            next() {
                let result = iterator.next();
                if (result.done)
                    return { done: true, value: undefined };
                return { done: false, value: result.value[0] };
            },
        };
    }
    values() {
        let iterator = this[Symbol.iterator]();
        return {
            [Symbol.dispose]() { },
            [Symbol.iterator]() {
                return this;
            },
            next() {
                let result = iterator.next();
                if (result.done)
                    return { done: true, value: undefined };
                return { done: false, value: result.value[1] };
            },
        };
    }
    [Symbol.iterator]() {
        if (this.#headers != null)
            return this.#headers[Symbol.iterator]();
        let rawEntries = this.#getRawEntries();
        if (rawEntries != null) {
            return rawEntries[Symbol.iterator]();
        }
        let entries = Object.entries(this.#req.headers);
        let index = 0;
        return {
            [Symbol.dispose]() { },
            [Symbol.iterator]() {
                return this;
            },
            next() {
                while (index < entries.length) {
                    let [key, value] = entries[index++];
                    if (key.startsWith(':') || value == null)
                        continue;
                    if (Array.isArray(value))
                        return { done: false, value: [key, value.join(', ')] };
                    return { done: false, value: [key, value] };
                }
                return { done: true, value: undefined };
            },
        };
    }
}
Object.setPrototypeOf(LazyHeaders.prototype, Headers.prototype);
