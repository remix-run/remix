local jobKey = KEYS[1]
local dueKey = KEYS[2]
local completedKey = KEYS[3]
local failedKey = KEYS[4]
local canceledKey = KEYS[5]
local jobId = ARGV[1]
local workerId = ARGV[2]
local now = ARGV[3]

local values = redis.call('HMGET', jobKey, 'status', 'lockedBy')
if values[1] ~= 'running' or values[2] ~= workerId then
  return 0
end

redis.call(
  'HSET',
  jobKey,
  'status', 'completed',
  'lockedBy', '',
  'lockedUntil', '0',
  'failedAt', '',
  'canceledAt', '',
  'updatedAt', now,
  'completedAt', now
)
redis.call('ZREM', dueKey, jobId)
redis.call('ZADD', completedKey, now, jobId)
redis.call('ZREM', failedKey, jobId)
redis.call('ZREM', canceledKey, jobId)

return 1
