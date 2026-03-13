/**
 * In-memory storage used for unit and contract tests.
 *
 * @returns A `JobStorage` implementation that stores state in memory
 */
export function createMemoryJobStorage() {
    let jobs = new Map();
    let dedupe = new Map();
    return {
        async enqueue(input, _options) {
            cleanupDedupe(Date.now());
            if (input.dedupeKey != null) {
                let existing = dedupe.get(input.dedupeKey);
                if (existing != null && existing.expiresAt > input.createdAt) {
                    return {
                        jobId: existing.jobId,
                        deduped: true,
                    };
                }
            }
            let jobId = crypto.randomUUID();
            jobs.set(jobId, {
                id: jobId,
                name: input.name,
                queue: input.queue,
                payload: input.payload,
                status: 'queued',
                attempts: 0,
                maxAttempts: input.retry.maxAttempts,
                runAt: input.runAt,
                priority: input.priority,
                retry: input.retry,
                createdAt: input.createdAt,
                updatedAt: input.createdAt,
            });
            if (input.dedupeKey != null && input.dedupeTtlMs != null && input.dedupeTtlMs > 0) {
                dedupe.set(input.dedupeKey, {
                    jobId,
                    expiresAt: input.createdAt + input.dedupeTtlMs,
                });
            }
            return {
                jobId,
                deduped: false,
            };
        },
        async get(jobId) {
            let job = jobs.get(jobId);
            return job == null ? null : toPublicJob(job);
        },
        async cancel(jobId, _options) {
            let job = jobs.get(jobId);
            if (job == null || job.status !== 'queued') {
                return false;
            }
            job.status = 'canceled';
            job.updatedAt = Date.now();
            job.canceledAt = job.updatedAt;
            job.completedAt = undefined;
            job.failedAt = undefined;
            jobs.set(jobId, job);
            return true;
        },
        async listFailedJobs(input) {
            let limit = normalizeOptionalWholeNumber(input.limit, 50, 1) ?? 50;
            return Array.from(jobs.values())
                .filter((job) => job.status === 'failed')
                .filter((job) => input.queue == null || job.queue === input.queue)
                .sort((a, b) => (b.failedAt ?? b.updatedAt) - (a.failedAt ?? a.updatedAt))
                .slice(0, limit)
                .map(toPublicJob);
        },
        async retryFailedJob(input, _options) {
            let source = jobs.get(input.jobId);
            if (source == null || source.status !== 'failed') {
                return null;
            }
            let now = Date.now();
            let retriedJobId = crypto.randomUUID();
            jobs.set(retriedJobId, {
                id: retriedJobId,
                name: source.name,
                queue: input.queue ?? source.queue,
                payload: source.payload,
                status: 'queued',
                attempts: 0,
                maxAttempts: source.maxAttempts,
                runAt: input.runAt ?? now,
                priority: input.priority ?? source.priority,
                retry: source.retry,
                createdAt: now,
                updatedAt: now,
            });
            return {
                jobId: retriedJobId,
            };
        },
        async prune(input, _options) {
            if (input.completedBefore == null &&
                input.failedBefore == null &&
                input.canceledBefore == null) {
                return {
                    deleted: 0,
                    completed: 0,
                    failed: 0,
                    canceled: 0,
                };
            }
            let candidates = Array.from(jobs.values())
                .filter((job) => isPruneCandidate(job, input))
                .sort((a, b) => getTerminalTimestamp(a) - getTerminalTimestamp(b));
            let deleted = 0;
            let completed = 0;
            let failed = 0;
            let canceled = 0;
            for (let job of candidates) {
                if (deleted >= input.limit) {
                    break;
                }
                jobs.delete(job.id);
                deleted += 1;
                if (job.status === 'completed') {
                    completed += 1;
                }
                else if (job.status === 'failed') {
                    failed += 1;
                }
                else if (job.status === 'canceled') {
                    canceled += 1;
                }
            }
            return {
                deleted,
                completed,
                failed,
                canceled,
            };
        },
        async claimDueJobs(input) {
            cleanupDedupe(input.now);
            let claimed = [];
            let candidates = Array.from(jobs.values())
                .filter((job) => {
                if (job.status !== 'queued' && job.status !== 'running') {
                    return false;
                }
                if (job.runAt > input.now) {
                    return false;
                }
                if (!input.queues.includes(job.queue)) {
                    return false;
                }
                if (job.status === 'running') {
                    return job.lockedUntil != null && job.lockedUntil <= input.now;
                }
                return true;
            })
                .sort(sortJobs);
            for (let job of candidates) {
                if (claimed.length >= input.limit) {
                    break;
                }
                let lockedUntil = input.now + input.leaseMs;
                job.status = 'running';
                job.lockedBy = input.workerId;
                job.lockedUntil = lockedUntil;
                job.attempts += 1;
                job.updatedAt = input.now;
                jobs.set(job.id, job);
                claimed.push(toPublicJob(job));
            }
            return claimed;
        },
        async heartbeat(input) {
            let job = jobs.get(input.jobId);
            if (job == null ||
                job.status !== 'running' ||
                job.lockedBy !== input.workerId ||
                (job.lockedUntil != null && job.lockedUntil <= input.now)) {
                return false;
            }
            job.lockedUntil = input.now + input.leaseMs;
            job.updatedAt = input.now;
            jobs.set(job.id, job);
            return true;
        },
        async complete(input) {
            let job = jobs.get(input.jobId);
            if (job == null || job.status !== 'running' || job.lockedBy !== input.workerId) {
                return;
            }
            job.status = 'completed';
            job.lockedBy = undefined;
            job.lockedUntil = undefined;
            job.updatedAt = input.now;
            job.completedAt = input.now;
            job.failedAt = undefined;
            job.canceledAt = undefined;
            job.lastError = undefined;
            jobs.set(job.id, job);
        },
        async fail(input) {
            let job = jobs.get(input.jobId);
            if (job == null || job.status !== 'running' || job.lockedBy !== input.workerId) {
                return;
            }
            if (input.terminal) {
                job.status = 'failed';
                job.failedAt = input.now;
                job.completedAt = undefined;
                job.canceledAt = undefined;
            }
            else {
                job.status = 'queued';
                job.runAt = input.retryAt ?? input.now;
                job.failedAt = undefined;
                job.completedAt = undefined;
                job.canceledAt = undefined;
            }
            job.lockedBy = undefined;
            job.lockedUntil = undefined;
            job.lastError = input.error;
            job.updatedAt = input.now;
            jobs.set(job.id, job);
        },
    };
    function cleanupDedupe(now) {
        for (let [key, value] of dedupe.entries()) {
            if (value.expiresAt <= now) {
                dedupe.delete(key);
            }
        }
    }
}
function toPublicJob(job) {
    return {
        id: job.id,
        name: job.name,
        queue: job.queue,
        payload: job.payload,
        status: job.status,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        runAt: job.runAt,
        priority: job.priority,
        retry: job.retry,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        lastError: job.lastError,
        completedAt: job.completedAt,
        failedAt: job.failedAt,
        canceledAt: job.canceledAt,
    };
}
function sortJobs(a, b) {
    if (a.priority !== b.priority) {
        return b.priority - a.priority;
    }
    if (a.runAt !== b.runAt) {
        return a.runAt - b.runAt;
    }
    return a.createdAt - b.createdAt;
}
function normalizeOptionalWholeNumber(value, fallback, minValue) {
    if (value == null) {
        return undefined;
    }
    return normalizeWholeNumber(value, fallback, minValue);
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
function isPruneCandidate(job, input) {
    if (job.status === 'completed' && input.completedBefore != null && job.completedAt != null) {
        return job.completedAt <= input.completedBefore;
    }
    if (job.status === 'failed' && input.failedBefore != null && job.failedAt != null) {
        return job.failedAt <= input.failedBefore;
    }
    if (job.status === 'canceled' && input.canceledBefore != null && job.canceledAt != null) {
        return job.canceledAt <= input.canceledBefore;
    }
    return false;
}
function getTerminalTimestamp(job) {
    if (job.status === 'completed') {
        return job.completedAt ?? Number.MAX_SAFE_INTEGER;
    }
    if (job.status === 'failed') {
        return job.failedAt ?? Number.MAX_SAFE_INTEGER;
    }
    if (job.status === 'canceled') {
        return job.canceledAt ?? Number.MAX_SAFE_INTEGER;
    }
    return Number.MAX_SAFE_INTEGER;
}
