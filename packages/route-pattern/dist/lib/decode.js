export { toUnicode as decodeHostname } from "./punycode.js";
/**
 * Decodes valid percent-escape sequences, or returns the input unchanged when
 * it contains invalid ones.
 *
 * @param source String to decode.
 * @returns Decoded string, or `source` when it contains invalid percent-escape sequences.
 */
export function decodePathname(source) {
    // coarse check for percent-encoded sequences; skip if none found.
    if (!source.includes('%'))
        return source;
    try {
        return decodeURI(source);
    }
    catch {
        return source;
    }
}
/**
 * Decodes a URL pathname while retaining enough raw source information to decode
 * matched params exactly once after route shape matching has completed.
 *
 * @param source URL pathname without a leading slash.
 * @returns Decoded pathname and a param value decoder.
 */
export function decodePathnameWithParams(source) {
    let pathname = decodePathname(source);
    let rawIndexByDecodedIndex;
    return {
        pathname,
        param(begin, end) {
            if (pathname === source) {
                return decodePathnameParam(source.slice(begin, end));
            }
            if (rawIndexByDecodedIndex === undefined) {
                rawIndexByDecodedIndex = createRawIndexByDecodedIndex(source, pathname);
            }
            if (rawIndexByDecodedIndex === null) {
                return decodePathnameParam(pathname.slice(begin, end));
            }
            let rawBegin = rawIndexByDecodedIndex[begin];
            let rawEnd = rawIndexByDecodedIndex[end];
            if (rawBegin === undefined || rawEnd === undefined) {
                return decodePathnameParam(pathname.slice(begin, end));
            }
            return decodePathnameParam(source.slice(rawBegin, rawEnd));
        },
    };
}
function decodePathnameParam(source) {
    if (!source.includes('%'))
        return source;
    try {
        return decodeURIComponent(source);
    }
    catch {
        return source;
    }
}
const decodeUriReservedBytes = new Set([
    0x23, // #
    0x24, // $
    0x26, // &
    0x2b, // +
    0x2c, // ,
    0x2f, // /
    0x3a, // :
    0x3b, // ;
    0x3d, // =
    0x3f, // ?
    0x40, // @
]);
function createRawIndexByDecodedIndex(source, decoded) {
    let result = [0];
    let rawIndex = 0;
    let decodedIndex = 0;
    while (rawIndex < source.length) {
        if (source[rawIndex] === '%') {
            let byte = readPercentEncodedByte(source, rawIndex);
            if (byte !== undefined) {
                if (decodeUriReservedBytes.has(byte)) {
                    rawIndex = appendLiteralDecodedCharIndexes(result, rawIndex, decodedIndex, 3);
                    decodedIndex += 3;
                    continue;
                }
                let byteCount = utf8ByteCount(byte);
                let rawEnd = rawIndex + byteCount * 3;
                let decodedText;
                try {
                    decodedText = decodeURI(source.slice(rawIndex, rawEnd));
                }
                catch {
                    return null;
                }
                rawIndex = rawEnd;
                for (let i = 0; i < decodedText.length; i++) {
                    result[++decodedIndex] = rawIndex;
                }
                continue;
            }
        }
        rawIndex = appendLiteralDecodedCharIndexes(result, rawIndex, decodedIndex, 1);
        decodedIndex += 1;
    }
    if (decodedIndex !== decoded.length) {
        return null;
    }
    return result;
}
function appendLiteralDecodedCharIndexes(result, rawIndex, decodedIndex, length) {
    for (let i = 1; i <= length; i++) {
        result[decodedIndex + i] = rawIndex + i;
    }
    return rawIndex + length;
}
function readPercentEncodedByte(source, index) {
    let hex = source.slice(index + 1, index + 3);
    if (hex.length !== 2 || !/^[\dA-Fa-f]{2}$/.test(hex))
        return undefined;
    return Number.parseInt(hex, 16);
}
function utf8ByteCount(byte) {
    if (byte < 0x80)
        return 1;
    if (byte >= 0xc2 && byte <= 0xdf)
        return 2;
    if (byte >= 0xe0 && byte <= 0xef)
        return 3;
    if (byte >= 0xf0 && byte <= 0xf4)
        return 4;
    return 1;
}
