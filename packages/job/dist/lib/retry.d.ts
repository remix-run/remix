import type { RetryPolicy, ResolvedRetryPolicy } from './types.ts';
export declare function normalizeRetryPolicy(basePolicy?: RetryPolicy, overridePolicy?: RetryPolicy): ResolvedRetryPolicy;
export declare function computeRetryDelayMs(attempt: number, policy: ResolvedRetryPolicy, random?: () => number): number;
export declare function computeRetryAt(now: number, attempt: number, policy: ResolvedRetryPolicy, random?: () => number): number;
//# sourceMappingURL=retry.d.ts.map