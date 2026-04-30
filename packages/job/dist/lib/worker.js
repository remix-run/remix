import { parse } from '@remix-run/data-schema';
import { computeRetryAt } from "./retry.js";
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_LEASE_MS = 30000;
const DEFAULT_RETENTION_INTERVAL_MS = 60000;
const DEFAULT_RETENTION_LIMIT = 500;
/**
 * Creates a worker loop that claims and executes jobs from storage.
 *
 * @param jobs Registered job definitions keyed by name
 * @param storage Storage adapter used to claim, run, and mutate jobs
 * @param options Optional worker settings and hooks
 * @returns A `JobWorker` lifecycle controller
 */
export function createJobWorker(jobs, storage, options = {}) {
    let hooks = options;
    let workerOptions = normalizeWorkerOptions(options);
    let running = false;
    let stopped = false;
    let inFlight = new Set();
    let jobControllers = new Map();
    let loopAbort = new AbortController();
    let workLoopPromise;
    let retentionLoopPromise;
    async function start() {
        if (running) {
            return;
        }
        if (stopped) {
            throw new Error('Worker cannot be started after stop()');
        }
        running = true;
        if (workerOptions.retention != null) {
            retentionLoopPromise = runRetentionLoop();
        }
        workLoopPromise = runWorkLoop();
    }
    async function stop() {
        if (!running) {
            stopped = true;
            return;
        }
        running = false;
        stopped = true;
        loopAbort.abort();
        for (let controller of jobControllers.values()) {
            controller.abort(new Error('Worker stopped'));
        }
        await Promise.all([workLoopPromise, retentionLoopPromise]);
    }
    async function drain(timeoutMs = 30000) {
        let startTime = Date.now();
        while (inFlight.size > 0) {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Timed out waiting for ${inFlight.size} running job(s) to finish`);
            }
            await sleep(20);
        }
    }
    async function runWorkLoop() {
        while (running) {
            let available = workerOptions.concurrency - inFlight.size;
            if (available > 0) {
                let claimedJobs = await storage.claimDueJobs({
                    now: Date.now(),
                    workerId: workerOptions.workerId,
                    queues: workerOptions.queues,
                    limit: available,
                    leaseMs: workerOptions.leaseMs,
                });
                for (let job of claimedJobs) {
                    let task = processJob(job);
                    inFlight.add(task);
                    task.finally(() => {
                        inFlight.delete(task);
                    });
                }
            }
            await sleep(workerOptions.pollIntervalMs, loopAbort.signal);
        }
    }
    async function runRetentionLoop() {
        if (workerOptions.retention == null) {
            return;
        }
        while (running) {
            let now = Date.now();
            let retention = workerOptions.retention;
            let result = await storage.prune({
                completedBefore: resolvePruneCutoff(now, retention.policy.completedOlderThanMs),
                failedBefore: resolvePruneCutoff(now, retention.policy.failedOlderThanMs),
                canceledBefore: resolvePruneCutoff(now, retention.policy.canceledOlderThanMs),
                limit: retention.limit,
            });
            await runWorkerHook(hooks, {
                hook: 'onPrune',
                event: {
                    workerId: workerOptions.workerId,
                    policy: retention.policy,
                    limit: retention.limit,
                    result,
                },
            });
            await sleep(retention.intervalMs, loopAbort.signal);
        }
    }
    async function processJob(job) {
        let definition = jobs[job.name];
        let startedAt = Date.now();
        if (definition == null) {
            let error = `Unknown job "${job.name}"`;
            let now = Date.now();
            await storage.fail({
                jobId: job.id,
                workerId: workerOptions.workerId,
                now,
                error,
                terminal: true,
            });
            await runWorkerHook(hooks, {
                hook: 'onJobFailed',
                event: {
                    job: {
                        ...job,
                        status: 'failed',
                        failedAt: now,
                        updatedAt: now,
                        lastError: error,
                    },
                    workerId: workerOptions.workerId,
                    error,
                },
            });
            return;
        }
        let controller = new AbortController();
        jobControllers.set(job.id, controller);
        let heartbeatTimer = setInterval(() => {
            void storage.heartbeat({
                jobId: job.id,
                workerId: workerOptions.workerId,
                leaseMs: workerOptions.leaseMs,
                now: Date.now(),
            });
        }, workerOptions.heartbeatMs);
        try {
            await runWorkerHook(hooks, {
                hook: 'onJobStart',
                event: {
                    job,
                    workerId: workerOptions.workerId,
                },
            });
            let parsedPayload = parse(definition.schema, job.payload);
            await definition.handle(parsedPayload, {
                signal: controller.signal,
                attempt: job.attempts,
                maxAttempts: job.maxAttempts,
                queue: job.queue,
                workerId: workerOptions.workerId,
                scheduledAt: job.runAt,
            });
            await storage.complete({
                jobId: job.id,
                workerId: workerOptions.workerId,
                now: Date.now(),
            });
            let completedAt = Date.now();
            await runWorkerHook(hooks, {
                hook: 'onJobComplete',
                event: {
                    job: {
                        ...job,
                        status: 'completed',
                        completedAt,
                        updatedAt: completedAt,
                        lastError: undefined,
                    },
                    workerId: workerOptions.workerId,
                    durationMs: completedAt - startedAt,
                },
            });
        }
        catch (error) {
            let now = Date.now();
            let message = normalizeErrorMessage(error);
            if (job.attempts >= job.maxAttempts) {
                await storage.fail({
                    jobId: job.id,
                    workerId: workerOptions.workerId,
                    now,
                    error: message,
                    terminal: true,
                });
                await runWorkerHook(hooks, {
                    hook: 'onJobFailed',
                    event: {
                        job: {
                            ...job,
                            status: 'failed',
                            failedAt: now,
                            updatedAt: now,
                            lastError: message,
                        },
                        workerId: workerOptions.workerId,
                        error: message,
                    },
                });
            }
            else {
                let retryAt = computeRetryAt(now, job.attempts, job.retry);
                await storage.fail({
                    jobId: job.id,
                    workerId: workerOptions.workerId,
                    now,
                    error: message,
                    retryAt,
                    terminal: false,
                });
                await runWorkerHook(hooks, {
                    hook: 'onJobRetry',
                    event: {
                        job: {
                            ...job,
                            status: 'queued',
                            runAt: retryAt,
                            updatedAt: now,
                            lastError: message,
                        },
                        workerId: workerOptions.workerId,
                        retryAt,
                        error: message,
                    },
                });
            }
        }
        finally {
            clearInterval(heartbeatTimer);
            jobControllers.delete(job.id);
        }
    }
    return {
        start,
        stop,
        drain,
    };
}
function normalizeWorkerOptions(options) {
    let leaseMs = normalizeWholeNumber(options?.leaseMs, DEFAULT_LEASE_MS, 1);
    let retention = normalizeRetentionOptions(options?.retention);
    return {
        workerId: options?.workerId ?? crypto.randomUUID(),
        queues: options?.queues ?? ['default'],
        concurrency: normalizeWholeNumber(options?.concurrency, DEFAULT_CONCURRENCY, 1),
        pollIntervalMs: normalizeWholeNumber(options?.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS, 1),
        leaseMs,
        heartbeatMs: normalizeWholeNumber(options?.heartbeatMs, Math.max(1000, Math.floor(leaseMs / 2)), 1),
        retention,
    };
}
function normalizeRetentionOptions(options) {
    if (options == null) {
        return undefined;
    }
    return {
        policy: options.policy,
        intervalMs: normalizeWholeNumber(options.intervalMs, DEFAULT_RETENTION_INTERVAL_MS, 1),
        limit: normalizeWholeNumber(options.limit, DEFAULT_RETENTION_LIMIT, 1),
    };
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
function normalizeErrorMessage(error) {
    if (error instanceof Error && error.message !== '') {
        return error.message;
    }
    return String(error);
}
function resolvePruneCutoff(now, olderThanMs) {
    if (olderThanMs == null) {
        return undefined;
    }
    return now - normalizeWholeNumber(olderThanMs, 0, 0);
}
async function runWorkerHook(hooks, invocation) {
    if (hooks == null) {
        return;
    }
    try {
        if (invocation.hook === 'onJobStart') {
            if (hooks.onJobStart == null) {
                return;
            }
            await hooks.onJobStart(invocation.event);
            return;
        }
        if (invocation.hook === 'onJobComplete') {
            if (hooks.onJobComplete == null) {
                return;
            }
            await hooks.onJobComplete(invocation.event);
            return;
        }
        if (invocation.hook === 'onJobRetry') {
            if (hooks.onJobRetry == null) {
                return;
            }
            await hooks.onJobRetry(invocation.event);
            return;
        }
        if (invocation.hook === 'onJobFailed') {
            if (hooks.onJobFailed == null) {
                return;
            }
            await hooks.onJobFailed(invocation.event);
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
function sleep(ms, signal) {
    return new Promise((resolve) => {
        if (signal?.aborted) {
            resolve();
            return;
        }
        let timeout = setTimeout(() => {
            cleanup();
            resolve();
        }, ms);
        let onAbort = () => {
            clearTimeout(timeout);
            cleanup();
            resolve();
        };
        function cleanup() {
            signal?.removeEventListener('abort', onAbort);
        }
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}
