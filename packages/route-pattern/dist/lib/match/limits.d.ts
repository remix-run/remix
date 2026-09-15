/** Resource limits applied while compiling and matching route patterns. */
export interface MatcherLimits {
    /** Maximum size of one pattern, measured in UTF-8 bytes. Defaults to 65,536. */
    maxPatternSize: number;
    /** Maximum combined size of all patterns, measured in UTF-8 bytes. Defaults to 16,777,216. */
    maxMatcherSize: number;
    /** Maximum aggregate work performed by one URL match. Defaults to 1,000,000. */
    maxMatchWork: number;
}
/** Structured details describing a matcher resource-limit failure. */
export interface MatcherResourceErrorDetails {
    /** Limit that was exceeded. */
    limit: keyof MatcherLimits;
    /** Configured maximum value. */
    maximum: number;
    /** Value requested by the failed operation. */
    actual: number;
}
/** Error thrown when matcher compilation or matching exceeds a configured resource limit. */
export declare class MatcherResourceError extends Error {
    /** Structured information about the exceeded limit. */
    details: MatcherResourceErrorDetails;
    /**
     * Creates a matcher resource error.
     *
     * @param details Information about the exceeded limit.
     */
    constructor(details: MatcherResourceErrorDetails);
}
export type MatchWorkBudget = {
    readonly maximum: number;
    actual: number;
};
export declare function createMatchWorkBudget(maximum: number): MatchWorkBudget;
export declare function consumeMatchWork(budget: MatchWorkBudget, count: number): void;
export declare function resolveMatcherLimits(limits?: Partial<MatcherLimits>): MatcherLimits;
export declare function checkMatcherLimit(limit: keyof MatcherLimits, maximum: number, actual: number): void;
//# sourceMappingURL=limits.d.ts.map