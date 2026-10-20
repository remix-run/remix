/**
 * Cubic-bezier control points used by {@link tween}.
 */
export interface BezierCurve {
    /** First control point x coordinate. */
    x1: number;
    /** First control point y coordinate. */
    y1: number;
    /** Second control point x coordinate. */
    x2: number;
    /** Second control point y coordinate. */
    y2: number;
}
/**
 * Common cubic-bezier presets for {@link tween}.
 */
export declare const easings: {
    readonly linear: {
        readonly x1: 0;
        readonly y1: 0;
        readonly x2: 1;
        readonly y2: 1;
    };
    readonly ease: {
        readonly x1: 0.25;
        readonly y1: 0.1;
        readonly x2: 0.25;
        readonly y2: 1;
    };
    readonly easeIn: {
        readonly x1: 0.42;
        readonly y1: 0;
        readonly x2: 1;
        readonly y2: 1;
    };
    readonly easeOut: {
        readonly x1: 0;
        readonly y1: 0;
        readonly x2: 0.58;
        readonly y2: 1;
    };
    readonly easeInOut: {
        readonly x1: 0.42;
        readonly y1: 0;
        readonly x2: 0.58;
        readonly y2: 1;
    };
};
/**
 * Options for generating tweened values over time.
 */
export interface TweenOptions {
    /** Starting value for the tween. */
    from: number;
    /** Ending value for the tween. */
    to: number;
    /** Total tween duration in milliseconds. */
    duration: number;
    /** Cubic-bezier curve used to shape the interpolation. */
    curve: BezierCurve;
}
/**
 * Generator that tweens a value over time using a cubic bezier curve.
 * Yields the current value on each frame. Use the iterator's `done` property
 * to check if the animation is complete.
 * @param options The tween configuration
 * @yields The current tweened value
 * @returns The final value
 */
export declare function tween(options: TweenOptions): Generator<number, number, number>;
