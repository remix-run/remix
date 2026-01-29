import { PartPattern } from "./part-pattern.js";
export function parse(source, span) {
    if (!span)
        return null;
    let part = PartPattern.parse(source, {
        span,
        type: 'hostname',
        ignoreCase: false,
    });
    if (isNamelessWildcard(part))
        return null;
    return part;
}
function isNamelessWildcard(part) {
    if (part.tokens.length !== 1)
        return false;
    let token = part.tokens[0];
    if (token.type !== '*')
        return false;
    return token.name === '*';
}
