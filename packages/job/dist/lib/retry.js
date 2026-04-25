let DEFAULT_MAX_ATTEMPTS = 5;
let DEFAULT_STRATEGY = 'exponential';
let DEFAULT_BASE_DELAY_MS = 1000;
let DEFAULT_MAX_DELAY_MS = 300000;
let DEFAULT_JITTER = 'full';
export function normalizeRetryPolicy(basePolicy, overridePolicy) {
    let source = { ...basePolicy, ...overridePolicy };
    let maxAttempts = normalizeWholeNumber(source.maxAttempts, DEFAULT_MAX_ATTEMPTS, 1);
    let strategy = source.strategy ?? DEFAULT_STRATEGY;
    let baseDelayMs = normalizeWholeNumber(source.baseDelayMs, DEFAULT_BASE_DELAY_MS, 1);
    let maxDelayMs = normalizeWholeNumber(source.maxDelayMs, DEFAULT_MAX_DELAY_MS, baseDelayMs);
    let jitter = source.jitter ?? DEFAULT_JITTER;
    return {
        maxAttempts,
        strategy,
        baseDelayMs,
        maxDelayMs,
        jitter,
    };
}
export function computeRetryDelayMs(attempt, policy, random = Math.random) {
    let normalizedAttempt = normalizeWholeNumber(attempt, 1, 1);
    let attemptDelay = policy.baseDelayMs;
    if (policy.strategy === 'exponential') {
        let exponent = Math.max(0, normalizedAttempt - 1);
        attemptDelay = policy.baseDelayMs * 2 ** exponent;
    }
    let cappedDelay = Math.min(policy.maxDelayMs, Math.max(policy.baseDelayMs, attemptDelay));
    if (policy.jitter === 'none') {
        return cappedDelay;
    }
    return Math.floor(random() * cappedDelay);
}
export function computeRetryAt(now, attempt, policy, random = Math.random) {
    let delay = computeRetryDelayMs(attempt, policy, random);
    return now + delay;
}
function normalizeWholeNumber(value, fallback, minValue) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }
    let normalized = Math.floor(value);
    if (normalized < minValue) {
        return minValue;
    }
    return normalized;
}
