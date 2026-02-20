export interface BezierCurve {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}
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
export interface TweenOptions {
    from: number;
    to: number;
    duration: number;
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
