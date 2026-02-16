import { isCommittedHostNode } from "./vnode.js";
// Track nodes that are currently exiting (playing exit animation)
let exitingNodes = new Set();
// Debug multiplier for presence animations (set window.DEBUG_PRESENCE = true to slow down animations)
function getDebugDurationMultiplier() {
    return typeof window !== 'undefined' && window.DEBUG_PRESENCE ? 10 : 1;
}
// Default configs for each animation type
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
const DEFAULT_LAYOUT = {
    duration: 200,
    easing: 'ease-in-out',
};
// Normalize presence prop to full config, resolving `true` values to defaults
function normalizePresence(presence) {
    let result = {};
    // Normalize enter
    if (presence.enter === true) {
        result.enter = DEFAULT_ENTER;
    }
    else if (presence.enter) {
        result.enter = presence.enter;
    }
    // Normalize exit
    if (presence.exit === true) {
        result.exit = DEFAULT_EXIT;
    }
    else if (presence.exit) {
        result.exit = presence.exit;
    }
    // Normalize layout - merge with defaults for partial configs
    if (presence.layout === true) {
        result.layout = DEFAULT_LAYOUT;
    }
    else if (presence.layout) {
        result.layout = {
            duration: presence.layout.duration ?? DEFAULT_LAYOUT.duration,
            easing: presence.layout.easing ?? DEFAULT_LAYOUT.easing,
        };
    }
    return result;
}
// Get animate config from node props
export function getPresenceConfig(node) {
    let animate = node.props.animate;
    if (!animate)
        return null;
    return normalizePresence(animate);
}
// Check if enter animation should play (just checks if config exists)
export function shouldPlayEnterAnimation(config) {
    return !!config;
}
// Check if config has keyframes array
function hasKeyframes(config) {
    return 'keyframes' in config && Array.isArray(config.keyframes);
}
// Extract style properties from a keyframe config (excluding timing properties)
function extractStyleProps(config) {
    let result = {};
    for (let key in config) {
        if (key !== 'offset' &&
            key !== 'easing' &&
            key !== 'composite' &&
            key !== 'duration' &&
            key !== 'delay') {
            result[key] = config[key];
        }
    }
    // Include per-keyframe timing if present
    if (config.offset !== undefined)
        result.offset = config.offset;
    if (config.easing !== undefined)
        result.easing = config.easing;
    if (config.composite !== undefined)
        result.composite = config.composite;
    return result;
}
// Build keyframes array for enter animation
function buildEnterKeyframes(config) {
    if (hasKeyframes(config)) {
        return config.keyframes.map(extractStyleProps);
    }
    // Shorthand: animate FROM enter state TO natural state (empty = browser default)
    // Don't include easing on keyframe - it's specified in animation options.
    // Including it on both causes double-easing (WAAPI applies both effect and keyframe easing).
    let keyframe = extractStyleProps(config);
    delete keyframe.easing;
    return [keyframe, {}];
}
// Build keyframes array for exit animation
function buildExitKeyframes(config) {
    if (hasKeyframes(config)) {
        return config.keyframes.map(extractStyleProps);
    }
    // Shorthand: animate FROM natural state TO exit state
    // Don't include easing on keyframe - it's specified in animation options.
    let keyframe = extractStyleProps(config);
    delete keyframe.easing;
    return [{}, keyframe];
}
export function markNodeExiting(node, domParent) {
    node._exiting = true;
    node._exitingParent = domParent;
    exitingNodes.add(node);
}
export function unmarkNodeExiting(node) {
    exitingNodes.delete(node);
    node._exiting = false;
    node._exitingParent = undefined;
}
// Play enter animation on an element
export function playEnterAnimation(node, config) {
    let dom = node._dom;
    let keyframes = buildEnterKeyframes(config);
    let multiplier = getDebugDurationMultiplier();
    let options = {
        duration: config.duration * multiplier,
        delay: config.delay != null ? config.delay * multiplier : undefined,
        easing: config.easing,
        composite: config.composite,
        fill: 'backwards',
    };
    let animation = dom.animate(keyframes, options);
    node._animation = animation;
}
// Play exit animation on an element
export function playExitAnimation(node, config, domParent, onComplete) {
    let dom = node._dom;
    let keyframes = buildExitKeyframes(config);
    let multiplier = getDebugDurationMultiplier();
    let options = {
        duration: config.duration * multiplier,
        delay: config.delay != null ? config.delay * multiplier : undefined,
        easing: config.easing,
        composite: config.composite,
        fill: 'forwards',
    };
    let animation = dom.animate(keyframes, options);
    node._animation = animation;
    markNodeExiting(node, domParent);
    // Use finished promise for more reliable completion handling
    // Check if still exiting - might have been reclaimed
    animation.finished.then(() => {
        if (!node._exiting)
            return; // Node was reclaimed, don't remove
        unmarkNodeExiting(node);
        node._animation = undefined;
        onComplete();
    });
}
// Find a matching exiting node that can be reclaimed
export function findMatchingExitingNode(type, key, domParent) {
    // Only reclaim nodes with explicit keys - non-keyed nodes should animate
    // independently. This prevents `cond ? <A /> : <B />` from incorrectly
    // reclaiming when A and B's inner elements happen to have the same type.
    if (key == null)
        return null;
    for (let node of exitingNodes) {
        if (!isCommittedHostNode(node))
            continue;
        if (node._exitingParent !== domParent)
            continue;
        if (node.type !== type)
            continue;
        if (node.key !== key)
            continue;
        return node;
    }
    return null;
}
//# sourceMappingURL=presence.js.map