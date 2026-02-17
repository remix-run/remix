import { type HeaderValue } from './header-value.ts';
/**
 * Initializer for an `Accept` header value.
 */
export type AcceptInit = Iterable<string | [string, number]> | Record<string, number>;
/**
 * The value of a `Accept` HTTP header.
 *
 * [MDN `Accept` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.2)
 */
export declare class Accept implements HeaderValue, Iterable<[string, number]> {
    #private;
    constructor(init?: string | AcceptInit);
    /**
     * An array of all media types in the header.
     */
    get mediaTypes(): string[];
    /**
     * An array of all weights (q values) in the header.
     */
    get weights(): number[];
    /**
     * The number of media types in the `Accept` header.
     */
    get size(): number;
    /**
     * Returns `true` if the header matches the given media type (i.e. it is "acceptable").
     *
     * @param mediaType The media type to check
     * @returns `true` if the media type is acceptable, `false` otherwise
     */
    accepts(mediaType: string): boolean;
    /**
     * Gets the weight of a given media type. Also supports wildcards, so e.g. `text/*` will match `text/html`.
     *
     * @param mediaType The media type to get the weight of
     * @returns The weight of the media type
     */
    getWeight(mediaType: string): number;
    /**
     * Returns the most preferred media type from the given list of media types.
     *
     * @param mediaTypes The list of media types to choose from
     * @returns The most preferred media type or `null` if none match
     */
    getPreferred<mediaType extends string>(mediaTypes: readonly mediaType[]): mediaType | null;
    /**
     * Returns the weight of a media type. If it is not in the header verbatim, this returns `null`.
     *
     * @param mediaType The media type to get the weight of
     * @returns The weight of the media type, or `null` if it is not in the header
     */
    get(mediaType: string): number | null;
    /**
     * Sets a media type with the given weight.
     *
     * @param mediaType The media type to set
     * @param weight The weight of the media type (default: `1`)
     */
    set(mediaType: string, weight?: number): void;
    /**
     * Removes the given media type from the header.
     *
     * @param mediaType The media type to remove
     */
    delete(mediaType: string): void;
    /**
     * Checks if a media type is in the header.
     *
     * @param mediaType The media type to check
     * @returns `true` if the media type is in the header (verbatim), `false` otherwise
     */
    has(mediaType: string): boolean;
    /**
     * Removes all media types from the header.
     */
    clear(): void;
    /**
     * Returns an iterator of all media type and weight pairs.
     *
     * @returns An iterator of `[mediaType, weight]` tuples
     */
    entries(): IterableIterator<[string, number]>;
    [Symbol.iterator](): IterableIterator<[string, number]>;
    /**
     * Invokes the callback for each media type and weight pair.
     *
     * @param callback The function to call for each pair
     * @param thisArg The value to use as `this` when calling the callback
     */
    forEach(callback: (mediaType: string, weight: number, header: Accept) => void, thisArg?: any): void;
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString(): string;
    /**
     * Parse an Accept header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns An Accept instance (empty if null)
     */
    static from(value: string | AcceptInit | null): Accept;
}
//# sourceMappingURL=accept.d.ts.map