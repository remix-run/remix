const whitespace = /[\t\n\f\r ]/

// Tokenize URLs and descriptors using the HTML source-set parser's states. Commas inside
// a URL are significant; only trailing URL commas or descriptor-state commas end a candidate.
export function normalizeSrcset(input: string, baseURL: string): string {
  let position = 0
  let candidates: string[] = []
  while (position < input.length) {
    while (position < input.length && (whitespace.test(input[position]) || input[position] === ','))
      position++
    let start = position
    while (position < input.length && !whitespace.test(input[position])) position++
    let url = input.slice(start, position)
    if (!url) break
    let descriptors: string[] = []
    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '')
    } else {
      let descriptor = ''
      let state: 'descriptor' | 'parentheses' | 'after' = 'descriptor'
      while (position < input.length) {
        let char = input[position++]
        if (state === 'parentheses') {
          descriptor += char
          if (char === ')') state = 'descriptor'
        } else if (char === ',') {
          if (descriptor) descriptors.push(descriptor)
          descriptor = ''
          break
        } else if (whitespace.test(char)) {
          if (descriptor) descriptors.push(descriptor)
          descriptor = ''
          state = 'after'
        } else {
          descriptor += char
          state = char === '(' ? 'parentheses' : 'descriptor'
        }
      }
      if (descriptor) descriptors.push(descriptor)
    }
    let width: number | undefined
    let density: number | undefined
    let height: number | undefined
    let invalid = false
    for (let descriptor of descriptors) {
      let value = descriptor.slice(0, -1)
      let suffix = descriptor.at(-1)
      if (
        suffix === 'w' &&
        /^\d+$/.test(value) &&
        Number(value) > 0 &&
        Number.isFinite(Number(value)) &&
        width === undefined &&
        density === undefined
      ) {
        width = Number(value)
      } else if (
        suffix === 'x' &&
        /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) &&
        Number(value) >= 0 &&
        Number.isFinite(Number(value)) &&
        density === undefined &&
        width === undefined &&
        height === undefined
      ) {
        density = Number(value)
      } else if (
        suffix === 'h' &&
        /^\d+$/.test(value) &&
        Number(value) > 0 &&
        Number.isFinite(Number(value)) &&
        height === undefined &&
        density === undefined
      ) {
        height = Number(value)
      } else invalid = true
    }
    if (invalid || (height !== undefined && width === undefined)) continue
    try {
      let resolved = new URL(url, baseURL)
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue
      candidates.push([resolved.href, ...descriptors].join(' '))
    } catch {
      // Invalid URLs do not become speculative operations.
    }
  }
  return candidates.join(', ')
}
