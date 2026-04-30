local dueKey = KEYS[1]
local jobPrefix = KEYS[2]
local now = tonumber(ARGV[1])
local workerId = ARGV[2]
local leaseMs = tonumber(ARGV[3])
local limit = tonumber(ARGV[4])
local queueCount = tonumber(ARGV[5])

if limit <= 0 then
  return {}
end

local scanLimit = math.max(limit * 8, limit)
local candidates = redis.call('ZRANGEBYSCORE', dueKey, '-inf', now, 'LIMIT', 0, scanLimit)
local claimed = {}

for _, jobId in ipairs(candidates) do
  if #claimed >= limit then
    break
  end

  local jobKey = jobPrefix .. jobId
  local values = redis.call('HMGET', jobKey, 'status', 'queue', 'runAt', 'lockedUntil', 'attempts')
  local status = values[1]
  local queue = values[2]
  local runAt = tonumber(values[3] or '0')
  local lockedUntil = tonumber(values[4] or '0')

  local queueAllowed = false

  for queueIndex = 1, queueCount do
    if queue == ARGV[5 + queueIndex] then
      queueAllowed = true
      break
    end
  end

  if queueAllowed and runAt <= now then
    local claimable = false

    if status == 'queued' then
      claimable = true
    elseif status == 'running' and lockedUntil <= now then
      claimable = true
    end

    if claimable then
      local attempts = tonumber(values[5] or '0') + 1
      local lockedExpiry = now + leaseMs

      redis.call(
        'HSET',
        jobKey,
        'status', 'running',
        'lockedBy', workerId,
        'lockedUntil', tostring(lockedExpiry),
        'attempts', tostring(attempts),
        'updatedAt', tostring(now)
      )
      redis.call('ZADD', dueKey, lockedExpiry, jobId)

      table.insert(claimed, jobId)
    end
  end
end

return claimed
