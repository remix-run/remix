/** Error thrown when matcher compilation or matching exceeds a configured resource limit. */
export class MatcherResourceError extends Error {
    /** Structured information about the exceeded limit. */
    details;
    /**
     * Creates a matcher resource error.
     *
     * @param details Information about the exceeded limit.
     */
    constructor(details) {
        super(`${details.limit} exceeded: ${details.actual} > ${details.maximum}`);
        this.name = 'MatcherResourceError';
        this.details = details;
    }
}
const defaultMatcherLimits = {
    maxPatternSize: 64 * 1024,
    maxMatcherSize: 16 * 1024 * 1024,
    maxMatchWork: 1_000_000,
};
export function createMatchWorkBudget(maximum) {
    return { maximum, actual: 0 };
}
export function consumeMatchWork(budget, count) {
    let actual = budget.actual + count;
    if (!Number.isSafeInteger(actual))
        actual = Number.MAX_SAFE_INTEGER;
    checkMatcherLimit('maxMatchWork', budget.maximum, actual);
    budget.actual = actual;
}
export function resolveMatcherLimits(limits) {
    let result = { ...defaultMatcherLimits, ...limits };
    for (let [limit, maximum] of Object.entries(result)) {
        if (!Number.isSafeInteger(maximum) || maximum < 0) {
            throw new RangeError(`${limit} must be a non-negative safe integer`);
        }
    }
    return result;
}
export function checkMatcherLimit(limit, maximum, actual) {
    if (actual > maximum)
        throw new MatcherResourceError({ limit, maximum, actual });
}
