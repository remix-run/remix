export type FlushKind = 'document' | 'fragment'

const FLUSH_MARKER_PATTERN = /<!--\s*rmx:flush\s+(document|fragment)\s*-->/g

export function appendFlushMarker(html: string, kind: FlushKind): string {
  return `${html}<!-- rmx:flush ${kind} -->`
}

export function stripFlushMarkers(html: string): string {
  FLUSH_MARKER_PATTERN.lastIndex = 0
  return html.replace(FLUSH_MARKER_PATTERN, '')
}

export function findFlushMarker(
  html: string,
  startIndex: number,
): { index: number; endIndex: number; kind: FlushKind } | undefined {
  FLUSH_MARKER_PATTERN.lastIndex = startIndex
  let match = FLUSH_MARKER_PATTERN.exec(html)
  if (!match) return undefined

  return {
    index: match.index,
    endIndex: FLUSH_MARKER_PATTERN.lastIndex,
    kind: match[1] as FlushKind,
  }
}
