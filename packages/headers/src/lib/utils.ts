export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function isIterable<T>(value: any): value is Iterable<T> {
  return value != null && typeof value[Symbol.iterator] === 'function'
}

export function isValidDate(date: unknown): boolean {
  return date instanceof Date && !isNaN(date.getTime())
}

export function quoteEtag(tag: string): string {
  return tag === '*' ? tag : /^(W\/)?".*"$/.test(tag) ? tag : `"${tag}"`
}
