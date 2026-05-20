export { toUnicode as decodeHostname } from './punycode.ts';
/**
 * Decodes valid percent-escape sequences, or returns the input unchanged when
 * it contains invalid ones.
 *
 * @param source String to decode.
 * @returns Decoded string, or `source` when it contains invalid percent-escape sequences.
 */
export declare function decodePathname(source: string): string;
//# sourceMappingURL=decode.d.ts.map