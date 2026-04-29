export function isPromiseLike<value>(
  value: value | PromiseLike<value>,
): value is PromiseLike<value> {
  return typeof (value as { then?: unknown }).then === 'function'
}
