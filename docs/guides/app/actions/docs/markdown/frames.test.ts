import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { parseMarkdownRoot } from './parser.ts'
import { readMarkdownFrameReferences, splitMarkdownRoot } from './frames.ts'

describe('readMarkdownFrameReferences', () => {
  it('collects every ::frame directive with its source and line number', () => {
    let source = [
      '# Title',
      '',
      'Intro paragraph.',
      '',
      '::frame{src="/examples/04-rendering-ui/button-basic/"}',
      '',
      'Between frames.',
      '',
      '::frame{src="/examples/05-interactivity/basic-counter/"}',
      '',
    ].join('\n')

    let refs = readMarkdownFrameReferences(source)
    assert.equal(refs.length, 2)
    assert.equal(refs[0].src, '/examples/04-rendering-ui/button-basic/')
    assert.equal(refs[0].lineNumber, 5)
    assert.equal(refs[1].src, '/examples/05-interactivity/basic-counter/')
    assert.equal(refs[1].lineNumber, 9)
  })

  it('parses the raw source so line numbers stay aligned with the file', () => {
    // Frontmatter is included in the raw source, so the directive on line 4
    // (after a 3-line frontmatter block) reports line 4, not line 1.
    let source = ['---', 'title: Chapter', '---', '::frame{src="/x/y"}', ''].join('\n')
    let refs = readMarkdownFrameReferences(source)
    assert.equal(refs.length, 1)
    assert.equal(refs[0].lineNumber, 4)
  })

  it('ignores directives that are not ::frame', () => {
    let source = '::callout{src=/x}\n\n::frame{src="/x/y"}\n'
    let refs = readMarkdownFrameReferences(source)
    assert.equal(refs.length, 1)
    assert.equal(refs[0].src, '/x/y')
  })

  it('skips frame directives with no src attribute', () => {
    let refs = readMarkdownFrameReferences('::frame{}\n')
    assert.equal(refs.length, 0)
  })

  it('skips frame directives with a blank src attribute', () => {
    let refs = readMarkdownFrameReferences('::frame{src=" "}\n')
    assert.equal(refs.length, 0)
  })

  it('returns no references for a chapter without frames', () => {
    assert.deepEqual(readMarkdownFrameReferences('# Title\n\nNo frames here.\n'), [])
  })
})

describe('splitMarkdownRoot', () => {
  it('emits markdown segments separated by frame segments', () => {
    let source = ['Intro.', '', '::frame{src="/x/y"}', '', 'Outro.', ''].join('\n')
    let segments = splitMarkdownRoot(parseMarkdownRoot(source))

    assert.equal(segments.length, 3)
    assert.equal(segments[0].type, 'markdown')
    assert.equal(segments[1].type, 'frame')
    if (segments[1].type === 'frame') {
      assert.equal(segments[1].src, '/x/y')
    }
    assert.equal(segments[2].type, 'markdown')
  })

  it('reports the starting line number for each markdown segment', () => {
    let source = ['Line one.', '', '::frame{src="/x"}', '', 'After frame.'].join('\n')
    let segments = splitMarkdownRoot(parseMarkdownRoot(source))

    assert.equal(segments[0].type, 'markdown')
    if (segments[0].type === 'markdown') {
      assert.equal(segments[0].lineNumber, 1)
    }
    assert.equal(segments[2].type, 'markdown')
    if (segments[2].type === 'markdown') {
      assert.equal(segments[2].lineNumber, 5)
    }
  })

  it('does not emit empty markdown segments between adjacent frames', () => {
    let source = '::frame{src="/a"}\n\n::frame{src="/b"}\n'
    let segments = splitMarkdownRoot(parseMarkdownRoot(source))
    assert.equal(segments.length, 2)
    assert.equal(
      segments.every((s) => s.type === 'frame'),
      true,
    )
  })

  it('emits a single markdown segment when there are no frames', () => {
    let segments = splitMarkdownRoot(parseMarkdownRoot('# Title\n\nBody.\n'))
    assert.equal(segments.length, 1)
    assert.equal(segments[0].type, 'markdown')
  })
})
