import { ParseError } from "../errors.js";
export function parse(source, span) {
    if (!span)
        return null;
    let protocol = source.slice(...span);
    if (protocol === '' || protocol === 'http' || protocol === 'https' || protocol === 'http(s)') {
        return protocol === '' ? null : protocol;
    }
    throw new ParseError('invalid protocol', source, span[0]);
}
