export declare function capitalize(str: string): string;
export declare function isIterable<T>(value: any): value is Iterable<T>;
export declare function isValidDate(date: unknown): boolean;
export declare function quoteEtag(tag: string): string;
/**
 * Removes milliseconds from a timestamp, returning seconds.
 * HTTP dates only have second precision, so this is useful for date comparisons.
 *
 * @param time The timestamp or Date to truncate
 * @returns The timestamp in seconds (milliseconds removed)
 */
export declare function removeMilliseconds(time: number | Date): number;
/**
 * Parses an HTTP date header value.
 *
 * HTTP dates must follow RFC 7231 IMF-fixdate format:
 * "Day, DD Mon YYYY HH:MM:SS GMT" (e.g., "Wed, 21 Oct 2015 07:28:00 GMT")
 *
 * [RFC 7231 Section 7.1.1.1](https://datatracker.ietf.org/doc/html/rfc7231#section-7.1.1.1)
 *
 * @param dateString The HTTP date string to parse
 * @returns The timestamp in milliseconds, or null if invalid
 */
export declare function parseHttpDate(dateString: string): number | null;
//# sourceMappingURL=utils.d.ts.map