import { createMixin } from "../runtime/mixins/mixin.js";
import { invariant } from "../runtime/invariant.js";
const DEFAULT_ENTER = {
    opacity: 0,
    duration: 150,
    easing: 'ease-out',
};
const DEFAULT_EXIT = {
    opacity: 0,
    duration: 150,
    easing: 'ease-in',
};
const animatingNodes = new WeakMap();
const initialEntranceSeenByParent = new WeakMap();
function extractStyleProps(config) {
    let result = {};
    for (let key in config) {
        if (key === 'duration' ||
            key === 'easing' ||
            key === 'delay' ||
            key === 'composite' ||
            key === 'initial') {
            continue;
        }
        let value = config[key];
        if (value === undefined)
            continue;
        if (typeof value !== 'string' && typeof value !== 'number')
            continue;
        result[key] = value;
    }
    return result;
}
function buildEnterKeyframes(config) {
    let keyframe = extractStyleProps(config);
    return [keyframe, {}];
}
function buildExitKeyframes(config) {
    let keyframe = extractStyleProps(config);
    return [{}, keyframe];
}
function resolveEnterConfig(config) {
    if (!config)
        return null;
    if (config === true)
        return DEFAULT_ENTER;
    return config;
}
function resolveExitConfig(config) {
    if (!config)
        return null;
    if (config === true)
        return DEFAULT_EXIT;
    return config;
}
function createAnimationOptions(config, fill) {
    return {
        duration: config.duration,
        delay: config.delay,
        easing: config.easing,
        composite: config.composite,
        fill,
    };
}
function collectAnimatedProperties(keyframes) {
    let properties = new Set();
    for (let keyframe of keyframes) {
        for (let key in keyframe) {
            if (key === 'offset' || key === 'easing' || key === 'composite')
                continue;
            properties.add(key);
        }
    }
    return [...properties];
}
function toCssPropertyName(property) {
    return property.includes('-')
        ? property
        : property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}
function readInlineStyle(style, property) {
    return style.getPropertyValue(toCssPropertyName(property));
}
function writeInlineStyle(style, property, value) {
    let cssProperty = toCssPropertyName(property);
    if (value === '') {
        style.removeProperty(cssProperty);
        return;
    }
    style.setProperty(cssProperty, value);
}
function trackAnimation(node, animation, keyframes) {
    let properties = collectAnimatedProperties(keyframes);
    animatingNodes.set(node, { animation, properties });
    animation.finished
        .catch(() => { })
        .finally(() => {
        let current = animatingNodes.get(node);
        if (current?.animation !== animation)
            return;
        animatingNodes.delete(node);
    });
}
function waitForAnimationOrAbort(animation, signal) {
    if (signal.aborted)
        return Promise.resolve();
    return new Promise((resolve) => {
        let settled = false;
        let settle = () => {
            if (settled)
                return;
            settled = true;
            signal.removeEventListener('abort', settle);
            resolve();
        };
        signal.addEventListener('abort', settle, { once: true });
        void animation.finished.catch(() => { }).finally(settle);
    });
}
function shouldSkipInitialEntrance(event, config) {
    if (config.initial !== false)
        return false;
    if (event.key == null)
        return false;
    let seenForParent = initialEntranceSeenByParent.get(event.parent);
    if (!seenForParent) {
        seenForParent = new Set();
        initialEntranceSeenByParent.set(event.parent, seenForParent);
    }
    if (seenForParent.has(event.key))
        return false;
    seenForParent.add(event.key);
    return true;
}
const animateEntranceMixin = createMixin((handle) => {
    let currentConfig = true;
    handle.addEventListener('insert', (event) => {
        let node = event.node;
        let current = animatingNodes.get(node);
        if (current && current.animation.playState === 'running') {
            return;
        }
        let config = resolveEnterConfig(currentConfig);
        if (!config)
            return;
        if (shouldSkipInitialEntrance(event, config))
            return;
        let keyframes = buildEnterKeyframes(config);
        let options = createAnimationOptions(config, 'backwards');
        let animation = node.animate(keyframes, options);
        trackAnimation(node, animation, keyframes);
    });
    return (config) => {
        currentConfig = config;
        return handle.element;
    };
});
const animateExitMixin = createMixin((handle) => {
    let currentConfig = true;
    let node = null;
    handle.addEventListener('insert', (event) => {
        node = event.node;
    });
    handle.addEventListener('reclaimed', (event) => {
        node = event.node;
        let current = animatingNodes.get(event.node);
        if (current && current.animation.playState === 'running') {
            // WAAPI can throw InvalidStateError here if the target is transiently non-rendered
            // during reclaim; we still have computed-style fallback below for retargeting.
            try {
                current.animation.commitStyles();
            }
            catch { }
            current.animation.cancel();
            let style = event.node.style;
            let computed = getComputedStyle(event.node);
            let from = {};
            for (let property of current.properties) {
                let cssProperty = toCssPropertyName(property);
                let value = readInlineStyle(style, property) || computed.getPropertyValue(cssProperty);
                if (value !== '') {
                    from[property] = value;
                }
                writeInlineStyle(style, property, '');
            }
            let enterConfig = resolveEnterConfig(currentConfig) ?? DEFAULT_ENTER;
            let keyframes = [from, {}];
            let options = createAnimationOptions(enterConfig, 'none');
            let animation = event.node.animate(keyframes, options);
            trackAnimation(event.node, animation, keyframes);
        }
    });
    handle.addEventListener('beforeRemove', (event) => {
        let config = resolveExitConfig(currentConfig);
        if (!config)
            return;
        event.persistNode(async (signal) => {
            invariant(node);
            let current = animatingNodes.get(node);
            if (current && current.animation.playState === 'running') {
                current.animation.reverse();
                await waitForAnimationOrAbort(current.animation, signal);
                return;
            }
            let keyframes = buildExitKeyframes(config);
            let options = createAnimationOptions(config, 'forwards');
            let animation = node.animate(keyframes, options);
            trackAnimation(node, animation, keyframes);
            await waitForAnimationOrAbort(animation, signal);
        });
    });
    return (config) => {
        currentConfig = config;
        return handle.element;
    };
});
/**
 * Animates an element when it is inserted into the DOM.
 *
 * @param config Entrance animation configuration.
 * @returns A mixin descriptor for the target element.
 */
export function animateEntrance(config = true) {
    return animateEntranceMixin(config);
}
/**
 * Animates an element when it is removed from the DOM.
 *
 * @param config Exit animation configuration.
 * @returns A mixin descriptor for the target element.
 */
export function animateExit(config = true) {
    return animateExitMixin(config);
}
//# sourceMappingURL=animate-mixins.js.map