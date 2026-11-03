export function createRemixElement(type, props, key) {
    return {
        $rmx: true,
        key,
        props: normalizeElementProps(props),
        type,
    };
}
export function isRemixElement(node) {
    if (typeof node !== 'object' || node === null)
        return false;
    let type = Reflect.get(node, 'type');
    let props = Reflect.get(node, 'props');
    return (Reflect.get(node, '$rmx') === true &&
        (typeof type === 'string' || typeof type === 'function') &&
        typeof props === 'object' &&
        props !== null);
}
function normalizeElementProps(props) {
    if (!props)
        return {};
    if (!('mix' in props))
        return props;
    // Fast path: `mix={[a, b]}` with flat, truthy entries is already normalized.
    // Skipping the copy avoids two prop-object spreads per element per render.
    if (isNormalizedMix(props.mix))
        return props;
    let { mix, ...rest } = props;
    let normalizedMix = normalizeMixValue(mix);
    return normalizedMix === undefined ? rest : { ...rest, mix: normalizedMix };
}
function isNormalizedMix(mix) {
    if (!Array.isArray(mix) || mix.length === 0)
        return false;
    for (let i = 0; i < mix.length; i++) {
        let item = mix[i];
        if (!item || Array.isArray(item))
            return false;
    }
    return true;
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