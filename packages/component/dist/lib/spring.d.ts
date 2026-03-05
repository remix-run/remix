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
export interface SpringOptions {
    duration?: number;
    bounce?: number;
    velocity?: number;
}
export interface SpringIterator extends IterableIterator<number> {
    /** Time when spring settles to rest (milliseconds) */
    duration: number;
    /** CSS linear() easing function */
    easing: string;
    /** Returns "duration ms linear(...)" for CSS transitions */
    toString(): string;
}
/**
 * Create a spring iterator for animations.
 *
 * @example
 * let s = spring('bouncy')
 *
 * // As CSS transition
 * element.style.transition = `transform ${s}`
 *
 * // Spread for WAAPI
 * element.animate(keyframes, { ...spring() })
 *
 * // Iterate for JS animation
 * for (let position of spring()) {
 *   element.style.transform = `translateX(${position * 100}px)`
 * }
 */
export declare function spring(preset: SpringPreset, overrides?: Omit<SpringOptions, 'bounce'>): SpringIterator;
export declare function spring(options?: SpringOptions): SpringIterator;
export declare namespace spring {
    var transition: (property: string | string[], presetOrOptions?: SpringPreset | SpringOptions, overrides?: Omit<SpringOptions, "bounce">) => string;
    var presets: Record<SpringPreset, {
        duration: number;
        bounce: number;
    }>;
}
