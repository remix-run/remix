import { createMixin } from "../runtime/mixins/mixin.js";
const DEFAULT_DURATION = 200;
const DEFAULT_EASING = 'ease-out';
const SCALE_PRECISION = 0.0001;
const TRANSLATE_PRECISION = 0.01;
function createAxisDelta() {
    return { translate: 0, scale: 1, origin: 0.5, originPoint: 0 };
}
function createDelta() {
    return { x: createAxisDelta(), y: createAxisDelta() };
}
function mix(from, to, progress) {
    return from + (to - from) * progress;
}
function isNear(value, target, threshold) {
    return Math.abs(value - target) <= threshold;
}
function calcLength(axis) {
    return axis.max - axis.min;
}
function calcAxisDelta(delta, source, target, origin = 0.5) {
    delta.origin = origin;
    delta.originPoint = mix(source.min, source.max, origin);
    let sourceLength = calcLength(source);
    let targetLength = calcLength(target);
    delta.scale = sourceLength !== 0 ? targetLength / sourceLength : 1;
    let targetOriginPoint = mix(target.min, target.max, origin);
    delta.translate = targetOriginPoint - delta.originPoint;
    if (isNear(delta.scale, 1, SCALE_PRECISION) || Number.isNaN(delta.scale)) {
        delta.scale = 1;
    }
    if (isNear(delta.translate, 0, TRANSLATE_PRECISION) || Number.isNaN(delta.translate)) {
        delta.translate = 0;
    }
}
function calcBoxDelta(delta, source, target, layoutConfig) {
    let origin = layoutConfig.size === false ? 0 : 0.5;
    calcAxisDelta(delta.x, source.x, target.x, origin);
    calcAxisDelta(delta.y, source.y, target.y, origin);
}
function mixAxisDelta(output, delta, progress) {
    output.translate = mix(delta.translate, 0, progress);
    output.scale = mix(delta.scale, 1, progress);
    output.origin = delta.origin;
    output.originPoint = delta.originPoint;
}
function mixDelta(output, delta, progress) {
    mixAxisDelta(output.x, delta.x, progress);
    mixAxisDelta(output.y, delta.y, progress);
}
function copyAxisDeltaInto(target, source) {
    target.translate = source.translate;
    target.scale = source.scale;
    target.origin = source.origin;
    target.originPoint = source.originPoint;
}
function copyDeltaInto(target, source) {
    copyAxisDeltaInto(target.x, source.x);
    copyAxisDeltaInto(target.y, source.y);
}
function buildProjectionTransform(delta, layoutConfig) {
    let transform = '';
    if (delta.x.translate || delta.y.translate) {
        transform = `translate3d(${delta.x.translate}px, ${delta.y.translate}px, 0)`;
    }
    if (layoutConfig.size !== false && (delta.x.scale !== 1 || delta.y.scale !== 1)) {
        transform += transform ? ' ' : '';
        transform += `scale(${delta.x.scale}, ${delta.y.scale})`;
    }
    return transform || 'none';
}
function buildTransformOrigin(delta) {
    return `${delta.x.origin * 100}% ${delta.y.origin * 100}%`;
}
function rectToBox(rect) {
    return {
        x: { min: rect.left, max: rect.right },
        y: { min: rect.top, max: rect.bottom },
    };
}
function measureNaturalBox(node) {
    let prevTransform = node.style.transform;
    let prevOrigin = node.style.transformOrigin;
    node.style.transform = 'none';
    node.style.transformOrigin = '';
    let rect = node.getBoundingClientRect();
    node.style.transform = prevTransform;
    node.style.transformOrigin = prevOrigin;
    return rectToBox(rect);
}
function resolveLayoutConfig(config) {
    if (!config)
        return null;
    if (config === true)
        return {};
    return config;
}
function isVisualDeltaZero(delta, layoutConfig) {
    return (isNear(delta.x.translate, 0, TRANSLATE_PRECISION) &&
        isNear(delta.y.translate, 0, TRANSLATE_PRECISION) &&
        (layoutConfig.size === false ||
            (isNear(delta.x.scale, 1, SCALE_PRECISION) && isNear(delta.y.scale, 1, SCALE_PRECISION))));
}
const animateLayoutMixin = createMixin((handle) => {
    let snapshot = null;
    let currentConfig = true;
    let currentDelta = null;
    let animationProgress = 0;
    let animation = null;
    let scheduleProgressTracking = (duration, active) => {
        let start = performance.now();
        let tick = () => {
            if (animation !== active)
                return;
            animationProgress = Math.min(1, (performance.now() - start) / duration);
            if (animationProgress < 1) {
                requestAnimationFrame(tick);
            }
        };
        requestAnimationFrame(tick);
    };
    let clearProjectionStyles = (node) => {
        node.style.transform = '';
        node.style.transformOrigin = '';
    };
    let resetAnimation = () => {
        animation = null;
        currentDelta = null;
        animationProgress = 0;
    };
    handle.addEventListener('beforeUpdate', (event) => {
        let layoutConfig = resolveLayoutConfig(currentConfig);
        if (!layoutConfig)
            return;
        snapshot = measureNaturalBox(event.node);
    });
    handle.addEventListener('commit', (event) => {
        let layoutConfig = resolveLayoutConfig(currentConfig);
        let htmlNode = event.node;
        let latest = measureNaturalBox(htmlNode);
        if (!layoutConfig) {
            animation?.cancel();
            clearProjectionStyles(htmlNode);
            resetAnimation();
            snapshot = latest;
            return;
        }
        if (!snapshot) {
            snapshot = latest;
            return;
        }
        let targetDelta = createDelta();
        calcBoxDelta(targetDelta, latest, snapshot, layoutConfig);
        if (isVisualDeltaZero(targetDelta, layoutConfig)) {
            snapshot = latest;
            return;
        }
        if (animation && animation.playState === 'running') {
            animation.cancel();
            if (currentDelta && animationProgress > 0 && animationProgress < 1) {
                let visual = createDelta();
                mixDelta(visual, currentDelta, animationProgress);
                targetDelta.x.translate += visual.x.translate;
                targetDelta.y.translate += visual.y.translate;
                targetDelta.x.scale *= visual.x.scale;
                targetDelta.y.scale *= visual.y.scale;
            }
        }
        if (!currentDelta)
            currentDelta = createDelta();
        copyDeltaInto(currentDelta, targetDelta);
        animationProgress = 0;
        let invert = buildProjectionTransform(targetDelta, layoutConfig);
        let origin = buildTransformOrigin(targetDelta);
        htmlNode.style.transform = invert;
        htmlNode.style.transformOrigin = origin;
        let duration = layoutConfig.duration ?? DEFAULT_DURATION;
        let easing = layoutConfig.easing ?? DEFAULT_EASING;
        let active = htmlNode.animate([
            { transform: invert, transformOrigin: origin },
            { transform: 'none', transformOrigin: origin },
        ], { duration, easing, fill: 'forwards' });
        animation = active;
        scheduleProgressTracking(duration, active);
        active.finished
            .then(() => {
            if (animation !== active)
                return;
            clearProjectionStyles(htmlNode);
            resetAnimation();
            snapshot = rectToBox(htmlNode.getBoundingClientRect());
        })
            .catch(() => { });
    });
    handle.addEventListener('remove', () => {
        animation?.cancel();
        resetAnimation();
        snapshot = null;
    });
    return (config = true) => {
        currentConfig = config;
        return handle.element;
    };
});
/**
 * Animates layout changes for an element using FLIP-style transforms.
 *
 * @param config Layout animation configuration.
 * @returns A mixin descriptor for the target element.
 */
export function animateLayout(config = true) {
    return animateLayoutMixin(config);
}
//# sourceMappingURL=animate-layout-mixin.js.map