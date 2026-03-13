local jobKey = KEYS[1]
local dueKey = KEYS[2]
local dedupeKey = KEYS[3]
local dedupeTtlMs = tonumber(ARGV[11])

if dedupeKey ~= '' and dedupeTtlMs ~= nil and dedupeTtlMs > 0 then
  local existing = redis.call('GET', dedupeKey)
  if existing then
    return {'deduped', existing}
  end
end

redis.call(
  'HSET',
  jobKey,
  'id', ARGV[1],
  'name', ARGV[2],
  'queue', ARGV[3],
  'payload', ARGV[4],
  'status', 'queued',
  'attempts', '0',
  'maxAttempts', ARGV[5],
  'runAt', ARGV[6],
  'priority', ARGV[7],
  'retry', ARGV[8],
  'createdAt', ARGV[9],
  'updatedAt', ARGV[10],
  'lastError', '',
  'completedAt', '',
  'failedAt', '',
  'canceledAt', '',
  'lockedBy', '',
  'lockedUntil', '0'
)

redis.call('ZADD', dueKey, ARGV[6], ARGV[1])

if dedupeKey ~= '' and dedupeTtlMs ~= nil and dedupeTtlMs > 0 then
  redis.call('SET', dedupeKey, ARGV[1], 'PX', ARGV[11], 'NX')
end

return {'enqueued', ARGV[1]}
