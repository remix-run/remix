export { toUnicode as decodeHostname } from './punycode.ts';
/**
 * Decodes valid percent-escape sequences, or returns the input unchanged when
 * it contains invalid ones.
 *
 * @param source String to decode.
 * @returns Decoded string, or `source` when it contains invalid percent-escape sequences.
 */
export declare function decodePathname(source: string): string;
/**
 * Decodes a URL pathname while retaining enough raw source information to decode
 * matched params exactly once after route shape matching has completed.
 *
 * @param source URL pathname without a leading slash.
 * @returns Decoded pathname and a param value decoder.
 */
export declare function decodePathnameWithParams(source: string): {
    pathname: string;
    param(begin: number, end: number): string;
};
//# sourceMappingURL=decode.d.ts.map