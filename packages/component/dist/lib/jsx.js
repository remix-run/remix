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
    if (mix == null)
        return undefined;
    if (Array.isArray(mix)) {
        return mix.length === 0 ? undefined : [...mix];
    }
    return [mix];
}
//# sourceMappingURL=jsx.js.map