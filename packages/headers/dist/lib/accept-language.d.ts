import { type HeaderValue } from './header-value.ts';
/**
 * Initializer for an `Accept-Language` header value.
 */
export type AcceptLanguageInit = Iterable<string | [string, number]> | Record<string, number>;
/**
 * The value of a `Accept-Language` HTTP header.
 *
 * [MDN `Accept-Language` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.5)
 */
export declare class AcceptLanguage implements HeaderValue, Iterable<[string, number]> {
    #private;
    constructor(init?: string | AcceptLanguageInit);
    /**
     * An array of all languages in the header.
     */
    get languages(): string[];
    /**
     * An array of all weights (q values) in the header.
     */
    get weights(): number[];
    /**
     * The number of languages in the header.
     */
    get size(): number;
    /**
     * Returns `true` if the header matches the given language (i.e. it is "acceptable").
     *
     * @param language The locale identifier of the language to check
     * @returns `true` if the language is acceptable, `false` otherwise
     */
    accepts(language: string): boolean;
    /**
     * Gets the weight of a language with the given locale identifier. Performs wildcard and subtype
     * matching, so `en` matches `en-US` and `en-GB`, and `*` matches all languages.
     *
     * @param language The locale identifier of the language to get
     * @returns The weight of the language, or `0` if it is not in the header
     */
    getWeight(language: string): number;
    /**
     * Returns the most preferred language from the given list of languages.
     *
     * @param languages The locale identifiers of the languages to choose from
     * @returns The most preferred language or `null` if none match
     */
    getPreferred<language extends string>(languages: readonly language[]): language | null;
    /**
     * Gets the weight of a language with the given locale identifier. If it is not in the header
     * verbatim, this returns `null`.
     *
     * @param language The locale identifier of the language to get
     * @returns The weight of the language, or `null` if it is not in the header
     */
    get(language: string): number | null;
    /**
     * Sets a language with the given weight.
     *
     * @param language The locale identifier of the language to set
     * @param weight The weight of the language (default: `1`)
     */
    set(language: string, weight?: number): void;
    /**
     * Removes a language with the given locale identifier.
     *
     * @param language The locale identifier of the language to remove
     */
    delete(language: string): void;
    /**
     * Checks if the header contains a language with the given locale identifier.
     *
     * @param language The locale identifier of the language to check
     * @returns `true` if the language is in the header, `false` otherwise
     */
    has(language: string): boolean;
    /**
     * Removes all languages from the header.
     */
    clear(): void;
    /**
     * Returns an iterator of all language and weight pairs.
     *
     * @returns An iterator of `[language, weight]` tuples
     */
    entries(): IterableIterator<[string, number]>;
    [Symbol.iterator](): IterableIterator<[string, number]>;
    /**
     * Invokes the callback for each language and weight pair.
     *
     * @param callback The function to call for each pair
     * @param thisArg The value to use as `this` when calling the callback
     */
    forEach(callback: (language: string, weight: number, header: AcceptLanguage) => void, thisArg?: any): void;
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString(): string;
    /**
     * Parse an Accept-Language header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns An AcceptLanguage instance (empty if null)
     */
    static from(value: string | AcceptLanguageInit | null): AcceptLanguage;
}
//# sourceMappingURL=accept-language.d.ts.map