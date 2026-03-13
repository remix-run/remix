local failedKey = KEYS[1]
local jobPrefix = KEYS[2]
local limit = tonumber(ARGV[1])
local queueFilter = ARGV[2]

if limit == nil or limit <= 0 then
  return {}
end

local scanLimit = math.max(limit * 8, limit)
local failedIds = redis.call('ZREVRANGE', failedKey, 0, scanLimit - 1)
local selected = {}

for _, jobId in ipairs(failedIds) do
  if #selected >= limit then
    break
  end

  local queue = redis.call('HGET', jobPrefix .. jobId, 'queue')

  if queue ~= false and (queueFilter == '' or queue == queueFilter) then
    table.insert(selected, jobId)
  end
end

return selected
