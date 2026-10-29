/** Timing for an animation or an individual style property. */
export interface TransitionOptions {
    /** Playback duration in milliseconds (default: 150). */
    duration?: number;
    /** CSS easing function (default: 'linear'). */
    easing?: string;
    /** Delay before playback in milliseconds (default: 0). */
    delay?: number;
    /** How the animation combines with underlying styles (default: 'replace'). */
    composite?: CompositeOperation;
}
type StyleProperty = {
    [property in keyof CSSStyleDeclaration]: CSSStyleDeclaration[property] extends string ? property : never;
}[keyof CSSStyleDeclaration] & string;
/** Per-property overrides that inherit the animation's timing and compositing settings. */
export type AnimationTransition = {
    [property in StyleProperty]?: TransitionOptions;
} & {
    [property: `--${string}`]: TransitionOptions | undefined;
};
export type AnimationStyles = {
    [property in StyleProperty]?: string | number;
} & {
    [property: `--${string}`]: string | number | undefined;
};
export {};
