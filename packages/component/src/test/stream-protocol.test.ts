import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createElement } from '../runtime/create-element.ts'
import { Frame } from '../runtime/frame.ts'
import {
  getFrameId,
  getHydrationId,
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

  it('pairs start markers without an id with their end markers', () => {
    let start = document.createComment(' rmx:h: ')

    expect(isHydrationStart(start)).toBe(true)
    expect(getHydrationId(start)).toBe('')
    expect(isFrameStart(document.createComment(' rmx:f: '))).toBe(true)
  })

  it('only matches the unpadded frame template end marker the server writes', () => {
    expect(isFrameTemplateEnd(document.createComment('rmx:template-end'))).toBe(true)
    expect(isFrameTemplateEnd(document.createComment(' rmx:template-end '))).toBe(false)
  })
})
