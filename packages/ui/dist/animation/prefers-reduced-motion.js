/**
 * Reads the current `prefers-reduced-motion` preference.
 *
 * @returns Whether reduced motion is requested, or `false` when `matchMedia` is unavailable.
 */
export function prefersReducedMotion() {
    return (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
//# sourceMappingURL=prefers-reduced-motion.js.map