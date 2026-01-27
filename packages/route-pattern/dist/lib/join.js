import { stringify, startsWithSeparator } from "./stringify.js";
export function join(a, b) {
    let { protocol, hostname, port } = b.hostname != null ? b : a;
    let pathname = joinPathnames(a.pathname, b.pathname);
    let searchConstraints = joinSearchConstraints(a.searchConstraints, b.searchConstraints);
    return stringify({
        protocol,
        hostname,
        port,
        pathname,
        searchConstraints,
    });
}
function joinPathnames(a, b) {
    if (b == null || b.length === 0)
        return a;
    if (a == null || a.length === 0)
        return b;
    let tokens = [...a];
    // Remove trailing separator from base if present
    if (tokens.length > 0 && tokens[tokens.length - 1].type === 'separator') {
        tokens.pop();
    }
    // Check if input starts with a separator (including inside optionals)
    let inputStartsWithSeparator = startsWithSeparator(b);
    // If input is exactly a single separator, there is nothing to append.
    // This avoids creating a trailing slash like "/hello/" when joining with base '/'.
    if (b.length === 1 && b[0].type === 'separator') {
        return tokens;
    }
    // Only add separator between base and input if input doesn't start with one
    if (!inputStartsWithSeparator) {
        tokens.push({ type: 'separator' });
    }
    // Add input pathname
    tokens.push(...b);
    return tokens;
}
function joinSearchConstraints(baseSearch, inputSearch) {
    if (inputSearch == null)
        return baseSearch;
    if (baseSearch == null)
        return inputSearch;
    // Merge the two search constraint maps
    let merged = new Map(baseSearch);
    for (let [key, inputConstraint] of inputSearch.entries()) {
        let baseConstraint = merged.get(key);
        if (baseConstraint == null) {
            merged.set(key, inputConstraint);
        }
        else {
            // Merge constraints for the same key
            let mergedConstraint = {
                requireAssignment: baseConstraint.requireAssignment || inputConstraint.requireAssignment,
                allowBare: baseConstraint.allowBare && inputConstraint.allowBare,
                requiredValues: undefined,
            };
            // Merge required values
            if (baseConstraint.requiredValues || inputConstraint.requiredValues) {
                mergedConstraint.requiredValues = new Set([
                    ...(baseConstraint.requiredValues || []),
                    ...(inputConstraint.requiredValues || []),
                ]);
            }
            merged.set(key, mergedConstraint);
        }
    }
    return merged;
}
