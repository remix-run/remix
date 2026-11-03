import { RoutePattern } from './route-pattern.ts';
import type { JoinPatterns } from './types/join.ts';
/**
 * Join two route patterns.
 *
 * Origin parts (`protocol`, `hostname`, `port`) from `next` override `base` when present.
 * Pathnames are concatenated with a separator inserted between them as needed.
 * Search constraints from both patterns are merged.
 *
 * @param base The base pattern.
 * @param next The next pattern to join onto `base`.
 * @returns The joined route pattern.
 */
export declare function joinPatterns<base extends string, next extends string>(base: base | RoutePattern<base>, next: next | RoutePattern<next>): RoutePattern<JoinPatterns<base, next>>;
//# sourceMappingURL=join.d.ts.map