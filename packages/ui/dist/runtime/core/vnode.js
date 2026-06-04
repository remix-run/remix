export function createRemixElement(type, props, key) {
    return {
        $rmx: true,
        key,
        props: normalizeElementProps(props),
        type,
    };
}
export function isRemixElement(node) {
    return typeof node === 'object' && node !== null && '$rmx' in node;
}
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
//# sourceMappingURL=vnode.js.map