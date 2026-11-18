export function shouldEnablePrefetching(): boolean {
  if (!('connection' in navigator)) return true
  let connection = navigator.connection
  if (typeof connection !== 'object' || connection === null) return true
  if ('saveData' in connection && connection.saveData === true) return false
  if ('effectiveType' in connection) {
    return connection.effectiveType !== 'slow-2g' && connection.effectiveType !== '2g'
  }
  return true
}
