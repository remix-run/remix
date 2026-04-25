local jobKey = KEYS[1]
local dueKey = KEYS[2]
local jobId = ARGV[1]
local workerId = ARGV[2]
local now = tonumber(ARGV[3])
local leaseMs = tonumber(ARGV[4])

local values = redis.call('HMGET', jobKey, 'status', 'lockedBy', 'lockedUntil')
local status = values[1]
local lockedBy = values[2]
local lockedUntil = tonumber(values[3] or '0')

if status ~= 'running' or lockedBy ~= workerId or lockedUntil <= now then
  return 0
end

local nextLock = now + leaseMs

redis.call(
  'HSET',
  jobKey,
  'lockedUntil', tostring(nextLock),
  'updatedAt', tostring(now)
)
redis.call('ZADD', dueKey, nextLock, jobId)

return 1
