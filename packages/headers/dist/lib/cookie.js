import {} from "./header-value.js";
import { parseParams, quote } from "./param-values.js";
import { isIterable } from "./utils.js";
/**
 * The value of a `Cookie` HTTP header.
 *
 * [MDN `Cookie` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc6265#section-4.2)
 */
export class Cookie {
    #cookies;
    constructor(init) {
        if (init)
            return Cookie.from(init);
        this.#cookies = [];
    }
    /**
     * An array of the names of the cookies in the header.
     */
    get names() {
        return this.#cookies.map(([name]) => name);
    }
    /**
     * An array of the values of the cookies in the header.
     */
    get values() {
        return this.#cookies.map(([, value]) => value);
    }
    /**
     * The number of cookies in the header.
     */
    get size() {
        return this.#cookies.length;
    }
    /**
     * Gets the first value of a cookie with the given name from the header.
     *
     * @param name The name of the cookie
     * @returns The first value of the cookie, or `null` if the cookie does not exist
     */
    get(name) {
        let cookie = this.#cookies.find(([cookieName]) => cookieName === name);
        return cookie?.[1] ?? null;
    }
    /**
     * Gets all values of cookies with the given name from the header.
     *
     * @param name The name of the cookie
     * @returns The values of all matching cookies, or an empty array if none exist
     */
    getAll(name) {
        return this.#cookies.filter(([cookieName]) => cookieName === name).map(([, value]) => value);
    }
    /**
     * Sets a cookie with the given name and value in the header, replacing any existing values.
     *
     * @param name The name of the cookie
     * @param value The value of the cookie
     */
    set(name, value) {
        let index = this.#cookies.findIndex(([cookieName]) => cookieName === name);
        if (index === -1) {
            this.#cookies.push([name, value]);
        }
        else {
            this.#cookies[index] = [name, value];
            this.#cookies = this.#cookies.filter(([cookieName], cookieIndex) => cookieName !== name || cookieIndex === index);
        }
    }
    /**
     * Appends a cookie with the given name and value to the header.
     *
     * @param name The name of the cookie
     * @param value The value of the cookie
     */
    append(name, value) {
        this.#cookies.push([name, value]);
    }
    /**
     * Removes all cookies with the given name from the header.
     *
     * @param name The name of the cookie
     */
    delete(name) {
        this.#cookies = this.#cookies.filter(([cookieName]) => cookieName !== name);
    }
    /**
     * True if a cookie with the given name exists in the header.
     *
     * @param name The name of the cookie
     * @returns `true` if a cookie with the given name exists in the header
     */
    has(name) {
        return this.#cookies.some(([cookieName]) => cookieName === name);
    }
    /**
     * Removes all cookies from the header.
     */
    clear() {
        this.#cookies = [];
    }
    /**
     * Returns an iterator of all cookie name and value pairs.
     *
     * @returns An iterator of `[name, value]` tuples
     */
    *entries() {
        for (let [name, value] of this.#cookies) {
            yield [name, value];
        }
    }
    /**
     * Iterates over cookie name and value pairs.
     *
     * @returns An iterator of `[name, value]` tuples.
     */
    [Symbol.iterator]() {
        return this.entries();
    }
    /**
     * Invokes the callback for each cookie name and value pair.
     *
     * @param callback The function to call for each pair
     * @param thisArg The value to use as `this` when calling the callback
     */
    forEach(callback, thisArg) {
        for (let [name, value] of this) {
            callback.call(thisArg, name, value, this);
        }
    }
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString() {
        let pairs = [];
        for (let [name, value] of this.#cookies) {
            pairs.push(`${name}=${quote(value)}`);
        }
        return pairs.join('; ');
    }
    /**
     * Parse a Cookie header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns A Cookie instance (empty if null)
     */
    static from(value) {
        let header = new Cookie();
        if (value !== null) {
            if (typeof value === 'string') {
                let params = parseParams(value);
                for (let [name, val] of params) {
                    header.#cookies.push([name, val ?? '']);
                }
            }
            else if (isIterable(value)) {
                for (let [name, val] of value) {
                    header.#cookies.push([name, val]);
                }
            }
            else {
                for (let name of Object.getOwnPropertyNames(value)) {
                    header.#cookies.push([name, value[name]]);
                }
            }
        }
        return header;
    }
}
