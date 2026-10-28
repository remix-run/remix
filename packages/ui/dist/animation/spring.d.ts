/**
 * Spring physics based on SwiftUI's spring math.
 *
 * Returns a decorated iterator that can be:
 * - Iterated to get position values (0→1)
 * - Spread for WAAPI: { ...spring() }
 * - Stringified for CSS: `transform ${spring()}`
 *
 * Spring Parameter Conversion (SwiftUI formulas, mass = 1):
 *   stiffness = (2π ÷ duration)²
 *   damping = 1 - 4π × bounce ÷ duration  (bounce ≥ 0)
 *   damping = 4π ÷ (duration + 4π × bounce)  (bounce < 0)
 */
export type SpringPreset = 'smooth' | 'snappy' | 'bouncy';
/**
 * Options for generating a spring easing iterator.
 */
export interface SpringOptions {
    /** Perceptual duration in milliseconds used to derive spring stiffness. */
    duration?: number;
    /** Spring bounce amount from overdamped (`< 0`) to bouncy (`> 0`). */
    bounce?: number;
    /** Initial velocity in units per second. */
    velocity?: number;
}
/**
 * Iterator returned by {@link spring}, decorated for CSS and WAAPI use.
 */
export interface SpringIterator extends IterableIterator<number> {
    /** Time when spring settles to rest (milliseconds) */
    duration: number;
    /** CSS linear() easing function */
    easing: string;
    /** Returns "duration ms linear(...)" for CSS transitions */
    toString(): string;
}
export interface SpringFunction {
    (preset: SpringPreset, overrides?: Omit<SpringOptions, 'bounce'>): SpringIterator;
    (options?: SpringOptions): SpringIterator;
    transition(property: string | string[], presetOrOptions?: SpringPreset | SpringOptions, overrides?: Omit<SpringOptions, 'bounce'>): string;
    presets: Record<SpringPreset, {
        duration: number;
        bounce: number;
    }>;
}
/**
 * Create a spring-physics animation iterator for CSS transitions and WAAPI.
 *
 * The returned iterator can be:
 * - Iterated to get position values (0→1)
 * - Spread into WAAPI options: `element.animate(keyframes, { ...spring() })`
 * - Stringified for CSS: `` `transform ${spring()}` ``
 *
 * @example
 * // Named preset
 * let s = spring('bouncy')
 * element.style.transition = `transform ${s}`
 *
 * @example
 * // Custom parameters
 * let s = spring({ duration: 500, bounce: 0.2 })
 * element.animate(keyframes, { ...s })
 *
 * @example
 * // Transition helper for multiple properties
 * element.style.transition = spring.transition(['transform', 'opacity'], 'snappy')
 */
export declare const spring: SpringFunction;
