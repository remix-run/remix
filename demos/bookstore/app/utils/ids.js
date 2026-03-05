export function parseId(value) {
    if (typeof value === 'number') {
        return Number.isSafeInteger(value) ? value : undefined;
    }
    if (typeof value !== 'string') {
        return undefined;
    }
    let parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
}
