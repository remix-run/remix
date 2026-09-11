// Stop mixins that return themselves from expanding forever.
const MAX_MIX_DESCRIPTORS = 1024;
/**
 * Composes an element's `mix` descriptors into its final props.
 *
 * @param hostType Host element tag name the mixins are composed for.
 * @param props Original element props, including `mix`.
 * @param runDescriptor Runs each mixin using the caller's state and error handling.
 * @returns The composed props.
 */
export function composeMixedProps(hostType, props, runDescriptor) {
    let descriptors = resolveMixDescriptors(props);
    let composedProps = withoutMix(props);
    let mixinProps = withoutMixinTreeProps(composedProps);
    for (let index = 0; index < descriptors.length && index < MAX_MIX_DESCRIPTORS; index++) {
        let result = runDescriptor(descriptors[index], index, mixinProps);
        if (!result)
            continue;
        if (isMixinElementFunction(result))
            continue;
        let returnedDescriptors = resolveReturnedMixDescriptors(result);
        if (returnedDescriptors) {
            for (let returned of returnedDescriptors)
                descriptors.push(returned);
            continue;
        }
        if (!isRemixElementResult(result)) {
            console.error(new Error('mixins must return a remix element'));
            continue;
        }
        let resultType = typeof result.type === 'string'
            ? result.type
            : isMixinElementFunction(result.type)
                ? result.type.__rmxMixinElementType
                : null;
        if (resultType !== hostType) {
            console.error(new Error('mixins must return an element with the same host type'));
            continue;
        }
        let nextProps = sanitizeReturnedMixinProps(result.props);
        for (let nested of resolveMixDescriptors(nextProps))
            descriptors.push(nested);
        composedProps = { ...composedProps, ...withoutMix(nextProps) };
        mixinProps = withoutMixinTreeProps(composedProps);
    }
    let nextMix = props.mix;
    return {
        ...composedProps,
        ...(nextMix === undefined ? {} : { mix: nextMix }),
    };
}
// JSX creation flattens nested mix arrays before composition.
export function resolveMixDescriptors(props) {
    let mix = props.mix;
    if (!mix)
        return [];
    if (Array.isArray(mix)) {
        if (mix.length === 0)
            return [];
        return mix.filter(Boolean);
    }
    return [mix];
}
function withoutMix(props) {
    if (!('mix' in props))
        return props;
    let output = { ...props };
    delete output.mix;
    return output;
}
function withoutMixinTreeProps(props) {
    if (!('children' in props) && !('innerHTML' in props))
        return props;
    let output = { ...props };
    delete output.children;
    delete output.innerHTML;
    return output;
}
function sanitizeReturnedMixinProps(props) {
    if (!('children' in props) && !('innerHTML' in props))
        return props;
    console.error(new Error('mixins must not return children or innerHTML'));
    return withoutMixinTreeProps(props);
}
export function isMixinDescriptor(value) {
    if (!value || typeof value !== 'object' || isRemixElementResult(value)) {
        return false;
    }
    let descriptor = value;
    return typeof descriptor.type === 'function' && Array.isArray(descriptor.args);
}
export function isMixinElementFunction(value) {
    if (typeof value !== 'function')
        return false;
    return '__rmxMixinElementType' in value;
}
// The composition loop checks the returned element's host type separately.
function isRemixElementResult(value) {
    if (!value || typeof value !== 'object')
        return false;
    return value.$rmx === true;
}
function resolveReturnedMixDescriptors(value) {
    let descriptors = [];
    if (!collectReturnedMixDescriptors(value, descriptors)) {
        return null;
    }
    return descriptors;
}
function collectReturnedMixDescriptors(value, output) {
    if (!value) {
        return true;
    }
    if (Array.isArray(value)) {
        for (let item of value) {
            if (!collectReturnedMixDescriptors(item, output)) {
                return false;
            }
        }
        return true;
    }
    if (!isMixinDescriptor(value)) {
        return false;
    }
    output.push(value);
    return true;
}
//# sourceMappingURL=mix.js.map