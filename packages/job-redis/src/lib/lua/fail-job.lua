local jobKey = KEYS[1]
local dueKey = KEYS[2]
local completedKey = KEYS[3]
local failedKey = KEYS[4]
local canceledKey = KEYS[5]
local jobId = ARGV[1]
local workerId = ARGV[2]
local now = ARGV[3]
local error = ARGV[4]
local terminal = ARGV[5]
local retryAt = ARGV[6]

local values = redis.call('HMGET', jobKey, 'status', 'lockedBy')
if values[1] ~= 'running' or values[2] ~= workerId then
  return 0
end

if terminal == '1' then
  redis.call(
    'HSET',
    jobKey,
    'status', 'failed',
    'lockedBy', '',
    'lockedUntil', '0',
    'completedAt', '',
    'canceledAt', '',
    'updatedAt', now,
    'failedAt', now,
    'lastError', error
  )
  redis.call('ZREM', dueKey, jobId)
  redis.call('ZREM', completedKey, jobId)
  redis.call('ZREM', canceledKey, jobId)
  redis.call('ZADD', failedKey, now, jobId)
else
  redis.call(
    'HSET',
    jobKey,
    'status', 'queued',
    'runAt', retryAt,
    'lockedBy', '',
    'lockedUntil', '0',
    'completedAt', '',
    'failedAt', '',
    'canceledAt', '',
    'updatedAt', now,
    'lastError', error
  )
  redis.call('ZADD', dueKey, retryAt, jobId)
  redis.call('ZREM', completedKey, jobId)
  redis.call('ZREM', failedKey, jobId)
  redis.call('ZREM', canceledKey, jobId)
end

return 1
