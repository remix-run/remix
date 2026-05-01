export function jsx(type, props, key) {
    return { type, props: normalizeElementProps(props), key, $rmx: true };
}
export { jsx as jsxDEV, jsx as jsxs };
function normalizeElementProps(props) {
    if (!props)
        return {};
    if (!('mix' in props))
        return props;
    let { mix, ...rest } = props;
    let normalizedMix = normalizeMixValue(mix);
    return normalizedMix === undefined ? rest : { ...rest, mix: normalizedMix };
}
function normalizeMixValue(mix) {
    if (!mix)
        return undefined;
    let normalizedMix = [];
    flattenMixValue(mix, normalizedMix);
    return normalizedMix.length === 0 ? undefined : normalizedMix;
}
function flattenMixValue(mix, out) {
    if (!mix)
        return;
    if (!Array.isArray(mix)) {
        out.push(mix);
        return;
    }
    for (let item of mix) {
        flattenMixValue(item, out);
    }
}
//# sourceMappingURL=jsx.js.map