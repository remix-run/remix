export function stringify(parsed) {
    let str = '';
    if (parsed.hostname != null) {
        let protocol = parsed.protocol != null ? stringifyTokens(parsed.protocol) : '';
        let hostname = parsed.hostname != null ? stringifyTokens(parsed.hostname, '.') : '';
        let port = parsed.port != null ? `:${parsed.port}` : '';
        str += `${protocol}://${hostname}${port}`;
    }
    if (parsed.pathname != null) {
        let pathname = stringifyTokens(parsed.pathname, '/');
        str += startsWithSeparator(parsed.pathname) ? pathname : `/${pathname}`;
    }
    else {
        str += '/';
    }
    if (parsed.search) {
        str += `?${parsed.search}`;
    }
    else if (parsed.searchConstraints != null) {
        let search = stringifySearchConstraints(parsed.searchConstraints);
        if (search !== '') {
            str += `?${search}`;
        }
    }
    return str;
}
export function startsWithSeparator(tokens) {
    if (tokens.length === 0)
        return false;
    let firstToken = tokens[0];
    if (firstToken.type === 'separator')
        return true;
    // Check if it starts with an optional that contains a separator
    if (firstToken.type === 'optional' && firstToken.tokens && firstToken.tokens.length > 0) {
        return startsWithSeparator(firstToken.tokens);
    }
    return false;
}
export function stringifyTokens(tokens, sep = '') {
    let str = '';
    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];
        if (token.type === 'variable') {
            str += `:${token.name}`;
        }
        else if (token.type === 'wildcard') {
            str += `*${token.name ?? ''}`;
        }
        else if (token.type === 'text') {
            str += token.value;
        }
        else if (token.type === 'separator') {
            str += sep;
        }
        else if (token.type === 'optional') {
            str += `(${stringifyTokens(token.tokens, sep)})`;
        }
    }
    return str;
}
export function stringifySearchConstraints(search) {
    let parts = [];
    for (let [key, value] of search.entries()) {
        if (value.allowBare && !value.requireAssignment) {
            // Parameter can appear without assignment (e.g., just "debug")
            parts.push(key);
        }
        else if (value.requiredValues && value.requiredValues.size > 0) {
            // Parameter has specific required values - create separate entries for each value
            for (let requiredValue of value.requiredValues) {
                parts.push(`${key}=${requiredValue}`);
            }
        }
        else if (value.requireAssignment) {
            // Parameter requires assignment but no specific values
            parts.push(`${key}=`);
        }
    }
    return parts.join('&');
}
