import { readUntransformedRect } from './layout-measurement.js';
const priorityOrder = { animation: 0, gesture: 1, exit: 2 };
const hosts = new WeakMap();
const registered = new Set();
const valueProperties = {
    x: '--rmx-animation-x',
    y: '--rmx-animation-y',
    z: '--rmx-animation-z',
    layoutX: '--rmx-animation-layout-x',
    layoutY: '--rmx-animation-layout-y',
    layoutScaleX: '--rmx-animation-layout-scale-x',
    layoutScaleY: '--rmx-animation-layout-scale-y',
};
const baseTransformName = '--rmx-animation-base-transform';
function register(name, syntax = '<number>', initialValue = '0') {
    if (registered.has(name))
        return;
    CSS.registerProperty({ name, syntax, inherits: false, initialValue });
    registered.add(name);
}
function createAnimatedValue(render, initial = 0) {
    let current = initial;
    let activeClaim;
    function read() {
        return activeClaim?.backend?.sample() ?? current;
    }
    function write(value) {
        current = value;
        render(value);
    }
    function stop(replaced = false) {
        let previous = activeClaim;
        if (!previous)
            return;
        let sample = read();
        activeClaim = undefined;
        write(sample);
        previous.backend?.stop();
        if (replaced)
            previous.cancel?.();
    }
    return {
        read,
        pause(owner) {
            if (activeClaim?.owner === owner)
                activeClaim.backend?.pause?.();
        },
        resume(owner) {
            if (activeClaim?.owner === owner)
                activeClaim.backend?.resume?.();
        },
        release(owner) {
            if (activeClaim?.owner === owner)
                stop();
        },
        claim(owner, priority, cancel) {
            if (activeClaim && priorityOrder[priority] < priorityOrder[activeClaim.priority])
                return;
            stop(true);
            let claim = { owner, priority, cancel };
            activeClaim = claim;
            return {
                read,
                set(value) {
                    if (activeClaim !== claim)
                        return;
                    write(value);
                },
                start(backend) {
                    if (activeClaim !== claim) {
                        backend.stop();
                        return;
                    }
                    claim.backend = backend;
                    void backend.finished
                        .then(() => {
                        if (activeClaim === claim && claim.backend === backend)
                            stop();
                    })
                        .catch(() => { });
                },
                release() {
                    if (activeClaim === claim)
                        stop();
                },
            };
        },
    };
}
function createHost(node) {
    let count = 0;
    let originalTranslate = node.style.translate;
    let translatePriority = node.style.getPropertyPriority('translate');
    let originalTransform = node.style.transform;
    let transformPriority = node.style.getPropertyPriority('transform');
    let originalOrigin = node.style.transformOrigin;
    let originPriority = node.style.getPropertyPriority('transform-origin');
    let baseTransform = 'none';
    let baseTranslate = 'none';
    let translateInitialized = false;
    let baseParts = translateParts(baseTranslate);
    let transformUsers = 0;
    let activePlaybacks = new Map();
    let rendered = {
        x: 0,
        y: 0,
        z: 0,
        layoutX: 0,
        layoutY: 0,
        layoutScaleX: 1,
        layoutScaleY: 1,
    };
    let ownedTranslate;
    let ownedTransform;
    let origin;
    let stylePlaybacks = new Map();
    let rebases = new Set();
    let translation = `calc(${baseParts[0]} + var(${valueProperties.x}) * 1px) calc(${baseParts[1]} + var(${valueProperties.y}) * 1px) calc(${baseParts[2]} + var(${valueProperties.z}) * 1px)`;
    let originalVariables = new Map([...Object.values(valueProperties), baseTransformName].map((name) => [
        name,
        node.style.getPropertyValue(name),
    ]));
    function write(key, value) {
        rendered[key] = value;
        setStyle(valueProperties[key], String(value));
        render();
    }
    let values = {
        x: createAnimatedValue((value) => write('x', value)),
        y: createAnimatedValue((value) => write('y', value)),
        z: createAnimatedValue((value) => write('z', value)),
        layoutX: createAnimatedValue((value) => write('layoutX', value)),
        layoutY: createAnimatedValue((value) => write('layoutY', value)),
        layoutScaleX: createAnimatedValue((value) => write('layoutScaleX', value), 1),
        layoutScaleY: createAnimatedValue((value) => write('layoutScaleY', value), 1),
    };
    for (let [key, name] of Object.entries(valueProperties))
        register(name, '<number>', key.includes('Scale') ? '1' : '0');
    register(baseTransformName, '<transform-list>', 'translateX(0px)');
    setStyle(valueProperties.x, '0');
    setStyle(valueProperties.y, '0');
    function setStyle(property, value, priority = '') {
        if (node.style.getPropertyValue(property) !== value ||
            node.style.getPropertyPriority(property) !== priority)
            node.style.setProperty(property, value, priority);
    }
    function render() {
        if (rendered.x ||
            rendered.y ||
            rendered.z ||
            activePlaybacks.has('x') ||
            activePlaybacks.has('y') ||
            activePlaybacks.has('z')) {
            setStyle('translate', translation, translatePriority);
            ownedTranslate = node.style.translate;
        }
        else if (node.style.translate === ownedTranslate) {
            setStyle('translate', originalTranslate, translatePriority);
            ownedTranslate = undefined;
        }
        let projected = rendered.layoutX ||
            rendered.layoutY ||
            rendered.layoutScaleX !== 1 ||
            rendered.layoutScaleY !== 1 ||
            [...activePlaybacks.keys()].some((key) => key.startsWith('layout'));
        if (projected || transformUsers) {
            setStyle('transform', `translate3d(calc(var(${valueProperties.layoutX}) * 1px), calc(var(${valueProperties.layoutY}) * 1px), 0) scale(var(${valueProperties.layoutScaleX}), var(${valueProperties.layoutScaleY}))${transformUsers ? ` var(${baseTransformName})` : ''}`, transformPriority);
            ownedTransform = node.style.transform;
            setStyle('transform-origin', projected ? (origin ?? originalOrigin) : originalOrigin, originPriority);
        }
        else if (node.style.transform === ownedTransform) {
            setStyle('transform', originalTransform, transformPriority);
            setStyle('transform-origin', originalOrigin, originPriority);
            ownedTransform = undefined;
        }
    }
    function trackPlayback(key) {
        activePlaybacks.set(key, (activePlaybacks.get(key) ?? 0) + 1);
        if (key.startsWith('layout'))
            setStyle(baseTransformName, baseTransform === 'none' ? 'translateX(0px)' : baseTransform);
        render();
        let active = true;
        return () => {
            if (!active)
                return;
            active = false;
            let remaining = (activePlaybacks.get(key) ?? 1) - 1;
            if (remaining)
                activePlaybacks.set(key, remaining);
            else
                activePlaybacks.delete(key);
            render();
        };
    }
    return {
        trackPlayback,
        retain() {
            count++;
            let owner = Symbol('animation feature');
            let disposed = false;
            return {
                resolveTranslate(text, additive = false) {
                    if (!translateInitialized) {
                        // Presence explicitly animates this property. Read its CSS endpoint
                        // once, rather than discovering unrelated transforms on each update.
                        baseTranslate =
                            ownedTranslate !== undefined
                                ? originalTranslate || 'none'
                                : getComputedStyle(node).translate;
                        baseParts = translateParts(baseTranslate);
                        translateInitialized = true;
                        translation = `calc(${baseParts[0]} + var(${valueProperties.x}) * 1px) calc(${baseParts[1]} + var(${valueProperties.y}) * 1px) calc(${baseParts[2]} + var(${valueProperties.z}) * 1px)`;
                    }
                    let position = resolveTranslation(node, text);
                    let base = additive ? { x: 0, y: 0, z: 0 } : resolveTranslation(node, baseTranslate);
                    return { x: position.x - base.x, y: position.y - base.y, z: position.z - base.z };
                },
                read(key) {
                    return values[key].read();
                },
                claim(key, priority, cancel) {
                    if (disposed)
                        return;
                    return values[key].claim(owner, priority, cancel);
                },
                playStyle(property, frames, options) {
                    let previous = stylePlaybacks.get(property);
                    if (previous) {
                        let current = getComputedStyle(node).getPropertyValue(property.includes('-')
                            ? property
                            : property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`));
                        previous.animation.cancel();
                        if (frames[0][property] === undefined)
                            frames = [{ ...frames[0], [property]: current }, ...frames.slice(1)];
                    }
                    let animation = node.animate(frames, options);
                    let token = { owner, animation };
                    stylePlaybacks.set(property, token);
                    return {
                        animation,
                        stop() {
                            if (stylePlaybacks.get(property) !== token)
                                return;
                            animation.cancel();
                            stylePlaybacks.delete(property);
                        },
                    };
                },
                pause() {
                    for (let value of Object.values(values))
                        value.pause(owner);
                },
                resume() {
                    for (let value of Object.values(values))
                        value.resume(owner);
                },
                stop() {
                    for (let [property, playback] of stylePlaybacks) {
                        if (playback.owner !== owner)
                            continue;
                        playback.animation.cancel();
                        stylePlaybacks.delete(property);
                    }
                    for (let value of Object.values(values))
                        value.release(owner);
                },
                useTransform() {
                    if (!transformUsers)
                        baseTransform = ownedTransform !== undefined ? 'none' : getComputedStyle(node).transform;
                    transformUsers++;
                    setStyle(baseTransformName, baseTransform === 'none' ? 'translateX(0px)' : baseTransform);
                    render();
                    let retained = true;
                    return () => {
                        if (!retained)
                            return;
                        retained = false;
                        transformUsers--;
                        render();
                    };
                },
                setOrigin(value) {
                    origin = value;
                    render();
                },
                onLayoutRebase(callback) {
                    rebases.add(callback);
                    return () => rebases.delete(callback);
                },
                rebase(x, y) {
                    let remaining = { x, y };
                    for (let callback of rebases)
                        remaining = callback(remaining.x, remaining.y);
                    return remaining;
                },
                dispose() {
                    if (disposed)
                        return;
                    disposed = true;
                    for (let [property, playback] of stylePlaybacks) {
                        if (playback.owner !== owner)
                            continue;
                        playback.animation.cancel();
                        stylePlaybacks.delete(property);
                    }
                    for (let value of Object.values(values))
                        value.release(owner);
                    count--;
                    if (count !== 0)
                        return;
                    if (node.style.translate === ownedTranslate)
                        setStyle('translate', originalTranslate, translatePriority);
                    if (node.style.transform === ownedTransform)
                        setStyle('transform', originalTransform, transformPriority);
                    if (node.style.transformOrigin === origin)
                        setStyle('transform-origin', originalOrigin, originPriority);
                    for (let [name, previous] of originalVariables) {
                        if (previous)
                            setStyle(name, previous);
                        else
                            node.style.removeProperty(name);
                    }
                    hosts.delete(node);
                },
            };
        },
    };
}
export function retainAnimationHost(node) {
    let host = hosts.get(node);
    if (!host) {
        host = createHost(node);
        hosts.set(node, host);
    }
    return host.retain();
}
// Resolve the existing CSS translate syntax against the host's border box. This
// slow path runs at animation boundaries, never during pointer tracking.
function resolveTranslation(node, text) {
    if (!text || text === 'none')
        return { x: 0, y: 0, z: 0 };
    let parts = translateParts(text);
    let reference = node.ownerDocument.createElement('div');
    let point = node.ownerDocument.createElement('div');
    reference.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;contain:strict;left:0;top:0;width:${node.offsetWidth}px;height:${node.offsetHeight}px;`;
    let computed = getComputedStyle(node);
    reference.style.fontSize = computed.fontSize;
    for (let name of computed)
        if (name.startsWith('--'))
            reference.style.setProperty(name, computed.getPropertyValue(name));
    point.style.cssText = 'position:absolute;width:0;height:0;';
    point.style.left = parts[0] ?? '0px';
    point.style.top = parts[1] ?? '0px';
    reference.append(point);
    node.ownerDocument.body.append(reference);
    try {
        let resolved = getComputedStyle(point);
        let x = parseFloat(resolved.left);
        let y = parseFloat(resolved.top);
        point.style.left = parts[2];
        let z = parseFloat(getComputedStyle(point).left);
        return { x, y, z };
    }
    finally {
        reference.remove();
    }
}
function resetTransforms(node) {
    let properties = ['transform', 'translate', 'rotate', 'scale'];
    let saved = properties.map((name) => ({
        name,
        value: node.style.getPropertyValue(name),
        priority: node.style.getPropertyPriority(name),
    }));
    for (let name of properties)
        node.style.setProperty(name, 'none', 'important');
    return () => {
        for (let { name, value, priority } of saved) {
            if (value)
                node.style.setProperty(name, value, priority);
            else
                node.style.removeProperty(name);
        }
    };
}
export function measureUntransformed(node) {
    let measured = readUntransformedRect(node);
    if (measured)
        return measured;
    let restore = resetTransforms(node);
    try {
        return node.getBoundingClientRect();
    }
    finally {
        restore();
    }
}
// Nodes at the same depth cannot be each other's ancestors. Reset and read
// that group together, then restore it before measuring descendants.
export function measureUntransformedBatch(nodes, read) {
    let groups = new Map();
    for (let node of nodes) {
        let depth = 0;
        for (let parent = node.parentElement; parent; parent = parent.parentElement)
            depth++;
        let group = groups.get(depth);
        if (group)
            group.push(node);
        else
            groups.set(depth, [node]);
    }
    for (let [, group] of [...groups].sort(([a], [b]) => a - b)) {
        let restores = [];
        let writes = [];
        try {
            for (let node of group)
                restores.push(resetTransforms(node));
            for (let node of group)
                writes.push(read(node, node.getBoundingClientRect()));
        }
        finally {
            for (let restore of restores)
                restore();
        }
        // Descendants must measure the projection just applied to their ancestors.
        for (let write of writes)
            write();
    }
}
export function transformProperty() {
    return baseTransformName;
}
export function createNativeAnimationPlayback(node, key, from, to, options) {
    let releasePlayback = hosts.get(node)?.trackPlayback(key);
    let animation = node.animate([{ [valueProperties[key]]: from }, { [valueProperties[key]]: to }], {
        ...options,
        composite: 'replace',
        fill: 'both',
    });
    // A renderless native effect supplies the browser's CSS easing calculation.
    let effect = new KeyframeEffect(null, [], { ...options, fill: 'both' });
    let sampler = new Animation(effect);
    sampler.pause();
    let sampleAt = (time) => {
        sampler.currentTime = time;
        return from + (to - from) * (effect.getComputedTiming().progress ?? 0);
    };
    let backend = {
        sample() {
            let time = typeof animation.currentTime === 'number' ? animation.currentTime : 0;
            return sampleAt(time);
        },
        stop() {
            animation.cancel();
            sampler.cancel();
            releasePlayback?.();
        },
        finished: animation.finished,
    };
    return { animation, backend };
}
function translateParts(text) {
    if (!text || text === 'none')
        return ['0px', '0px', '0px'];
    let parts = [];
    let part = '';
    let depth = 0;
    for (let char of text) {
        if (char === '(')
            depth++;
        if (char === ')')
            depth--;
        if (/\s/.test(char) && depth === 0) {
            if (part)
                parts.push(part);
            part = '';
        }
        else
            part += char;
    }
    if (part)
        parts.push(part);
    return [parts[0] ?? '0px', parts[1] ?? '0px', parts[2] ?? '0px'];
}
//# sourceMappingURL=animation-host.js.map