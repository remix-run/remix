export function parseParams(
  input: string,
  delimiter: ';' | ',' = ';',
): [string, string | undefined][] {
  let parser =
    delimiter === ';' ? /(?:^|;)\s*([^=;\s]+)(\s*=\s*)?/g : /(?:^|,)\s*([^=,\s]+)(\s*=\s*)?/g

  let params: [string, string | undefined][] = []

  let match
  while ((match = parser.exec(input)) !== null) {
    let key = match[1].trim()

    let value: string | undefined
    if (match[2]) {
      let position = parser.lastIndex
      if (input[position] === '"') {
        value = ''
        position++
        // An unterminated quote consumes the rest of the input as its value.
        while (position < input.length) {
          let char = input[position++]
          if (char === '"') break
          if (char === '\\' && position < input.length) {
            char = input[position++]
          }
          value += char
        }
      } else {
        let end = position
        while (end < input.length && input[end] !== delimiter) {
          if (input[end] === '\\' && end + 1 < input.length) end++
          end++
        }
        value = input.slice(position, end).replace(/\\(.)/g, '$1').trim()
        position = end
      }
      parser.lastIndex = position
    }

    params.push([key, value])
  }

  return params
}

export function quote(value: string): string {
  if (value.includes('"') || value.includes(';') || value.includes(' ')) {
    return `"${value.replace(/"/g, '\\"')}"`
  }
  return value
}
