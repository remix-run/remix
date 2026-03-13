import { CANCEL_JOB_SCRIPT, CLAIM_DUE_JOBS_SCRIPT, COMPLETE_JOB_SCRIPT, ENQUEUE_JOB_SCRIPT, FAIL_JOB_SCRIPT, HEARTBEAT_JOB_SCRIPT, LIST_FAILED_JOBS_SCRIPT, PRUNE_JOBS_SCRIPT, RETRY_FAILED_JOB_SCRIPT, } from "./generated-lua.js";
let DEFAULT_PREFIX = 'job:';
let DEFAULT_RETRY = {
    maxAttempts: 5,
    strategy: 'exponential',
    baseDelayMs: 1000,
    maxDelayMs: 300000,
    jitter: 'full',
};
/**
 * Creates a Redis-backed `JobStorage` implementation.
 *
 * @param redis Redis client or compatible adapter used to execute commands
 * @param options Optional storage configuration
 * @returns A `JobStorage` that persists jobs in Redis
 */
export function createRedisJobStorage(redis, options = {}) {
    let keys = createKeys(normalizePrefix(options.prefix));
    return {
        async enqueue(input, _options) {
            let jobId = crypto.randomUUID();
            let dedupeTtlMs = input.dedupeKey != null && input.dedupeTtlMs != null ? input.dedupeTtlMs : 0;
            let dedupeKey = input.dedupeKey != null && dedupeTtlMs > 0 ? keys.dedupe(input.dedupeKey) : '';
            let result = await evalScript(redis, ENQUEUE_JOB_SCRIPT, [keys.job(jobId), keys.jobsDue, dedupeKey], [
                jobId,
                input.name,
                input.queue,
                JSON.stringify(input.payload),
                String(input.retry.maxAttempts),
                String(input.runAt),
                String(input.priority),
                JSON.stringify(input.retry),
                String(input.createdAt),
                String(input.createdAt),
                String(dedupeTtlMs),
            ]);
            let [status, value] = readTuple(result);
            if (status === 'deduped') {
                return {
                    jobId: value,
                    deduped: true,
                };
            }
            if (status === 'enqueued') {
                return {
                    jobId: value,
                    deduped: false,
                };
            }
            throw new Error('Invalid enqueue response from redis storage');
        },
        async get(jobId) {
            let hash = await hgetall(redis, keys.job(jobId));
            if (Object.keys(hash).length === 0) {
                return null;
            }
            return toJobRecord(hash);
        },
        async cancel(jobId, _options) {
            let now = Date.now();
            let result = await evalScript(redis, CANCEL_JOB_SCRIPT, [keys.job(jobId), keys.jobsDue, keys.jobsCompleted, keys.jobsFailed, keys.jobsCanceled], [jobId, String(now)]);
            return readNumber(result) === 1;
        },
        async listFailedJobs(input) {
            let result = await evalScript(redis, LIST_FAILED_JOBS_SCRIPT, [keys.jobsFailed, keys.jobPrefix], [String(input.limit ?? 50), input.queue ?? '']);
            let jobIds = readArray(result);
            let jobs = [];
            for (let jobId of jobIds) {
                let job = await getJobRecord(redis, keys, jobId);
                if (job != null) {
                    jobs.push(job);
                }
            }
            return jobs;
        },
        async retryFailedJob(input, _options) {
            let retriedJobId = crypto.randomUUID();
            let now = Date.now();
            let result = await evalScript(redis, RETRY_FAILED_JOB_SCRIPT, [
                keys.job(input.jobId),
                keys.job(retriedJobId),
                keys.jobsDue,
                keys.jobsCompleted,
                keys.jobsFailed,
                keys.jobsCanceled,
            ], [
                input.jobId,
                retriedJobId,
                String(now),
                String(input.runAt ?? now),
                input.priority == null ? '' : String(input.priority),
                input.queue ?? '',
            ]);
            let retried = asString(result);
            if (retried === '') {
                return null;
            }
            return {
                jobId: retried,
            };
        },
        async prune(input, _options) {
            let result = await evalScript(redis, PRUNE_JOBS_SCRIPT, [keys.jobPrefix, keys.jobsDue, keys.jobsCompleted, keys.jobsFailed, keys.jobsCanceled], [
                input.completedBefore == null ? '-1' : String(input.completedBefore),
                input.failedBefore == null ? '-1' : String(input.failedBefore),
                input.canceledBefore == null ? '-1' : String(input.canceledBefore),
                String(input.limit),
            ]);
            return readPruneJobsResult(result);
        },
        async claimDueJobs(input) {
            if (input.queues.length === 0 || input.limit <= 0) {
                return [];
            }
            let queueCount = String(input.queues.length);
            let result = await evalScript(redis, CLAIM_DUE_JOBS_SCRIPT, [keys.jobsDue, keys.jobPrefix], [
                String(input.now),
                input.workerId,
                String(input.leaseMs),
                String(input.limit),
                queueCount,
                ...input.queues,
            ]);
            let jobIds = readArray(result);
            let jobs = [];
            for (let jobId of jobIds) {
                let job = await getJobRecord(redis, keys, jobId);
                if (job != null) {
                    jobs.push(job);
                }
            }
            return jobs;
        },
        async heartbeat(input) {
            let result = await evalScript(redis, HEARTBEAT_JOB_SCRIPT, [keys.job(input.jobId), keys.jobsDue], [
                input.jobId,
                input.workerId,
                String(input.now),
                String(input.leaseMs),
            ]);
            return readNumber(result) === 1;
        },
        async complete(input) {
            await evalScript(redis, COMPLETE_JOB_SCRIPT, [keys.job(input.jobId), keys.jobsDue, keys.jobsCompleted, keys.jobsFailed, keys.jobsCanceled], [input.jobId, input.workerId, String(input.now)]);
        },
        async fail(input) {
            await evalScript(redis, FAIL_JOB_SCRIPT, [keys.job(input.jobId), keys.jobsDue, keys.jobsCompleted, keys.jobsFailed, keys.jobsCanceled], [
                input.jobId,
                input.workerId,
                String(input.now),
                input.error,
                input.terminal ? '1' : '0',
                String(input.retryAt ?? input.now),
            ]);
        },
    };
}
function createKeys(prefix) {
    return {
        jobsDue: `${prefix}jobs:due`,
        jobsCompleted: `${prefix}jobs:completed`,
        jobsFailed: `${prefix}jobs:failed`,
        jobsCanceled: `${prefix}jobs:canceled`,
        jobPrefix: `${prefix}job:`,
        job(id) {
            return `${prefix}job:${id}`;
        },
        dedupe(key) {
            return `${prefix}dedupe:${key}`;
        },
    };
}
async function getJobRecord(redis, keys, jobId) {
    let hash = await hgetall(redis, keys.job(jobId));
    if (Object.keys(hash).length === 0) {
        return null;
    }
    return toJobRecord(hash);
}
async function hgetall(redis, key) {
    let result = await redis.sendCommand(['HGETALL', key]);
    return toHashRecord(result);
}
async function evalScript(redis, script, keys, args) {
    return redis.sendCommand(['EVAL', script, String(keys.length), ...keys, ...args]);
}
function toJobRecord(hash) {
    return {
        id: readRequiredString(hash.id, 'id'),
        name: readRequiredString(hash.name, 'name'),
        queue: readRequiredString(hash.queue, 'queue'),
        payload: parseJson(hash.payload, {}),
        status: readJobStatus(hash.status),
        attempts: readNumber(hash.attempts, 0),
        maxAttempts: readNumber(hash.maxAttempts, 1),
        runAt: readNumber(hash.runAt, 0),
        priority: readNumber(hash.priority, 0),
        retry: parseRetry(hash.retry),
        createdAt: readNumber(hash.createdAt, 0),
        updatedAt: readNumber(hash.updatedAt, 0),
        lastError: hash.lastError === '' || hash.lastError == null ? undefined : hash.lastError,
        completedAt: readOptionalNumber(hash.completedAt),
        failedAt: readOptionalNumber(hash.failedAt),
        canceledAt: readOptionalNumber(hash.canceledAt),
    };
}
function readJobStatus(value) {
    if (value === 'queued' ||
        value === 'running' ||
        value === 'completed' ||
        value === 'failed' ||
        value === 'canceled') {
        return value;
    }
    throw new Error(`Invalid job status "${String(value)}"`);
}
function parseRetry(value) {
    let parsed = parseJson(value, null);
    if (parsed == null || typeof parsed !== 'object') {
        return DEFAULT_RETRY;
    }
    let retry = parsed;
    return {
        maxAttempts: readNumber(retry.maxAttempts, DEFAULT_RETRY.maxAttempts),
        strategy: retry.strategy === 'fixed' ? 'fixed' : 'exponential',
        baseDelayMs: readNumber(retry.baseDelayMs, DEFAULT_RETRY.baseDelayMs),
        maxDelayMs: readNumber(retry.maxDelayMs, DEFAULT_RETRY.maxDelayMs),
        jitter: retry.jitter === 'none' ? 'none' : 'full',
    };
}
function parseJson(value, fallback) {
    if (typeof value !== 'string' || value === '') {
        return fallback;
    }
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
}
function readRequiredString(value, name) {
    if (typeof value !== 'string' || value === '') {
        throw new Error(`Missing redis field "${name}"`);
    }
    return value;
}
function readNumber(value, fallback = 0) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.floor(value);
    }
    if (typeof value === 'string' && value !== '') {
        let parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return Math.floor(parsed);
        }
    }
    return fallback;
}
function readOptionalNumber(value) {
    if (value == null || value === '') {
        return undefined;
    }
    return readNumber(value, 0);
}
function readPruneJobsResult(value) {
    let values = readArray(value);
    return {
        deleted: readNumber(values[0], 0),
        completed: readNumber(values[1], 0),
        failed: readNumber(values[2], 0),
        canceled: readNumber(values[3], 0),
    };
}
function readTuple(value) {
    let values = readArray(value);
    if (values.length < 2) {
        throw new Error('Expected redis response tuple');
    }
    return [values[0], values[1]];
}
function readArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map((entry) => asString(entry));
}
function toHashRecord(value) {
    if (value == null) {
        return {};
    }
    if (Array.isArray(value)) {
        let record = {};
        let index = 0;
        while (index < value.length - 1) {
            let key = asString(value[index]);
            let entry = asString(value[index + 1]);
            record[key] = entry;
            index += 2;
        }
        return record;
    }
    if (typeof value === 'object') {
        let record = {};
        for (let [key, entry] of Object.entries(value)) {
            record[key] = asString(entry);
        }
        return record;
    }
    return {};
}
function asString(value) {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
        return String(value);
    }
    if (value instanceof Uint8Array) {
        return new TextDecoder().decode(value);
    }
    return '';
}
function normalizePrefix(value) {
    if (value == null || value === '') {
        return DEFAULT_PREFIX;
    }
    if (/\s/.test(value)) {
        throw new Error('Redis prefix cannot contain whitespace');
    }
    return value;
}
