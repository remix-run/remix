import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import {
  getStreamDirective,
  isStreamDirective,
  streamEndDirective,
  streamStartDirective,
  supportsStreamDirectives,
} from '../runtime/stream-directives.ts'

describe('stream directive serialization', () => {
  it('serializes start and end directives', () => {
    expect(streamStartDirective('abc')).toBe('<?start name="abc">')
    expect(streamEndDirective('abc')).toBe('<?end name="abc">')
  })
})

describe('getStreamDirective', () => {
  it('reads native processing instruction directives', () => {
    let start = document.createProcessingInstruction('start', 'name="42"')
    let end = document.createProcessingInstruction('end', 'name="42"')

    expect(getStreamDirective(start)).toEqual({ kind: 'start', id: '42' })
    expect(getStreamDirective(end)).toEqual({ kind: 'end', id: '42' })
  })

  it('reads comment fallback directives', () => {
    let start = document.createComment('?start name="7"')
    let end = document.createComment('?end name="7"')

    expect(getStreamDirective(start)).toEqual({ kind: 'start', id: '7' })
    expect(getStreamDirective(end)).toEqual({ kind: 'end', id: '7' })
  })

  it('ignores unrelated processing instructions', () => {
    let pi = document.createProcessingInstruction('xml-stylesheet', 'href="x.css"')
    expect(getStreamDirective(pi)).toBeNull()
  })

  it('ignores unrelated comments and other nodes', () => {
    expect(getStreamDirective(document.createComment('rmx:f:abc'))).toBeNull()
    expect(getStreamDirective(document.createElement('div'))).toBeNull()
    expect(getStreamDirective(document.createTextNode('start name="x"'))).toBeNull()
    expect(getStreamDirective(null)).toBeNull()
  })

  it('classifies directives via isStreamDirective', () => {
    expect(isStreamDirective(document.createProcessingInstruction('start', 'name="1"'))).toBe(true)
    expect(isStreamDirective(document.createComment('?end name="1"'))).toBe(true)
    expect(isStreamDirective(document.createComment('/rmx:f'))).toBe(false)
  })
})

describe('supportsStreamDirectives', () => {
  it('returns a boolean for the current browser', () => {
    // Records the live browser capability without gating any behavior on it, so
    // both the native and polyfill code paths stay covered regardless of the
    // Chromium version used to run the suite.
    expect(typeof supportsStreamDirectives()).toBe('boolean')
  })

  it('classifies a document that parses directives as comments as unsupported', () => {
    let probe = document.createElement('template')
    probe.innerHTML = streamStartDirective('probe')
    let first = probe.content.firstChild

    // In this environment the parser turns `<?start>` into a comment node; the
    // detector must classify that as unsupported so the polyfill runs.
    if (first && first.nodeType === Node.COMMENT_NODE) {
      expect(supportsStreamDirectives()).toBe(false)
    } else {
      expect(supportsStreamDirectives()).toBe(true)
    }
  })
})
