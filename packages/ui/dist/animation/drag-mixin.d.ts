import { on } from '@remix-run/component';
import type { Dispatched, ElementProps, MixinDescriptor } from '@remix-run/component';
/** A two-dimensional position, offset or velocity. */
interface DragPoint {
    /** Horizontal component, in pixels or pixels per second for velocity. */
    x: number;
    /** Vertical component, in pixels or pixels per second for velocity. */
    y: number;
}
/** Allowed drag offsets in the element's local coordinate space. Omitted edges are unbounded. */
interface DragBounds {
    /** Minimum horizontal offset in pixels. */
    left?: number;
    /** Maximum horizontal offset in pixels. */
    right?: number;
    /** Minimum vertical offset in pixels. */
    top?: number;
    /** Maximum vertical offset in pixels. */
    bottom?: number;
}
declare const DRAG_START_EVENT: 'rmx:drag-start';
declare const DRAG_EVENT: 'rmx:drag';
declare const DRAG_END_EVENT: 'rmx:drag-end';
declare global {
    interface HTMLElementEventMap {
        [DRAG_START_EVENT]: DragStartEvent;
        [DRAG_EVENT]: DragEvent;
        [DRAG_END_EVENT]: DragEndEvent;
    }
    interface DocumentEventMap {
        [DRAG_START_EVENT]: DragStartEvent;
        [DRAG_EVENT]: DragEvent;
        [DRAG_END_EVENT]: DragEndEvent;
    }
    interface WindowEventMap {
        [DRAG_START_EVENT]: DragStartEvent;
        [DRAG_EVENT]: DragEvent;
        [DRAG_END_EVENT]: DragEndEvent;
    }
}
/** Pointer measurements for one recognized drag, independent of the element's visual movement. */
interface DragInfo {
    /** Pointer position in client pixels. */
    readonly point: Readonly<DragPoint>;
    /** Pointer displacement since pointer-down, in client pixels, before constraints or elasticity. */
    readonly offset: Readonly<DragPoint>;
    /** Movement since the previous pointer sample, in client pixels. */
    readonly delta: Readonly<DragPoint>;
    /** Pointer velocity in client pixels per second. */
    readonly velocity: Readonly<DragPoint>;
    /** The configured or direction-locked axis, or undefined when both axes are active. */
    readonly axis: 'x' | 'y' | undefined;
}
declare class DragGestureEvent<source extends Event | undefined> extends Event implements DragInfo {
    readonly point: Readonly<DragPoint>;
    readonly delta: Readonly<DragPoint>;
    readonly offset: Readonly<DragPoint>;
    readonly velocity: Readonly<DragPoint>;
    readonly axis: 'x' | 'y' | undefined;
    readonly sourceEvent: source;
    constructor(type: string, info: DragInfo, sourceEvent: source, cancelable?: boolean);
}
/** The first recognized drag movement. Measurements include movement since pointer-down. */
export declare class DragStartEvent extends DragGestureEvent<PointerEvent> {
    /**
     * Creates a bubbling drag-start notification.
     * @param info Pointer measurements when the gesture is recognized.
     * @param sourceEvent The pointer movement that started dragging.
     */
    constructor(info: DragInfo, sourceEvent: PointerEvent);
}
/** Pointer movement during a recognized drag. */
export declare class DragEvent extends DragGestureEvent<PointerEvent> {
    /**
     * Creates a bubbling drag-movement notification.
     * @param info Pointer measurements for this movement.
     * @param sourceEvent The original pointer movement.
     */
    constructor(info: DragInfo, sourceEvent: PointerEvent);
}
/** Drag completion, before settling. Prevent default on a normal end to retain position. */
export declare class DragEndEvent extends DragGestureEvent<Event | undefined> {
    /** Whether the gesture ended without a normal release. Cancellation cannot be prevented. */
    readonly cancelled: boolean;
    /**
     * Creates a bubbling drag-end event with an independent default action.
     * @param info Final pointer measurements.
     * @param options Cancellation state and the original input event, when available.
     */
    constructor(info: DragInfo, options?: {
        cancelled?: boolean;
        sourceEvent?: Event;
    });
}
/** Pointer dragging, constraints and release behavior for one element. */
export interface DragOptions {
    /** Restrict movement to one axis. Both axes are enabled when omitted. */
    axis?: 'x' | 'y';
    /** Let the initial gesture choose an axis (default: false). */
    directionLock?: boolean;
    /**
     * Translation bounds in local pixels, or a resolver returning a containing HTMLElement or bounds.
     * Element bounds track resizing. Larger content can pan within the containing element.
     * Omitted edges or an undefined resolver result leave movement unbounded.
     */
    constraints?: DragBounds | (() => HTMLElement | DragBounds | undefined);
    /** Linear overshoot factor from 0 to 1, optionally per edge (default: 0.2). Zero prevents boundary bounce on release too. */
    elasticity?: number | DragBounds;
    /** Continue with release velocity (default: true). */
    momentum?: boolean;
    /** Spring back to the origin, within the constraints (default: false). */
    snapToOrigin?: boolean;
    /** Stiffness of the origin-return and boundary-return spring (default: 158). */
    stiffness?: number;
    /**
     * Damping ratio of the return spring. Below 1 allows oscillation, 1 is critical damping,
     * and above 1 is overdamped. Zero removes damping (default: 1).
     */
    dampingRatio?: number;
    /**
     * Exponential momentum decay rate per second. Higher values slow movement faster and shorten travel.
     * Must be finite and positive. Invalid values use the default (default: 2).
     */
    friction?: number;
    /** Adjust the projected destination in local pixels, before applying constraints. */
    modifyTarget?: (target: number, axis: 'x' | 'y') => number;
}
/**
 * Adds pointer dragging, optional constraints and release animation to an element.
 * Active axes take over position playback; layout changes preserve the held position.
 *
 * @param options Gesture constraints and release settings.
 * @returns A mixin for the draggable element.
 */
export declare function drag(options?: DragOptions): MixinDescriptor<HTMLElement, [DragOptions], ElementProps>;
type DragEventHandler<event extends Event, target extends HTMLElement> = (event: Dispatched<event, target>, signal: AbortSignal) => void | Promise<void>;
/**
 * Listens for recognized drags starting on this element or a descendant.
 * @param handler Handles the bubbling drag-start event and handler cancellation signal.
 * @param captureBoolean Whether to listen during capture (default: false).
 * @returns An event-listener mixin.
 */
export declare function onDragStart<target extends HTMLElement>(handler: DragEventHandler<DragStartEvent, target>, captureBoolean?: boolean): ReturnType<typeof on<target, typeof DRAG_START_EVENT>>;
/**
 * Listens for pointer movement during drags on this element or a descendant.
 * @param handler Handles the bubbling drag event and handler cancellation signal.
 * @param captureBoolean Whether to listen during capture (default: false).
 * @returns An event-listener mixin.
 */
export declare function onDrag<target extends HTMLElement>(handler: DragEventHandler<DragEvent, target>, captureBoolean?: boolean): ReturnType<typeof on<target, typeof DRAG_EVENT>>;
/**
 * Listens for drags ending before settling. Prevent default synchronously to retain position.
 * @param handler Handles the bubbling drag-end event and handler cancellation signal.
 * @param captureBoolean Whether to listen during capture (default: false).
 * @returns An event-listener mixin.
 */
export declare function onDragEnd<target extends HTMLElement>(handler: DragEventHandler<DragEndEvent, target>, captureBoolean?: boolean): ReturnType<typeof on<target, typeof DRAG_END_EVENT>>;
export {};
