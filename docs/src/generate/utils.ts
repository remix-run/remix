export function getApiNameFromFullName(fullName: string): string {
  return fullName.split('.').slice(-1)[0]
}

export function debug(...args: unknown[]) {
  if (process.env.DEBUG) {
    console.debug('🛠️', ...args)
  }
}

export function info(...args: unknown[]) {
  console.log('ℹ️', ...args)
}

export function warn(...args: unknown[]) {
  console.warn('⚠️', ...args)
}

export function unimplemented(...args: unknown[]) {
  console.error('‼️', 'Unimplemented:', ...args)
}

export function invariant(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? 'Invariant violation')
  }
}
