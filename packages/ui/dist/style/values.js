const NUMERIC_CSS_PROPS = new Set([
    'aspect-ratio',
    'z-index',
    'opacity',
    'flex-grow',
    'flex-shrink',
    'flex-order',
    'grid-area',
    'grid-row',
    'grid-column',
    'font-weight',
    'line-height',
    'order',
    'orphans',
    'widows',
    'zoom',
    'columns',
    'column-count',
]);
export function toCssPropertyName(value) {
    return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
export function normalizeCssValue(key, value) {
    if (value == null)
        return String(value);
    if (typeof value === 'number' && value !== 0) {
        let cssKey = toCssPropertyName(key);
        if (!NUMERIC_CSS_PROPS.has(cssKey) && !cssKey.startsWith('--')) {
            return `${value}px`;
        }
    }
    return String(value);
}
//# sourceMappingURL=values.js.map