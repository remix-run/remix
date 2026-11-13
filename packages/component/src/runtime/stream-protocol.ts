import { invariant } from './invariant.ts'

export type FlushKind = 'document' | 'fragment'

// Comment markers the server writes around frames and client entries, and the client creates and
// reads back. Readers trim the comment data, so the padding spaces are cosmetic.
const FRAME_START_PREFIX = 'rmx:f:'
const FRAME_END = '/rmx:f'
const HYDRATION_START_PREFIX = 'rmx:h:'
const HYDRATION_END = '/rmx:h'

export const FRAME_END_MARKER = ` ${FRAME_END} `
export const HYDRATION_END_MARKER = ` ${HYDRATION_END} `
export const FRAME_TEMPLATE_END_MARKER = 'rmx:template-end'

export function createFrameStartMarker(id: string): string {
  return ` ${FRAME_START_PREFIX}${id} `
}

export function createHydrationStartMarker(id: string): string {
  return ` ${HYDRATION_START_PREFIX}${id} `
}

export function isCommentNode(node: Node | null | undefined): node is Comment {
  return node?.nodeType === Node.COMMENT_NODE
}

export function isFrameStart(node: Node | null | undefined): node is Comment {
  return isStartMarker(node, FRAME_START_PREFIX)
}

export function isFrameEnd(node: Node | null | undefined): node is Comment {
  return isCommentNode(node) && node.data.trim() === FRAME_END
}

export function isHydrationStart(node: Node | null | undefined): node is Comment {
  return isStartMarker(node, HYDRATION_START_PREFIX)
}

export function isHydrationEnd(node: Node | null | undefined): node is Comment {
  return isCommentNode(node) && node.data.trim() === HYDRATION_END
}

export function isFrameTemplateEnd(node: Node | null | undefined): node is Comment {
  return isCommentNode(node) && node.data.trim() === FRAME_TEMPLATE_END_MARKER
}

export function getFrameId(start: Comment): string {
  invariant(isFrameStart(start), 'Invalid frame start marker')
  return start.data.trim().slice(FRAME_START_PREFIX.length)
}

export function getHydrationId(start: Comment): string {
  invariant(isHydrationStart(start), 'Invalid hydration start marker')
  return start.data.trim().slice(HYDRATION_START_PREFIX.length)
}

function isStartMarker(node: Node | null | undefined, prefix: string): node is Comment {
  if (!isCommentNode(node)) return false
  let data = node.data.trim()
  return data.length > prefix.length && data.startsWith(prefix)
}

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
