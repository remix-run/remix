/**
 * Creates an HTML Response with proper Content-Type header.
 */
export function html(content: string | ReadableStream, init?: ResponseInit): Response {
  if (typeof content === 'string') {
    content = dedentHtml(content)
  }

  return new Response(content, {
    ...init,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      ...init?.headers,
    },
  })
}

/**
 * Removes common leading whitespace from each line of a multi-line string
 * while preserving relative indentation and line breaks.
 */
function dedentHtml(str: string): string {
  let lines = str.split('\n')

  // Remove leading empty lines
  let start = 0
  while (start < lines.length && isEmptyLine(lines[start])) {
    start++
  }

  // Remove trailing empty lines
  let end = lines.length - 1
  while (end >= start && isEmptyLine(lines[end])) {
    end--
  }

  if (start > end) return ''

  // Slice to keep only the content between non-empty boundary lines
  lines = lines.slice(start, end + 1)

  // Find the minimum indentation by checking only non-empty lines
  let minIndent = Infinity
  for (let line of lines) {
    if (!isEmptyLine(line)) {
      // Count leading whitespace without regex
      let indent = 0
      while (indent < line.length && (line[indent] === ' ' || line[indent] === '\t')) {
        indent++
      }
      minIndent = Math.min(minIndent, indent)
    }
  }

  // If all lines are empty or whitespace-only, return as-is
  if (minIndent === Infinity) {
    return lines.join('\n')
  }

  // Remove the common indentation from each line
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    if (minIndent > 0 && line.length > minIndent) {
      let dedented = line.slice(minIndent)
      // If the dedented line is whitespace-only, make it empty
      lines[i] = isEmptyLine(dedented) ? '' : dedented
    } else if (isEmptyLine(line)) {
      // Convert whitespace-only lines to empty lines
      lines[i] = ''
    }
    // Empty lines (length 0) stay empty
  }

  return lines.join('\n')
}

function isEmptyLine(line: string): boolean {
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== ' ' && line[i] !== '\t') return false
  }

  return true
}
