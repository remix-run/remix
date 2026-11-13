import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createElement } from '../runtime/create-element.ts'
import { Frame } from '../runtime/frame.ts'
import {
  getFrameId,
  isFrameEnd,
  isFrameStart,
  isFrameTemplateEnd,
  isHydrationStart,
} from '../runtime/stream-protocol.ts'
import { renderToStream } from '../server/stream.ts'
import { drain } from './utils.ts'

describe('stream protocol', () => {
  it('reads back the frame markers the server writes', async () => {
    let html = await drain(
      renderToStream(createElement(Frame, { src: '/x' }), {
        resolveFrame: () => '<p>Resolved</p>',
      }),
    )
    let template = document.createElement('template')
    template.innerHTML = html
    let comments = Array.from(template.content.childNodes).filter(
      (node) => node.nodeType === Node.COMMENT_NODE,
    )

    let start = comments.find((node) => isFrameStart(node))
    expect(start && getFrameId(start)).toMatch(/^f/)
    expect(comments.some((node) => isFrameEnd(node))).toBe(true)
  })

  it('recognizes markers created in another window', () => {
    let iframe = document.createElement('iframe')
    document.body.append(iframe)
    try {
      let otherDocument = iframe.contentDocument!
      let start = otherDocument.createComment(' rmx:f:abc ')

      expect(start instanceof Comment).toBe(false)
      expect(isFrameStart(start)).toBe(true)
      expect(getFrameId(start)).toBe('abc')
      expect(isFrameEnd(otherDocument.createComment(' /rmx:f '))).toBe(true)
    } finally {
      iframe.remove()
    }
  })

  it('does not treat start markers without an id as markers', () => {
    expect(isFrameStart(document.createComment(' rmx:f: '))).toBe(false)
    expect(isHydrationStart(document.createComment(' rmx:h: '))).toBe(false)
    expect(() => getFrameId(document.createComment(' rmx:f: '))).toThrow()
  })

  it('trims padding around the frame template end marker', () => {
    expect(isFrameTemplateEnd(document.createComment('rmx:template-end'))).toBe(true)
    expect(isFrameTemplateEnd(document.createComment(' rmx:template-end '))).toBe(true)
  })
})
