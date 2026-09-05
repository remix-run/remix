import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import {
  FRAME_END_MARKER_DATA,
  FRAME_END_MARKER_HTML,
  HYDRATION_END_MARKER_HTML,
  findFrameEndMarker,
  findFrameEndMarkerIndex,
  frameStartMarkerData,
  frameStartMarkerHtml,
  getFrameEndMarker,
  hydrationStartMarkerHtml,
  parseHydrationMarkerId,
} from '../runtime/core/markers.ts'

function parseNodes(html: string): Node[] {
  let container = document.createElement('div')
  container.innerHTML = html
  return Array.from(container.childNodes)
}

describe('marker grammar', () => {
  it('builds byte-exact marker text for the client and the server', () => {
    // The client creates comment nodes from the data strings and the server
    // serializes the html strings; both sides must agree byte-for-byte.
    expect(frameStartMarkerData('x')).toBe(' rmx:f:x ')
    expect(FRAME_END_MARKER_DATA).toBe(' /rmx:f ')
    expect(frameStartMarkerHtml('x')).toBe('<!-- rmx:f:x -->')
    expect(FRAME_END_MARKER_HTML).toBe('<!-- /rmx:f -->')
    expect(hydrationStartMarkerHtml('x')).toBe('<!-- rmx:h:x -->')
    expect(HYDRATION_END_MARKER_HTML).toBe('<!-- /rmx:h -->')

    let comment = document.createComment(frameStartMarkerData('x'))
    let container = document.createElement('div')
    container.append(comment)
    expect(container.innerHTML).toBe(frameStartMarkerHtml('x'))
  })

  it('skips nested regions of the same kind when finding an end marker', () => {
    let nodes = parseNodes(
      '<!-- rmx:f:outer --><!-- rmx:f:inner --><span></span><!-- /rmx:f --><!-- /rmx:f -->',
    )
    let end = findFrameEndMarker(nodes[0] as Comment)
    expect(end).toBe(nodes[4])
    expect(findFrameEndMarkerIndex(nodes, 0)).toBe(4)
  })

  it('reports unclosed regions instead of matching a nested end marker', () => {
    let nodes = parseNodes('<!-- rmx:f:outer --><!-- rmx:f:inner --><!-- /rmx:f -->')
    expect(findFrameEndMarker(nodes[0] as Comment)).toBe(null)
    expect(findFrameEndMarkerIndex(nodes, 0)).toBe(0)
    expect(() => getFrameEndMarker(nodes[0] as Comment)).toThrow('Frame end marker not found')
  })

  it('parses hydration marker ids leniently', () => {
    let [marker] = parseNodes('<!-- rmx:h:abc -->')
    expect(parseHydrationMarkerId(marker)).toBe('abc')
    // An id-less start marker still parses (as the empty string) so callers
    // decide how to treat it.
    let [empty] = parseNodes('<!-- rmx:h: -->')
    expect(parseHydrationMarkerId(empty)).toBe('')
    let [other] = parseNodes('<!-- unrelated -->')
    expect(parseHydrationMarkerId(other)).toBe(undefined)
    expect(parseHydrationMarkerId(null)).toBe(undefined)
  })
})
