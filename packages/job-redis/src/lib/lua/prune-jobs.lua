local jobPrefix = KEYS[1]
local dueKey = KEYS[2]
local completedKey = KEYS[3]
local failedKey = KEYS[4]
local canceledKey = KEYS[5]
local completedBefore = tonumber(ARGV[1])
local failedBefore = tonumber(ARGV[2])
local canceledBefore = tonumber(ARGV[3])
local limit = tonumber(ARGV[4])

if limit == nil or limit <= 0 then
  return {0, 0, 0, 0}
end

local deleted = 0
local completedDeleted = 0
local failedDeleted = 0
local canceledDeleted = 0

local function pruneFromSet(setKey, cutoff, remaining)
  if cutoff == nil or cutoff < 0 or remaining <= 0 then
    return {}
  end

  return redis.call('ZRANGEBYSCORE', setKey, '-inf', cutoff, 'LIMIT', 0, remaining)
end

local function pruneIds(ids, setKey)
  for _, jobId in ipairs(ids) do
    redis.call('DEL', jobPrefix .. jobId)
    redis.call('ZREM', dueKey, jobId)
    redis.call('ZREM', completedKey, jobId)
    redis.call('ZREM', failedKey, jobId)
    redis.call('ZREM', canceledKey, jobId)
  end

  return #ids
end

local completedIds = pruneFromSet(completedKey, completedBefore, limit - deleted)
local completedCount = pruneIds(completedIds, completedKey)
deleted = deleted + completedCount
completedDeleted = completedDeleted + completedCount

local failedIds = pruneFromSet(failedKey, failedBefore, limit - deleted)
local failedCount = pruneIds(failedIds, failedKey)
deleted = deleted + failedCount
failedDeleted = failedDeleted + failedCount

local canceledIds = pruneFromSet(canceledKey, canceledBefore, limit - deleted)
local canceledCount = pruneIds(canceledIds, canceledKey)
deleted = deleted + canceledCount
canceledDeleted = canceledDeleted + canceledCount

return {deleted, completedDeleted, failedDeleted, canceledDeleted}
