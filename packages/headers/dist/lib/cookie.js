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
    #map;
    constructor(init) {
        if (init)
            return Cookie.from(init);
        this.#map = new Map();
    }
    /**
     * An array of the names of the cookies in the header.
     */
    get names() {
        return Array.from(this.#map.keys());
    }
    /**
     * An array of the values of the cookies in the header.
     */
    get values() {
        return Array.from(this.#map.values());
    }
    /**
     * The number of cookies in the header.
     */
    get size() {
        return this.#map.size;
    }
    /**
     * Gets the value of a cookie with the given name from the header.
     *
     * @param name The name of the cookie
     * @returns The value of the cookie, or `null` if the cookie does not exist
     */
    get(name) {
        return this.#map.get(name) ?? null;
    }
    /**
     * Sets a cookie with the given name and value in the header.
     *
     * @param name The name of the cookie
     * @param value The value of the cookie
     */
    set(name, value) {
        this.#map.set(name, value);
    }
    /**
     * Removes a cookie with the given name from the header.
     *
     * @param name The name of the cookie
     */
    delete(name) {
        this.#map.delete(name);
    }
    /**
     * True if a cookie with the given name exists in the header.
     *
     * @param name The name of the cookie
     * @returns `true` if a cookie with the given name exists in the header
     */
    has(name) {
        return this.#map.has(name);
    }
    /**
     * Removes all cookies from the header.
     */
    clear() {
        this.#map.clear();
    }
    /**
     * Returns an iterator of all cookie name and value pairs.
     *
     * @returns An iterator of `[name, value]` tuples
     */
    entries() {
        return this.#map.entries();
    }
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
        for (let [name, value] of this.#map) {
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
                    header.#map.set(name, val ?? '');
                }
            }
            else if (isIterable(value)) {
                for (let [name, val] of value) {
                    header.#map.set(name, val);
                }
            }
            else {
                for (let name of Object.getOwnPropertyNames(value)) {
                    header.#map.set(name, value[name]);
                }
            }
        }
        return header;
    }
}
