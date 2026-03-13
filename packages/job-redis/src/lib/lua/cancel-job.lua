local jobKey = KEYS[1]
local dueKey = KEYS[2]
local completedKey = KEYS[3]
local failedKey = KEYS[4]
local canceledKey = KEYS[5]
local jobId = ARGV[1]
local now = ARGV[2]

local status = redis.call('HGET', jobKey, 'status')
if status ~= 'queued' then
  return 0
end

redis.call(
  'HSET',
  jobKey,
  'status', 'canceled',
  'canceledAt', now,
  'completedAt', '',
  'failedAt', '',
  'lockedBy', '',
  'lockedUntil', '0',
  'updatedAt', now
)
redis.call('ZREM', dueKey, jobId)
redis.call('ZREM', completedKey, jobId)
redis.call('ZREM', failedKey, jobId)
redis.call('ZADD', canceledKey, now, jobId)

return 1
