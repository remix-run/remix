export function createUwsHeaders(entries) {
    return new UwsHeaders(entries);
}
class UwsHeaders {
    #headers;
    #entries;
    constructor(entries) {
        this.#entries = entries;
    }
    #materialize() {
        return (this.#headers ??= new Headers(this.#entries));
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
        if (this.#headers != null)
            return this.#headers.getSetCookie();
        let values = [];
        for (let [key, value] of this.#entries) {
            if (key.toLowerCase() === 'set-cookie')
                values.push(value);
        }
        return values;
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
        for (let [key, value] of this.#entries) {
            callbackfn.call(thisArg, value, key, this);
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
        return this.#entries[Symbol.iterator]();
    }
}
Object.setPrototypeOf(UwsHeaders.prototype, Headers.prototype);
