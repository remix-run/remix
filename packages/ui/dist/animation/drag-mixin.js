import { createMixin, css, on } from '@remix-run/component';
import { prefersReducedMotion } from './prefers-reduced-motion.js';
import { frames, springStep } from './drag-physics.js';
import { retainAnimationHost } from './animation-host.js';
import { beginPointerSession } from './pointer-session.js';
import { measureCoordinateSpace, sameCoordinateSpace } from './coordinate-space.js';
const DRAG_START_EVENT = 'rmx:drag-start';
const DRAG_EVENT = 'rmx:drag';
const DRAG_END_EVENT = 'rmx:drag-end';
class DragGestureEvent extends Event {
    point;
    delta;
    offset;
    velocity;
    axis;
    sourceEvent;
    constructor(type, info, sourceEvent, cancelable = false) {
        super(type, { bubbles: true, cancelable });
        this.point = { ...info.point };
        this.delta = { ...info.delta };
        this.offset = { ...info.offset };
        this.velocity = { ...info.velocity };
        this.axis = info.axis;
        this.sourceEvent = sourceEvent;
    }
}
/** The first recognized drag movement. Measurements include movement since pointer-down. */
export class DragStartEvent extends DragGestureEvent {
    /**
     * Creates a bubbling drag-start notification.
     * @param info Pointer measurements when the gesture is recognized.
     * @param sourceEvent The pointer movement that started dragging.
     */
    constructor(info, sourceEvent) {
        super(DRAG_START_EVENT, info, sourceEvent);
    }
}
/** Pointer movement during a recognized drag. */
export class DragEvent extends DragGestureEvent {
    /**
     * Creates a bubbling drag-movement notification.
     * @param info Pointer measurements for this movement.
     * @param sourceEvent The original pointer movement.
     */
    constructor(info, sourceEvent) {
        super(DRAG_EVENT, info, sourceEvent);
    }
}
/** Drag completion, before settling. Prevent default on a normal end to retain position. */
export class DragEndEvent extends DragGestureEvent {
    /** Whether the gesture ended without a normal release. Cancellation cannot be prevented. */
    cancelled;
    /**
     * Creates a bubbling drag-end event with an independent default action.
     * @param info Final pointer measurements.
     * @param options Cancellation state and the original input event, when available.
     */
    constructor(info, options = {}) {
        super(DRAG_END_EVENT, info, options.sourceEvent, !options.cancelled);
        this.cancelled = options.cancelled ?? false;
    }
}
const activePointers = new WeakMap();
const VELOCITY_WINDOW = 80;
const dragMixin = createMixin((handle) => {
    let options = {};
    let host;
    let session;
    let cancelSession;
    let registration;
    let xClaim;
    let yClaim;
    let x = 0;
    let y = 0;
    function write() {
        xClaim?.set(x);
        yClaim?.set(y);
    }
    function interrupt() {
        registration?.stop();
        xClaim = undefined;
        yClaim = undefined;
        x = registration?.read('x') ?? 0;
        y = registration?.read('y') ?? 0;
    }
    function bounds(space) {
        if (typeof options.constraints !== 'function')
            return { ...options.constraints };
        let container = options.constraints();
        if (!container || !host)
            return {};
        if (!(container instanceof HTMLElement))
            return { ...container };
        space ??= measureCoordinateSpace(host);
        let outer = measureCoordinateSpace(container, true);
        let minimum = space.toLocal({
            x: outer.origin.x - space.origin.x,
            y: outer.origin.y - space.origin.y,
        });
        let inset = space.toLocal(outer.toClient({ x: container.clientLeft, y: container.clientTop }));
        let size = space.toLocal(outer.toClient({ x: container.clientWidth, y: container.clientHeight }));
        let left = minimum.x + inset.x;
        let top = minimum.y + inset.y;
        let right = left + size.x - host.offsetWidth;
        let bottom = top + size.y - host.offsetHeight;
        return {
            left: Math.min(left, right),
            right: Math.max(left, right),
            top: Math.min(top, bottom),
            bottom: Math.max(top, bottom),
        };
    }
    let resizeObserver;
    let observedContainer;
    let measuredLimits;
    function observeConstraints() {
        let container = typeof options.constraints === 'function' ? options.constraints() : undefined;
        if (!(container instanceof HTMLElement))
            container = undefined;
        if (container === observedContainer)
            return;
        resizeObserver?.disconnect();
        observedContainer = container;
        measuredLimits = container ? bounds() : undefined;
        if (!container || !host)
            return;
        resizeObserver = new ResizeObserver(() => {
            let previous = measuredLimits;
            let next = bounds();
            measuredLimits = next;
            if (!previous || session || !registration)
                return;
            if (['left', 'right', 'top', 'bottom'].every((edge) => previous[edge] === next[edge]))
                return;
            interrupt();
            for (let axis of ['x', 'y']) {
                let min = axis === 'x' ? 'left' : 'top';
                let max = axis === 'x' ? 'right' : 'bottom';
                let oldMin = previous[min];
                let oldMax = previous[max];
                let newMin = next[min];
                let newMax = next[max];
                if (oldMin === undefined ||
                    oldMax === undefined ||
                    newMin === undefined ||
                    newMax === undefined)
                    continue;
                let claim = registration.claim(axis, 'animation');
                if (!claim)
                    continue;
                let progress = oldMax === oldMin
                    ? 0.5
                    : Math.max(0, Math.min(1, (claim.read() - oldMin) / (oldMax - oldMin)));
                claim.set(newMin + progress * (newMax - newMin));
                claim.release();
            }
            x = registration.read('x');
            y = registration.read('y');
        });
        resizeObserver.observe(container);
        resizeObserver.observe(host);
    }
    function elasticity(edge) {
        let value = options.elasticity ?? 0.2;
        return typeof value === 'number' ? value : (value[edge] ?? 0.2);
    }
    function settle(velocity, cancelled, limits, axis) {
        interrupt();
        if (!registration)
            return;
        let settings = options;
        function destination(value, min, max) {
            return Math.max(min ?? -Infinity, Math.min(max ?? Infinity, value));
        }
        function releaseAxis(name, min, max) {
            if (!registration)
                return;
            let claim = registration.claim(name, 'animation');
            if (!claim)
                return;
            let position = claim.read();
            let speed = options.momentum === false || cancelled ? 0 : velocity[name];
            let hardMin = elasticity(name === 'x' ? 'left' : 'top') === 0;
            let hardMax = elasticity(name === 'x' ? 'right' : 'bottom') === 0;
            let friction = settings.friction ?? 2;
            if (!Number.isFinite(friction) || friction <= 0)
                friction = 2;
            let decayTime = 1 / friction;
            let projected = position + speed * decayTime;
            let inertiaTarget = options.snapToOrigin || cancelled
                ? projected
                : (settings.modifyTarget?.(projected, name) ?? projected);
            // Adjust the inertia curve itself, rather than springing to a snap point.
            if (!options.snapToOrigin && !cancelled && destination(position, min, max) === position)
                speed = (inertiaTarget - position) / decayTime;
            let target = options.snapToOrigin
                ? destination(0, min, max)
                : cancelled || destination(position, min, max) !== position
                    ? destination(position, min, max)
                    : undefined;
            if (prefersReducedMotion()) {
                claim.set(target ?? destination(settings.modifyTarget ? inertiaTarget : position, min, max));
                claim.release();
                return;
            }
            let complete;
            let finished = new Promise((resolve) => {
                complete = resolve;
            });
            let playback = frames((dt) => {
                if (target === undefined && destination(position, min, max) !== position)
                    target = destination(position, min, max);
                let decay = Math.exp(-dt / decayTime);
                let next = target === undefined
                    ? {
                        position: inertiaTarget - (inertiaTarget - position) * decay,
                        velocity: speed * decay,
                    }
                    : springStep(position, speed, target, dt, settings);
                if (hardMin && min !== undefined && next.position < min) {
                    next.position = min;
                    next.velocity = Math.max(0, next.velocity);
                    target = min;
                }
                if (hardMax && max !== undefined && next.position > max) {
                    next.position = max;
                    next.velocity = Math.min(0, next.velocity);
                    target = max;
                }
                let active = Math.abs(next.velocity) + Math.abs(next.position - (target ?? inertiaTarget)) > 0.1;
                position = active ? next.position : destination(target ?? inertiaTarget, min, max);
                speed = active ? next.velocity : 0;
                claim.set(position);
                if (!active)
                    complete?.();
                return active;
            });
            claim.start({
                sample() {
                    return position;
                },
                stop() {
                    playback.stop();
                    complete?.();
                },
                pause: playback.pause,
                resume: playback.resume,
                finished,
            });
        }
        if (axis !== 'y')
            releaseAxis('x', limits.left, limits.right);
        if (axis !== 'x')
            releaseAxis('y', limits.top, limits.bottom);
    }
    function start(event) {
        if (!event.isPrimary || event.button !== 0 || session || !host)
            return;
        let node = host;
        registration?.pause();
        function takePosition(allowed) {
            for (let name of ['x', 'y']) {
                if (allowed === (name === 'x' ? 'y' : 'x'))
                    continue;
                let projection = registration?.claim(name === 'x' ? 'layoutX' : 'layoutY', 'animation');
                let shift = projection?.read() ?? 0;
                projection?.set(0);
                projection?.release();
                if (shift) {
                    let claim = registration?.claim(name, 'animation');
                    claim?.set(claim.read() + shift);
                    claim?.release();
                }
            }
            xClaim =
                allowed === 'y' ? undefined : registration?.claim('x', 'gesture', () => cancelSession?.());
            yClaim =
                allowed === 'x' ? undefined : registration?.claim('y', 'gesture', () => cancelSession?.());
            x = registration?.read('x') ?? 0;
            y = registration?.read('y') ?? 0;
        }
        x = registration?.read('x') ?? 0;
        y = registration?.read('y') ?? 0;
        let initial = { x: event.clientX, y: event.clientY, offset: { x: x, y: y } };
        let axis = options.axis;
        let offset = { ...initial.offset };
        let velocity = { x: 0, y: 0 };
        let visualVelocity = { x: 0, y: 0 };
        let previous = { x: event.clientX, y: event.clientY, time: event.timeStamp };
        let initialSample = { ...previous, position: { x: x, y: y } };
        let history = [initialSample];
        function velocitySample(time) {
            while (history.length > 1 && history[1].time < time - VELOCITY_WINDOW)
                history.shift();
            let sample = history[0];
            // A hold before movement must not dilute a flick once recent movement samples exist.
            if (sample === initialSample &&
                history.length > 1 &&
                time - sample.time > VELOCITY_WINDOW * 2)
                sample = history[1];
            return sample;
        }
        let space = measureCoordinateSpace(node);
        let pointer = { x: event.clientX, y: event.clientY };
        let grabbed = space.toLocal({ x: pointer.x - space.origin.x, y: pointer.y - space.origin.y });
        grabbed.x -= x;
        grabbed.y -= y;
        let limits = bounds(space);
        let dragging = false;
        let controller = new AbortController();
        let window = node.ownerDocument.defaultView;
        if (!window)
            return;
        let owners = activePointers.get(window);
        if (!owners)
            activePointers.set(window, (owners = new Map()));
        let pointerOwners = owners;
        let owner = Symbol('drag gesture');
        let stream = beginPointerSession(event, window);
        session = controller;
        function rebase(dx, dy) {
            if (axis !== 'y' && xClaim) {
                initial.offset.x += dx;
                offset.x += dx;
                x += dx;
                xClaim.set(x);
                for (let sample of history)
                    sample.position.x += dx;
            }
            if (axis !== 'x' && yClaim) {
                initial.offset.y += dy;
                offset.y += dy;
                y += dy;
                yClaim.set(y);
                for (let sample of history)
                    sample.position.y += dy;
            }
            return { x: axis === 'y' ? dx : 0, y: axis === 'x' ? dy : 0 };
        }
        let removeRebase = registration?.onLayoutRebase((dx, dy) => {
            let remaining = rebase(dx, dy);
            if (axis !== 'y' && xClaim) {
                if (limits.left !== undefined)
                    limits.left += dx;
                if (limits.right !== undefined)
                    limits.right += dx;
            }
            if (axis !== 'x' && yClaim) {
                if (limits.top !== undefined)
                    limits.top += dy;
                if (limits.bottom !== undefined)
                    limits.bottom += dy;
            }
            return remaining;
        });
        function rawPosition() {
            let point = space.toLocal({ x: pointer.x - space.origin.x, y: pointer.y - space.origin.y });
            return { x: point.x - grabbed.x, y: point.y - grabbed.y };
        }
        function refreshSpace() {
            let next = measureCoordinateSpace(node);
            if (typeof options.constraints === 'function')
                limits = bounds(next);
            if (sameCoordinateSpace(space, next))
                return;
            space = next;
            let nextOffset = rawPosition();
            rebase(nextOffset.x - offset.x, nextOffset.y - offset.y);
        }
        let geometryFrame = requestAnimationFrame(function measure() {
            if (controller.signal.aborted)
                return;
            if (dragging && node.isConnected)
                refreshSpace();
            geometryFrame = requestAnimationFrame(measure);
        });
        function release(cancelled, sourceEvent, settling = true) {
            let time = sourceEvent?.timeStamp ?? performance.now();
            if (dragging && node.isConnected)
                refreshSpace();
            if (pointerOwners.get(event.pointerId) === owner)
                pointerOwners.delete(event.pointerId);
            cancelAnimationFrame(geometryFrame);
            removeRebase?.();
            controller.abort();
            stream.dispose();
            session = undefined;
            cancelSession = undefined;
            node.removeAttribute('data-dragging');
            node.removeAttribute('data-drag-axis');
            xClaim?.release();
            yClaim?.release();
            xClaim = undefined;
            yClaim = undefined;
            if (!dragging) {
                if (settling)
                    registration?.resume();
                return;
            }
            if (time - previous.time > 100) {
                velocity = { x: 0, y: 0 };
                visualVelocity = { x: 0, y: 0 };
            }
            let point = !cancelled && sourceEvent instanceof PointerEvent && sourceEvent.type === 'pointerup'
                ? { x: sourceEvent.clientX, y: sourceEvent.clientY }
                : pointer;
            let delta = { x: point.x - previous.x, y: point.y - previous.y };
            if (delta.x || delta.y) {
                let sample = velocitySample(time);
                let seconds = Math.max((time - sample.time) / 1000, 0.001);
                velocity = { x: (point.x - sample.x) / seconds, y: (point.y - sample.y) / seconds };
            }
            let endEvent = new DragEndEvent({
                point,
                delta,
                offset: { x: point.x - initial.x, y: point.y - initial.y },
                velocity,
                axis,
            }, { cancelled, sourceEvent });
            node.dispatchEvent(endEvent);
            if (settling && (cancelled || !endEvent.defaultPrevented))
                settle(visualVelocity, cancelled, limits, axis);
        }
        cancelSession = () => release(true, undefined, false);
        function movePointer(move) {
            if (move.pointerId !== event.pointerId)
                return;
            refreshSpace();
            pointer = { x: move.clientX, y: move.clientY };
            let delta = space.toLocal({ x: move.clientX - initial.x, y: move.clientY - initial.y });
            let dx = delta.x;
            let dy = delta.y;
            let justStarted = false;
            if (!dragging) {
                if (Math.abs(dx) < 4 && Math.abs(dy) < 4)
                    return;
                if ((axis === 'x' && Math.abs(dy) > Math.abs(dx)) ||
                    (axis === 'y' && Math.abs(dx) > Math.abs(dy))) {
                    release(true);
                    return;
                }
                if (pointerOwners.has(event.pointerId)) {
                    release(true);
                    return;
                }
                pointerOwners.set(event.pointerId, owner);
                if (options.directionLock && !axis)
                    axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
                let before = { x, y };
                interrupt();
                takePosition(axis);
                grabbed.x -= x - before.x;
                grabbed.y -= y - before.y;
                initial.offset = { x, y };
                offset = { x, y };
                dragging = true;
                justStarted = true;
                stream.capture(node);
                node.setAttribute('data-dragging', '');
                if (axis)
                    node.setAttribute('data-drag-axis', axis);
            }
            move.preventDefault();
            let raw = rawPosition();
            offset = {
                x: axis === 'y' ? initial.offset.x : raw.x,
                y: axis === 'x' ? initial.offset.y : raw.y,
            };
            let sample = velocitySample(move.timeStamp);
            let seconds = Math.max((move.timeStamp - sample.time) / 1000, 0.001);
            velocity = {
                x: (move.clientX - sample.x) / seconds,
                y: (move.clientY - sample.y) / seconds,
            };
            function resist(value, min, max, lower, upper) {
                let edge = min !== undefined && value < min
                    ? min
                    : max !== undefined && value > max
                        ? max
                        : undefined;
                if (edge === undefined)
                    return value;
                let distance = value - edge;
                return edge + distance * elasticity(distance < 0 ? lower : upper);
            }
            x = resist(offset.x, limits.left, limits.right, 'left', 'right');
            y = resist(offset.y, limits.top, limits.bottom, 'top', 'bottom');
            write();
            visualVelocity = {
                x: (x - sample.position.x) / seconds,
                y: (y - sample.position.y) / seconds,
            };
            history.push({
                x: move.clientX,
                y: move.clientY,
                time: move.timeStamp,
                position: { x: x, y: y },
            });
            let info = {
                point: { x: move.clientX, y: move.clientY },
                offset: { x: move.clientX - initial.x, y: move.clientY - initial.y },
                delta: { x: move.clientX - previous.x, y: move.clientY - previous.y },
                velocity,
                axis,
            };
            previous = { x: move.clientX, y: move.clientY, time: move.timeStamp };
            if (justStarted)
                node.dispatchEvent(new DragStartEvent(info, move));
            if (!controller.signal.aborted)
                node.dispatchEvent(new DragEvent(info, move));
        }
        stream.attach({
            move: movePointer,
            end(up, cancelled) {
                release(cancelled, up);
            },
        });
    }
    handle.addEventListener('insert', ({ node }) => {
        host = node;
        registration ??= retainAnimationHost(node);
        x = registration.read('x');
        y = registration.read('y');
        handle.queueTask(observeConstraints);
    });
    handle.addEventListener('commit', () => {
        handle.queueTask(observeConstraints);
    });
    handle.addEventListener('beforeRemove', () => {
        cancelSession?.();
        interrupt();
    });
    handle.addEventListener('reclaimed', () => {
        interrupt();
        for (let axis of ['x', 'y']) {
            let claim = registration?.claim(axis, 'animation');
            claim?.set(0);
            claim?.release();
        }
    });
    handle.addEventListener('remove', () => {
        resizeObserver?.disconnect();
        cancelSession?.();
        interrupt();
        registration?.dispose();
        registration = undefined;
        host = undefined;
    });
    return (nextOptions) => {
        options = nextOptions ?? {};
        return [
            css({
                touchAction: options.axis === 'x' ? 'pan-y' : options.axis === 'y' ? 'pan-x' : 'none',
                userSelect: 'none',
            }),
            on('dragstart', (event) => event.preventDefault()),
            on('pointerdown', (event) => {
                if (event.target instanceof Element) {
                    let control = event.target.closest('button, a, input, textarea, select, [contenteditable], [data-drag-ignore]');
                    if (control && control !== host && host?.contains(control))
                        return;
                }
                start(event);
            }),
        ];
    };
});
/**
 * Adds pointer dragging, optional constraints and release animation to an element.
 * Active axes take over position playback; layout changes preserve the held position.
 *
 * @param options Gesture constraints and release settings.
 * @returns A mixin for the draggable element.
 */
export function drag(options = {}) {
    return dragMixin(options);
}
/**
 * Listens for recognized drags starting on this element or a descendant.
 * @param handler Handles the bubbling drag-start event and handler cancellation signal.
 * @param captureBoolean Whether to listen during capture (default: false).
 * @returns An event-listener mixin.
 */
export function onDragStart(handler, captureBoolean) {
    return on(DRAG_START_EVENT, handler, captureBoolean);
}
/**
 * Listens for pointer movement during drags on this element or a descendant.
 * @param handler Handles the bubbling drag event and handler cancellation signal.
 * @param captureBoolean Whether to listen during capture (default: false).
 * @returns An event-listener mixin.
 */
export function onDrag(handler, captureBoolean) {
    return on(DRAG_EVENT, handler, captureBoolean);
}
/**
 * Listens for drags ending before settling. Prevent default synchronously to retain position.
 * @param handler Handles the bubbling drag-end event and handler cancellation signal.
 * @param captureBoolean Whether to listen during capture (default: false).
 * @returns An event-listener mixin.
 */
export function onDragEnd(handler, captureBoolean) {
    return on(DRAG_END_EVENT, handler, captureBoolean);
}
//# sourceMappingURL=drag-mixin.js.map