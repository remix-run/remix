import {} from "./header-value.js";
/**
 * The value of a `Vary` HTTP header.
 *
 * The `Vary` header indicates which request headers affect whether a cached
 * response can be used, enabling proper content negotiation caching.
 *
 * Header names are normalized to lowercase for case-insensitive comparison.
 *
 * [MDN `Vary` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary)
 *
 * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.vary)
 */
export class Vary {
    #set;
    constructor(init) {
        if (init)
            return Vary.from(init);
        this.#set = new Set();
    }
    /**
     * An array of the header names (normalized to lowercase).
     */
    get headerNames() {
        return Array.from(this.#set);
    }
    /**
     * The number of header names in the Vary header.
     */
    get size() {
        return this.#set.size;
    }
    /**
     * Checks if the Vary header includes the given header name (case-insensitive).
     * @param headerName The header name to check for.
     * @returns `true` if the header name is present, `false` otherwise.
     */
    has(headerName) {
        return this.#set.has(headerName.toLowerCase());
    }
    /**
     * Adds a header name to the Vary header (case-insensitive).
     * If the header name already exists, this is a no-op.
     * @param headerName The header name to add.
     */
    add(headerName) {
        let trimmed = headerName.trim();
        if (trimmed) {
            this.#set.add(trimmed.toLowerCase());
        }
    }
    /**
     * Removes a header name from the Vary header (case-insensitive).
     * @param headerName The header name to remove.
     */
    delete(headerName) {
        this.#set.delete(headerName.toLowerCase());
    }
    /**
     * Removes all header names from the Vary header.
     */
    clear() {
        this.#set.clear();
    }
    /**
     * Calls a callback function for each header name in the Vary header.
     * @param callback The callback function to call for each header name.
     * @param thisArg Optional value to use as `this` when executing the callback.
     */
    forEach(callback, thisArg) {
        for (let headerName of this) {
            callback.call(thisArg, headerName, this);
        }
    }
    [Symbol.iterator]() {
        return this.#set.values();
    }
    toString() {
        return Array.from(this.#set).join(', ');
    }
    /**
     * Parse a Vary header value.
     *
     * @param value The header value (string, string[], init object, or null)
     * @returns A Vary instance (empty if null)
     */
    static from(value) {
        let header = new Vary();
        if (value !== null) {
            if (typeof value === 'string') {
                for (let headerName of value.split(',')) {
                    let trimmed = headerName.trim();
                    if (trimmed) {
                        header.#set.add(trimmed.toLowerCase());
                    }
                }
            }
            else if (Array.isArray(value)) {
                for (let headerName of value) {
                    let trimmed = headerName.trim();
                    if (trimmed) {
                        header.#set.add(trimmed.toLowerCase());
                    }
                }
            }
            else {
                for (let headerName of value.headerNames) {
                    let trimmed = headerName.trim();
                    if (trimmed) {
                        header.#set.add(trimmed.toLowerCase());
                    }
                }
            }
        }
        return header;
    }
}
