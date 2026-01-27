export function parseSearchConstraints(search) {
    let constraints = new Map();
    for (let part of search.split('&')) {
        if (part === '')
            continue;
        let eqIndex = part.indexOf('=');
        if (eqIndex === -1) {
            // Presence-only (no '=')
            let name = decodeSearchComponent(part);
            let existing = constraints.get(name);
            if (!existing) {
                constraints.set(name, { requireAssignment: false, allowBare: true });
            }
            continue;
        }
        let name = decodeSearchComponent(part.slice(0, eqIndex));
        let valuePart = part.slice(eqIndex + 1);
        let existing = constraints.get(name);
        if (!existing) {
            existing = { requireAssignment: true, allowBare: false };
            constraints.set(name, existing);
        }
        else {
            existing.requireAssignment = true;
            existing.allowBare = false;
        }
        if (valuePart.length > 0) {
            let decodedValue = decodeSearchComponent(valuePart);
            if (!existing.requiredValues)
                existing.requiredValues = new Set();
            existing.requiredValues.add(decodedValue);
        }
    }
    return constraints;
}
export function parseSearch(search) {
    if (search.startsWith('?'))
        search = search.slice(1);
    let namesWithoutAssignment = new Set(), namesWithAssignment = new Set(), valuesByKey = new Map();
    if (search.length > 0) {
        for (let part of search.split('&')) {
            if (part === '')
                continue;
            let eqIndex = part.indexOf('=');
            if (eqIndex === -1) {
                let name = decodeSearchComponent(part);
                namesWithoutAssignment.add(name);
                continue;
            }
            let name = decodeSearchComponent(part.slice(0, eqIndex));
            let valuePart = part.slice(eqIndex + 1);
            namesWithAssignment.add(name);
            let value = decodeSearchComponent(valuePart);
            let set = valuesByKey.get(name) ?? new Set();
            if (!valuesByKey.has(name))
                valuesByKey.set(name, set);
            set.add(value);
        }
    }
    return { namesWithoutAssignment, namesWithAssignment, valuesByKey };
}
function decodeSearchComponent(text) {
    try {
        return decodeURIComponent(text.replace(/\+/g, ' '));
    }
    catch {
        return text;
    }
}
