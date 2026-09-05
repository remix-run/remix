import { invariant } from '../invariant.ts'

// Single owner of the region comment-marker grammar shared by the server
// renderer and the client engines (reconciler, DOM differ, frame runtime).
// Non-region comments live elsewhere: the `rmx:flush` stream directive
// belongs to core/stream-protocol.ts and the reconciler's `rmx:replace`
// placeholder is never parsed.
//
// Frame regions:     <!-- rmx:f:<id> --> ... <!-- /rmx:f -->
// Hydration regions: <!-- rmx:h:<id> --> ... <!-- /rmx:h -->
//
// Regions of the same kind may nest, so range discovery tracks depth.
const FRAME_START_PREFIX = 'rmx:f:'
const FRAME_END_TEXT = '/rmx:f'
const HYDRATION_START_PREFIX = 'rmx:h:'
const HYDRATION_END_TEXT = '/rmx:h'

// Node.COMMENT_NODE, inlined so calling this module's predicates never
// touches a DOM global (server code imports this module).
const COMMENT_NODE = 8

export function frameStartMarkerData(frameId: string): string {
  return ` ${FRAME_START_PREFIX}${frameId} `
}

export const FRAME_END_MARKER_DATA = ` ${FRAME_END_TEXT} `

export function frameStartMarkerHtml(frameId: string): string {
  return `<!--${frameStartMarkerData(frameId)}-->`
}

export const FRAME_END_MARKER_HTML = `<!--${FRAME_END_MARKER_DATA}-->`

export function hydrationStartMarkerHtml(instanceId: string): string {
  return `<!-- ${HYDRATION_START_PREFIX}${instanceId} -->`
}

export const HYDRATION_END_MARKER_HTML = `<!-- ${HYDRATION_END_TEXT} -->`

export function isCommentNode(node: Node | null | undefined): node is Comment {
  return node?.nodeType === COMMENT_NODE
}

export function isFrameStartMarker(node: Node | null | undefined): node is Comment {
  return isCommentNode(node) && node.data.trim().startsWith(FRAME_START_PREFIX)
}

export function isFrameEndMarker(node: Node | null | undefined): node is Comment {
  return isCommentNode(node) && node.data.trim() === FRAME_END_TEXT
}

export function isHydrationStartMarker(node: Node | null | undefined): node is Comment {
  return isCommentNode(node) && node.data.trim().startsWith(HYDRATION_START_PREFIX)
}

export function isHydrationEndMarker(node: Node | null | undefined): node is Comment {
  return isCommentNode(node) && node.data.trim() === HYDRATION_END_TEXT
}

export function getFrameMarkerId(marker: Comment): string {
  let trimmed = marker.data.trim()
  invariant(trimmed.startsWith(FRAME_START_PREFIX), 'Invalid frame start marker')
  return trimmed.slice(FRAME_START_PREFIX.length)
}

export function getHydrationMarkerId(marker: Comment): string {
  let trimmed = marker.data.trim()
  invariant(trimmed.startsWith(HYDRATION_START_PREFIX), 'Invalid hydration start marker')
  return trimmed.slice(HYDRATION_START_PREFIX.length)
}

/**
 * Lenient variant of `getHydrationMarkerId` for nodes that may not be
 * hydration start markers at all.
 *
 * @param node Node to inspect.
 * @returns The id text (possibly empty) when the node is a hydration start marker, `undefined` otherwise.
 */
export function parseHydrationMarkerId(node: Node | null | undefined): string | undefined {
  if (!isCommentNode(node)) return undefined
  let trimmed = node.data.trim()
  if (!trimmed.startsWith(HYDRATION_START_PREFIX)) return undefined
  return trimmed.slice(HYDRATION_START_PREFIX.length)
}

/**
 * Finds the end marker that closes a frame region, tracking nested regions.
 *
 * @param start Frame start marker to search from.
 * @returns The matching end marker, or `null` when the sibling list ends before the region closes.
 */
export function findFrameEndMarker(start: Comment): Comment | null {
  return findEndMarker(start, isFrameStartMarker, isFrameEndMarker)
}

/**
 * Finds the end marker that closes a hydration region, tracking nested regions.
 *
 * @param start Hydration start marker to search from.
 * @returns The matching end marker, or `null` when the sibling list ends before the region closes.
 */
export function findHydrationEndMarker(start: Comment): Comment | null {
  return findEndMarker(start, isHydrationStartMarker, isHydrationEndMarker)
}

/**
 * Throwing variant of `findFrameEndMarker` for regions that must be closed.
 *
 * @param start Frame start marker to search from.
 * @returns The matching end marker.
 */
export function getFrameEndMarker(start: Comment): Comment {
  let end = findFrameEndMarker(start)
  if (!end) throw new Error('Frame end marker not found')
  return end
}

/**
 * Throwing variant of `findHydrationEndMarker` for regions that must be closed.
 *
 * @param start Hydration start marker to search from.
 * @returns The matching end marker.
 */
export function getHydrationEndMarker(start: Comment): Comment {
  let end = findHydrationEndMarker(start)
  if (!end) throw new Error('Hydration end marker not found')
  return end
}

/**
 * Index-based variant of `findFrameEndMarker` over a node snapshot.
 *
 * @param nodes Sibling node snapshot to search.
 * @param startIndex Index of the frame start marker in `nodes`.
 * @returns The index of the matching end marker, or `startIndex` when the region does not close within the snapshot.
 */
export function findFrameEndMarkerIndex(nodes: readonly Node[], startIndex: number): number {
  return findEndMarkerIndex(nodes, startIndex, isFrameStartMarker, isFrameEndMarker)
}

/**
 * Index-based variant of `findHydrationEndMarker` over a node snapshot.
 *
 * @param nodes Sibling node snapshot to search.
 * @param startIndex Index of the hydration start marker in `nodes`.
 * @returns The index of the matching end marker, or `startIndex` when the region does not close within the snapshot.
 */
export function findHydrationEndMarkerIndex(nodes: readonly Node[], startIndex: number): number {
  return findEndMarkerIndex(nodes, startIndex, isHydrationStartMarker, isHydrationEndMarker)
}

function findEndMarker(
  start: Comment,
  isStart: (node: Node) => boolean,
  isEnd: (node: Node) => boolean,
): Comment | null {
  let node: Node | null = start.nextSibling
  let depth = 1

  while (node) {
    if (isStart(node)) depth++
    else if (isEnd(node)) {
      depth--
      if (depth === 0) return node as Comment
    }
    node = node.nextSibling
  }

  return null
}

function findEndMarkerIndex(
  nodes: readonly Node[],
  startIndex: number,
  isStart: (node: Node) => boolean,
  isEnd: (node: Node) => boolean,
): number {
  let depth = 1

  for (let index = startIndex + 1; index < nodes.length; index++) {
    let node = nodes[index]
    if (isStart(node)) depth++
    else if (isEnd(node)) {
      depth--
      if (depth === 0) return index
    }
  }

  return startIndex
}
