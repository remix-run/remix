import { parse } from '@remix-run/data-schema';
import { normalizeRetryPolicy } from "./retry.js";
/**
 * Creates a typed map of job handlers.
 *
 * @param jobs Job definitions keyed by name
 * @returns The same job definition object with preserved key/schema types
 */
export function createJobs(jobs) {
    return jobs;
}
/**
 * Creates a job scheduler backed by a `JobStorage` implementation.
 *
 * @param jobs Registered job definitions keyed by name
 * @param storage Storage adapter used for scheduler reads and writes
 * @param hooks Optional scheduler lifecycle hooks
 * @returns A `JobScheduler` for enqueuing and querying jobs
 */
export function createJobScheduler(jobs, storage, hooks) {
    let jobNames = new WeakMap();
    for (let name in jobs) {
        let definition = jobs[name];
        if (definition != null && typeof definition === 'object') {
            jobNames.set(definition, name);
        }
    }
    return {
        async enqueue(job, payload, enqueueOptions) {
            let jobName = resolveJobName(job, jobNames);
            let definition = jobs[jobName];
            if (definition == null) {
                throw new Error(`Unknown job "${jobName}"`);
            }
            if (enqueueOptions?.delay != null && enqueueOptions.runAt != null) {
                throw new Error('enqueue options cannot include both "delay" and "runAt"');
            }
            let parsedPayload = parse(definition.schema, payload);
            let now = Date.now();
            let queue = enqueueOptions?.queue ?? 'default';
            let runAt = resolveRunAt(now, enqueueOptions);
            let priority = normalizeWholeNumber(enqueueOptions?.priority, 0, Number.MIN_SAFE_INTEGER);
            let retry = normalizeRetryPolicy(definition.retry, enqueueOptions?.retry);
            let result = await storage.enqueue({
                name: jobName,
                queue,
                payload: parsedPayload,
                runAt,
                priority,
                retry,
                dedupeKey: enqueueOptions?.dedupeKey,
                dedupeTtlMs: enqueueOptions?.dedupeTtlMs,
                createdAt: now,
            }, {
                transaction: enqueueOptions?.transaction,
            });
            await runSchedulerHook(hooks, {
                hook: 'onEnqueue',
                event: {
                    job,
                    jobName,
                    payload: parsedPayload,
                    options: enqueueOptions,
                    result,
                },
            });
            return result;
        },
        get(jobId) {
            return storage.get(jobId);
        },
        async cancel(jobId, cancelOptions) {
            let canceled = await storage.cancel(jobId, {
                transaction: cancelOptions?.transaction,
            });
            await runSchedulerHook(hooks, {
                hook: 'onCancel',
                event: {
                    jobId,
                    options: cancelOptions,
                    canceled,
                },
            });
            return canceled;
        },
        listFailedJobs(failedJobOptions) {
            return storage.listFailedJobs({
                queue: failedJobOptions?.queue,
                limit: normalizeOptionalWholeNumber(failedJobOptions?.limit, 50, 1),
            });
        },
        async retryFailedJob(jobId, retryOptions) {
            let retried = await storage.retryFailedJob({
                jobId,
                runAt: retryOptions?.runAt?.getTime(),
                priority: retryOptions?.priority == null
                    ? undefined
                    : normalizeWholeNumber(retryOptions.priority, 0, Number.MIN_SAFE_INTEGER),
                queue: retryOptions?.queue,
            }, {
                transaction: retryOptions?.transaction,
            });
            if (retried == null) {
                throw new Error(`Cannot retry failed job "${jobId}": job not found or not failed`);
            }
            let result = {
                jobId: retried.jobId,
            };
            await runSchedulerHook(hooks, {
                hook: 'onRetryFailedJob',
                event: {
                    jobId,
                    options: retryOptions,
                    result,
                },
            });
            return result;
        },
        async prune(pruneOptions) {
            let now = Date.now();
            let result = await storage.prune({
                completedBefore: resolvePruneCutoff(now, pruneOptions.policy.completedOlderThanMs),
                failedBefore: resolvePruneCutoff(now, pruneOptions.policy.failedOlderThanMs),
                canceledBefore: resolvePruneCutoff(now, pruneOptions.policy.canceledOlderThanMs),
                limit: normalizeWholeNumber(pruneOptions.limit, 500, 1),
            }, {
                transaction: pruneOptions.transaction,
            });
            await runSchedulerHook(hooks, {
                hook: 'onPrune',
                event: {
                    options: pruneOptions,
                    result,
                },
            });
            return result;
        },
    };
}
function resolveJobName(value, names) {
    let name = names.get(value);
    if (name == null) {
        throw new Error('Unknown job definition passed to enqueue()');
    }
    return name;
}
function resolveRunAt(now, options) {
    if (options?.runAt != null) {
        return options.runAt.getTime();
    }
    if (options?.delay != null) {
        return now + normalizeWholeNumber(options.delay, 0, 0);
    }
    return now;
}
function resolvePruneCutoff(now, olderThanMs) {
    if (olderThanMs == null) {
        return undefined;
    }
    return now - normalizeWholeNumber(olderThanMs, 0, 0);
}
function normalizeOptionalWholeNumber(value, fallback, minValue) {
    if (value == null) {
        return undefined;
    }
    return normalizeWholeNumber(value, fallback, minValue);
}
async function runSchedulerHook(hooks, invocation) {
    if (hooks == null) {
        return;
    }
    try {
        if (invocation.hook === 'onEnqueue') {
            if (hooks.onEnqueue == null) {
                return;
            }
            await hooks.onEnqueue(invocation.event);
            return;
        }
        if (invocation.hook === 'onCancel') {
            if (hooks.onCancel == null) {
                return;
            }
            await hooks.onCancel(invocation.event);
            return;
        }
        if (invocation.hook === 'onRetryFailedJob') {
            if (hooks.onRetryFailedJob == null) {
                return;
            }
            await hooks.onRetryFailedJob(invocation.event);
            return;
        }
        if (hooks.onPrune == null) {
            return;
        }
        await hooks.onPrune(invocation.event);
    }
    catch (error) {
        if (hooks.onHookError == null) {
            return;
        }
        try {
            await hooks.onHookError({
                hook: invocation.hook,
                event: invocation.event,
                error,
            });
        }
        catch {
            // Hook errors are fail-open by design.
        }
    }
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
