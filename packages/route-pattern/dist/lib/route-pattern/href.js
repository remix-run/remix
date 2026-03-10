import { unreachable } from "../unreachable.js";
/**
 * Generate a search query string from a pattern and params.
 *
 * @param pattern the route pattern containing search constraints
 * @param searchParams the search params to include in the href
 * @returns the query string (without leading `?`), or undefined if empty
 */
export function hrefSearch(pattern, searchParams) {
    let constraints = pattern.ast.search;
    if (constraints.size === 0 && Object.keys(searchParams).length === 0) {
        return undefined;
    }
    let urlSearchParams = new URLSearchParams();
    for (let [key, value] of Object.entries(searchParams)) {
        if (Array.isArray(value)) {
            for (let v of value) {
                if (v != null) {
                    urlSearchParams.append(key, String(v));
                }
            }
        }
        else if (value != null) {
            urlSearchParams.append(key, String(value));
        }
    }
    let missingParams = [];
    for (let [key, constraint] of constraints) {
        if (constraint === null) {
            if (key in searchParams)
                continue;
            urlSearchParams.append(key, '');
        }
        else if (constraint.size === 0) {
            if (key in searchParams)
                continue;
            missingParams.push(key);
        }
        else {
            for (let value of constraint) {
                if (urlSearchParams.getAll(key).includes(value))
                    continue;
                urlSearchParams.append(key, value);
            }
        }
    }
    if (missingParams.length > 0) {
        throw new HrefError({
            type: 'missing-search-params',
            pattern,
            missingParams,
            searchParams: searchParams,
        });
    }
    let result = urlSearchParams.toString();
    return result || undefined;
}
export class HrefError extends Error {
    details;
    constructor(details) {
        let message = HrefError.message(details);
        super(message);
        this.name = 'HrefError';
        this.details = details;
    }
    static message(details) {
        let pattern = details.pattern.toString();
        if (details.type === 'missing-hostname') {
            return `pattern requires hostname\n\nPattern: ${pattern}`;
        }
        if (details.type === 'nameless-wildcard') {
            return `pattern contains nameless wildcard\n\nPattern: ${pattern}`;
        }
        if (details.type === 'missing-search-params') {
            let params = details.missingParams.map((p) => `'${p}'`).join(', ');
            let searchParamsStr = JSON.stringify(details.searchParams);
            return `missing required search param(s): ${params}\n\nPattern: ${pattern}\nSearch params: ${searchParamsStr}`;
        }
        if (details.type === 'missing-params') {
            let params = details.missingParams.map((p) => `'${p}'`).join(', ');
            return `missing param(s): ${params}\n\nPattern: ${pattern}\nParams: ${JSON.stringify(details.params)}`;
        }
        unreachable(details);
    }
}
