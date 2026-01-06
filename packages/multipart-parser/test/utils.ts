import {
  ContentDisposition,
  ContentType,
  stringify as stringifyRawHeaders,
} from '@remix-run/headers'

export type PartValue =
  | string
  | {
      filename?: string
      filenameSplat?: string
      mediaType?: string
      content: string | Uint8Array
    }

export function createMultipartMessage(
  boundary: string,
  parts?: { [name: string]: PartValue },
): Uint8Array<ArrayBuffer> {
  let chunks: Uint8Array<ArrayBuffer>[] = []

  function pushString(string: string) {
    chunks.push(new TextEncoder().encode(string))
  }

  function pushLine(line = '') {
    pushString(line + '\r\n')
  }

  if (parts) {
    for (let [name, value] of Object.entries(parts)) {
      pushLine(`--${boundary}`)

      if (typeof value === 'string') {
        let headers = new Headers({
          'Content-Disposition': ContentDisposition.from({
            type: 'form-data',
            name,
          }).toString(),
        })

        pushLine(stringifyRawHeaders(headers))
        pushLine()
        pushLine(value)
      } else {
        let headers = new Headers({
          'Content-Disposition': ContentDisposition.from({
            type: 'form-data',
            name,
            filename: value.filename,
            filenameSplat: value.filenameSplat,
          }).toString(),
        })

        if (value.mediaType) {
          headers.set('Content-Type', ContentType.from({ mediaType: value.mediaType }).toString())
        }

        pushLine(stringifyRawHeaders(headers))
        pushLine()
        if (typeof value.content === 'string') {
          pushLine(value.content)
        } else {
          chunks.push(value.content as Uint8Array<ArrayBuffer>)
          pushLine()
        }
      }
    }
  }

  pushString(`--${boundary}--`)

  return concat(chunks)
}

export function getRandomBytes(size: number): Uint8Array {
  let chunks: Uint8Array<ArrayBuffer>[] = []

  for (let i = 0; i < size; i += 65536) {
    chunks.push(crypto.getRandomValues(new Uint8Array(Math.min(size - i, 65536))))
  }

  return concat(chunks)
}

export function concat(chunks: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  if (chunks.length === 1) return chunks[0]

  let length = 0
  for (let chunk of chunks) {
    length += chunk.length
  }

  let result = new Uint8Array(length)
  let offset = 0

  for (let chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result
}
