local sourceJobKey = KEYS[1]
local retryJobKey = KEYS[2]
local dueKey = KEYS[3]
local completedKey = KEYS[4]
local failedKey = KEYS[5]
local canceledKey = KEYS[6]
local sourceJobId = ARGV[1]
local retryJobId = ARGV[2]
local now = ARGV[3]
local runAt = ARGV[4]
local priorityOverride = ARGV[5]
local queueOverride = ARGV[6]

local sourceValues = redis.call(
  'HMGET',
  sourceJobKey,
  'status',
  'name',
  'queue',
  'payload',
  'maxAttempts',
  'priority',
  'retry'
)

if sourceValues[1] ~= 'failed' then
  return ''
end

local sourceName = sourceValues[2]
local sourceQueue = sourceValues[3]
local sourcePayload = sourceValues[4]
local sourceMaxAttempts = sourceValues[5]
local sourcePriority = sourceValues[6]
local sourceRetry = sourceValues[7]

if sourceName == false or sourceQueue == false or sourcePayload == false or sourceMaxAttempts == false or sourcePriority == false or sourceRetry == false then
  return ''
end

local queue = sourceQueue
if queueOverride ~= '' then
  queue = queueOverride
end

local priority = sourcePriority
if priorityOverride ~= '' then
  priority = priorityOverride
end

redis.call(
  'HSET',
  retryJobKey,
  'id', retryJobId,
  'name', sourceName,
  'queue', queue,
  'payload', sourcePayload,
  'status', 'queued',
  'attempts', '0',
  'maxAttempts', sourceMaxAttempts,
  'runAt', runAt,
  'priority', priority,
  'retry', sourceRetry,
  'createdAt', now,
  'updatedAt', now,
  'lastError', '',
  'completedAt', '',
  'failedAt', '',
  'canceledAt', '',
  'lockedBy', '',
  'lockedUntil', '0'
)

redis.call('ZADD', dueKey, runAt, retryJobId)
redis.call('ZREM', completedKey, retryJobId)
redis.call('ZREM', failedKey, retryJobId)
redis.call('ZREM', canceledKey, retryJobId)

return retryJobId
