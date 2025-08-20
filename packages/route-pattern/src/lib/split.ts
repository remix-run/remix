type Span = [number, number]

export function split(source: string) {
  let result: {
    protocol?: Span
    hostname?: Span
    pathname?: Span
    search?: Span
  } = {}

  // search
  let searchStart = source.indexOf('?')
  if (searchStart !== -1) {
    result.search = [searchStart + 1, source.length]
    source = source.slice(0, searchStart)
  }

  let index = 0
  let solidus = source.indexOf('://')
  if (solidus !== -1) {
    // protocol
    if (solidus !== 0) {
      result.protocol = [0, solidus]
    }
    index = solidus + 3

    // hostname
    let hostnameEnd = source.indexOf('/', index)
    if (hostnameEnd === -1) {
      result.hostname = [index, source.length]
      return result
    }
    result.hostname = [index, hostnameEnd]
    index = hostnameEnd + 1
  }

  // pathname
  if (index !== source.length) {
    result.pathname = [index, source.length]
  }

  return result
}
