type Span = [number, number]

export function split(source: string) {
  let result: {
    protocol?: Span
    hostname?: Span
    port?: Span
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

    // hostname + port
    let hostEnd = source.indexOf('/', index)
    if (hostEnd === -1) hostEnd = source.length

    // detect port (numeric) at end of host segment
    let host = source.slice(index, hostEnd)
    let colonIndex = host.lastIndexOf(':')
    if (colonIndex !== -1) {
      let afterColon = host.slice(colonIndex + 1)
      if (/^[0-9]+$/.test(afterColon)) {
        // hostname up to colon, port after colon
        result.hostname = [index, index + colonIndex]
        result.port = [index + colonIndex + 1, hostEnd]
      } else {
        result.hostname = [index, hostEnd]
      }
    } else {
      result.hostname = [index, hostEnd]
    }
    index = hostEnd === source.length ? hostEnd : hostEnd + 1
  }

  // pathname
  if (index !== source.length) {
    result.pathname = [index, source.length]
  }

  return result
}
