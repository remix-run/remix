/**
 * Converts a Punycode string representing a domain name or an email address
 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
 * it doesn't matter if you call it on a string that has already been
 * converted to Unicode.
 * @param input The Punycoded domain name or email address to convert to
 * Unicode.
 * @returns The Unicode representation of the given Punycode string.
 */
export declare const toUnicode: (input: string) => string;
//# sourceMappingURL=punycode.d.ts.map