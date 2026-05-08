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
/**
 * Creates a spring iterator from a named preset.
 *
 * @param preset Preset spring profile to start from.
 * @param overrides Optional preset overrides.
 * @returns A spring iterator.
 */
export declare function spring(preset: SpringPreset, overrides?: Omit<SpringOptions, 'bounce'>): SpringIterator;
/**
 * Creates a spring iterator from explicit spring options.
 *
 * @param options Spring parameters.
 * @returns A spring iterator.
 */
export declare function spring(options?: SpringOptions): SpringIterator;
export declare namespace spring {
    var transition: (property: string | string[], presetOrOptions?: SpringPreset | SpringOptions, overrides?: Omit<SpringOptions, "bounce">) => string;
    var presets: Record<SpringPreset, {
        duration: number;
        bounce: number;
    }>;
}
