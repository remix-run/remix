import {} from './header-value.js';
import { parseParams } from './param-values.js';
import { isIterable, splitList } from './utils.js';
/**
 * The value of a `Accept` HTTP header.
 *
 * [MDN `Accept` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.2)
 */
export class Accept {
    #map;
    constructor(init) {
        if (init)
            return Accept.from(init);
        this.#map = new Map();
    }
    #sort() {
        this.#map = new Map([...this.#map].sort((a, b) => b[1] - a[1]));
    }
    /**
     * An array of all media types in the header.
     */
    get mediaTypes() {
        return Array.from(this.#map.keys());
    }
    /**
     * An array of all weights (q values) in the header.
     */
    get weights() {
        return Array.from(this.#map.values());
    }
    /**
     * The number of media types in the `Accept` header.
     */
    get size() {
        return this.#map.size;
    }
    /**
     * Returns `true` if the header matches the given media type (i.e. it is "acceptable").
     *
     * @param mediaType The media type to check
     * @returns `true` if the media type is acceptable, `false` otherwise
     */
    accepts(mediaType) {
        return this.getWeight(mediaType) > 0;
    }
    /**
     * Gets the weight of a given media type.
     *
     * When several media ranges in the header match, the most specific one wins, as described in
     * [RFC 9110 Section 12.5.1](https://www.rfc-editor.org/rfc/rfc9110#section-12.5.1). An exact
     * `type/subtype` takes precedence over `type/*`, which takes precedence over the full wildcard,
     * regardless of their order or weights in the header. For example, `text/html;q=0, text/*` gives
     * `text/html` a weight of `0`.
     *
     * The given media type may also contain wildcards, so e.g. `text/*` returns the highest weight any
     * `text` media type could receive from this header.
     *
     * @param mediaType The media type to get the weight of
     * @returns The weight of the media type, or `0` if it is not acceptable
     */
    getWeight(mediaType) {
        let [type, subtype] = mediaType.toLowerCase().split('/');
        let matchWeight = 0;
        let matchSpecificity = -1;
        let narrowerWeight = 0;
        for (let [key, weight] of this) {
            let [t, s] = key.split('/');
            if ((t === type || t === '*') && (s === subtype || s === '*')) {
                let specificity = (t === '*' ? 0 : 1) + (s === '*' ? 0 : 1);
                if (specificity > matchSpecificity) {
                    matchWeight = weight;
                    matchSpecificity = specificity;
                }
            }
            else if ((type === '*' || t === type) && (subtype === '*' || s === subtype)) {
                // A range that is narrower than a wildcard query, e.g. `text/html` for `text/*`
                narrowerWeight = Math.max(narrowerWeight, weight);
            }
        }
        return Math.max(matchWeight, narrowerWeight);
    }
    /**
     * Returns the most preferred media type from the given list of media types. Each media type is
     * weighted using {@link Accept.getWeight}, so the most specific matching range applies.
     *
     * @param mediaTypes The list of media types to choose from
     * @returns The most preferred media type or `null` if none match
     */
    getPreferred(mediaTypes) {
        let sorted = mediaTypes
            .map((mediaType) => [mediaType, this.getWeight(mediaType)])
            .sort((a, b) => b[1] - a[1]);
        let first = sorted[0];
        return first !== undefined && first[1] > 0 ? first[0] : null;
    }
    /**
     * Returns the weight of a media type. If it is not in the header verbatim, this returns `null`.
     *
     * @param mediaType The media type to get the weight of
     * @returns The weight of the media type, or `null` if it is not in the header
     */
    get(mediaType) {
        return this.#map.get(mediaType.toLowerCase()) ?? null;
    }
    /**
     * Sets a media type with the given weight.
     *
     * @param mediaType The media type to set
     * @param weight The weight of the media type (default: `1`)
     */
    set(mediaType, weight = 1) {
        this.#map.set(mediaType.toLowerCase(), weight);
        this.#sort();
    }
    /**
     * Removes the given media type from the header.
     *
     * @param mediaType The media type to remove
     */
    delete(mediaType) {
        this.#map.delete(mediaType.toLowerCase());
    }
    /**
     * Checks if a media type is in the header.
     *
     * @param mediaType The media type to check
     * @returns `true` if the media type is in the header (verbatim), `false` otherwise
     */
    has(mediaType) {
        return this.#map.has(mediaType.toLowerCase());
    }
    /**
     * Removes all media types from the header.
     */
    clear() {
        this.#map.clear();
    }
    /**
     * Returns an iterator of all media type and weight pairs.
     *
     * @returns An iterator of `[mediaType, weight]` tuples
     */
    entries() {
        return this.#map.entries();
    }
    /**
     * Iterates over media type and weight pairs in preference order.
     *
     * @returns An iterator of `[mediaType, weight]` tuples.
     */
    [Symbol.iterator]() {
        return this.entries();
    }
    /**
     * Invokes the callback for each media type and weight pair.
     *
     * @param callback The function to call for each pair
     * @param thisArg The value to use as `this` when calling the callback
     */
    forEach(callback, thisArg) {
        for (let [mediaType, weight] of this) {
            callback.call(thisArg, mediaType, weight, this);
        }
    }
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString() {
        let pairs = [];
        for (let [mediaType, weight] of this.#map) {
            pairs.push(`${mediaType}${weight === 1 ? '' : `;q=${weight}`}`);
        }
        return pairs.join(',');
    }
    /**
     * Parse an Accept header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns An Accept instance (empty if null)
     */
    static from(value) {
        let header = new Accept();
        if (value !== null) {
            if (typeof value === 'string') {
                for (let piece of splitList(value)) {
                    let params = parseParams(piece);
                    if (params.length < 1)
                        continue;
                    let mediaType = params[0][0];
                    let weight = 1;
                    for (let i = 1; i < params.length; i++) {
                        let [key, val] = params[i];
                        if (key === 'q') {
                            weight = Number(val);
                            break;
                        }
                    }
                    header.#map.set(mediaType.toLowerCase(), weight);
                }
            }
            else if (isIterable(value)) {
                for (let mediaType of value) {
                    if (Array.isArray(mediaType)) {
                        header.#map.set(mediaType[0].toLowerCase(), mediaType[1]);
                    }
                    else {
                        header.#map.set(mediaType.toLowerCase(), 1);
                    }
                }
            }
            else {
                for (let mediaType of Object.getOwnPropertyNames(value)) {
                    header.#map.set(mediaType.toLowerCase(), value[mediaType]);
                }
            }
            header.#sort();
        }
        return header;
    }
}
