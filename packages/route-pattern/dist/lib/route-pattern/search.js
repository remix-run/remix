/**
 * Joins two search patterns, merging params and their constraints.
 *
 * Conceptually:
 *
 * ```ts
 * search('?a', '?b') -> '?a&b'
 * search('?a=1', '?a=2') -> '?a=1&a=2'
 * search('?a=1', '?b=2') -> '?a=1&b=2'
 * search('', '?a') -> '?a'
 * ```
 *
 * @param a the first search constraints
 * @param b the second search constraints
 * @returns the merged search constraints
 */
export function join(a, b) {
    let result = new Map();
    for (let [name, constraint] of a) {
        result.set(name, constraint === null ? null : new Set(constraint));
    }
    for (let [name, constraint] of b) {
        let current = result.get(name);
        if (current === null || current === undefined) {
            result.set(name, constraint === null ? null : new Set(constraint));
            continue;
        }
        if (constraint !== null) {
            for (let value of constraint) {
                current.add(value);
            }
        }
    }
    return result;
}
/**
 * Convert search constraints to a query string.
 *
 * @param constraints the search constraints to convert
 * @returns the query string (without leading `?`), or undefined if empty
 */
export function toString(constraints) {
    if (constraints.size === 0) {
        return undefined;
    }
    let parts = [];
    for (let [key, constraint] of constraints) {
        if (constraint === null) {
            parts.push(encodeURIComponent(key));
        }
        else if (constraint.size === 0) {
            parts.push(`${encodeURIComponent(key)}=`);
        }
        else {
            for (let value of constraint) {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
            }
        }
    }
    let result = parts.join('&');
    return result || undefined;
}
/**
 * Test if URL search params satisfy the given constraints.
 *
 * @param params the URL search params to test
 * @param constraints the search constraints to check against
 * @param ignoreCase whether to ignore case when matching param names and values
 * @returns true if the params satisfy all constraints
 */
export function test(params, constraints, ignoreCase) {
    for (let [name, constraint] of constraints) {
        // Check if param exists (case-aware)
        let hasParam;
        let values;
        if (ignoreCase) {
            let nameLower = name.toLowerCase();
            hasParam = false;
            values = [];
            for (let key of params.keys()) {
                if (key.toLowerCase() === nameLower) {
                    hasParam = true;
                    values.push(...params.getAll(key));
                }
            }
        }
        else {
            hasParam = params.has(name);
            values = params.getAll(name);
        }
        if (constraint === null) {
            if (!hasParam)
                return false;
            continue;
        }
        if (constraint.size === 0) {
            if (values.every((value) => value === ''))
                return false;
            continue;
        }
        for (let value of constraint) {
            if (ignoreCase) {
                let valueLower = value.toLowerCase();
                if (!values.some((v) => v.toLowerCase() === valueLower))
                    return false;
            }
            else {
                if (!values.includes(value))
                    return false;
            }
        }
    }
    return true;
}
