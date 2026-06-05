export const glyphNames = [
    'add',
    'alert',
    'check',
    'chevronDown',
    'chevronVertical',
    'chevronUp',
    'chevronRight',
    'close',
    'copy',
    'edit',
    'expand',
    'info',
    'menu',
    'open',
    'search',
    'spinner',
    'trash',
];
const DEFAULT_GLYPH_ID_PREFIX = 'rmx-glyph';
export const glyphContract = Object.freeze(createGlyphContract(DEFAULT_GLYPH_ID_PREFIX));
function createGlyphIds(idPrefix) {
    return Object.fromEntries(glyphNames.map((name) => [name, `${idPrefix}-${name}`]));
}
function createGlyphContract(idPrefix) {
    let ids = createGlyphIds(idPrefix);
    return Object.freeze(Object.fromEntries(glyphNames.map((name) => [
        name,
        {
            id: ids[name],
        },
    ])));
}
//# sourceMappingURL=glyph-contract.js.map