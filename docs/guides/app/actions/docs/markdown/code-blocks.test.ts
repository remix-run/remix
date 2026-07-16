import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  addLineNumbers,
  looksLikeMeta,
  readCodeBlockInfo,
  readCodeBlockMetaParameter,
  readHighlightedLines,
} from './code-blocks.ts'

describe('looksLikeMeta', () => {
  it('treats bracket-opened info strings as meta, not languages', () => {
    assert.equal(looksLikeMeta('[1-3]'), true)
    assert.equal(looksLikeMeta('{1,2}'), true)
  })

  it('treats key=value info strings as meta', () => {
    assert.equal(looksLikeMeta('filename=app.ts'), true)
    assert.equal(looksLikeMeta('highlight=2-4'), true)
  })

  it('treats plain language names as languages', () => {
    assert.equal(looksLikeMeta('ts'), false)
    assert.equal(looksLikeMeta('tsx'), false)
    assert.equal(looksLikeMeta('js'), false)
  })
})

describe('readCodeBlockMetaParameter', () => {
  it('reads a bare unquoted value', () => {
    assert.equal(
      readCodeBlockMetaParameter('filename=app/router.ts title=other', 'filename'),
      'app/router.ts',
    )
  })

  it('reads a double-quoted value', () => {
    assert.equal(
      readCodeBlockMetaParameter('filename="app/router.ts" lines=[1-3]', 'filename'),
      'app/router.ts',
    )
  })

  it('reads a single-quoted value', () => {
    assert.equal(
      readCodeBlockMetaParameter("filename='app/router.ts'", 'filename'),
      'app/router.ts',
    )
  })

  it('returns undefined when the parameter is absent', () => {
    assert.equal(readCodeBlockMetaParameter('lines=[1-3]', 'filename'), undefined)
  })

  it('does not match a parameter name that is a prefix of another', () => {
    // `title` should not match `filename`; `lines` should not match `highlight`
    assert.equal(readCodeBlockMetaParameter('highlight=1-3', 'lines'), undefined)
  })

  it('matches the parameter at the start of the meta string', () => {
    assert.equal(readCodeBlockMetaParameter('filename=app.ts', 'filename'), 'app.ts')
  })
})

describe('readHighlightedLines', () => {
  it('collects a bare brace group', () => {
    assert.deepEqual(
      [...readHighlightedLines('{1,3,5}')].sort((a, b) => a - b),
      [1, 3, 5],
    )
  })

  it('collects a bare bracket group', () => {
    assert.deepEqual(
      [...readHighlightedLines('[1-3]')].sort((a, b) => a - b),
      [1, 2, 3],
    )
  })

  it('collects a highlight= parameter', () => {
    assert.deepEqual(
      [...readHighlightedLines('highlight=2-4')].sort((a, b) => a - b),
      [2, 3, 4],
    )
  })

  it('collects a lines= parameter', () => {
    assert.deepEqual(
      [...readHighlightedLines('lines=1,2,5')].sort((a, b) => a - b),
      [1, 2, 5],
    )
  })

  it('combines every supported form in one meta string', () => {
    let lines = [...readHighlightedLines('{1} [2-3] highlight=4 lines=6,7')].sort((a, b) => a - b)
    assert.deepEqual(lines, [1, 2, 3, 4, 6, 7])
  })

  it('ignores zero and negative line numbers', () => {
    assert.deepEqual(
      [...readHighlightedLines('[0,1,-2]')].sort((a, b) => a - b),
      [1],
    )
  })

  it('ignores an inverted range', () => {
    assert.deepEqual([...readHighlightedLines('[5-2]')], [])
  })

  it('returns an empty set for empty meta', () => {
    assert.deepEqual([...readHighlightedLines('')], [])
  })
})

describe('addLineNumbers', () => {
  it('strips surrounding brackets or braces before parsing', () => {
    let lines = new Set<number>()
    addLineNumbers(lines, '[1-2]')
    assert.deepEqual(
      [...lines].sort((a, b) => a - b),
      [1, 2],
    )
  })

  it('splits a comma-separated spec into individual lines and ranges', () => {
    let lines = new Set<number>()
    addLineNumbers(lines, '1,3-5,8')
    assert.deepEqual(
      [...lines].sort((a, b) => a - b),
      [1, 3, 4, 5, 8],
    )
  })

  it('ignores blank segments', () => {
    let lines = new Set<number>()
    addLineNumbers(lines, '1,,2')
    assert.deepEqual(
      [...lines].sort((a, b) => a - b),
      [1, 2],
    )
  })

  it('ignores undefined and whitespace-only specs', () => {
    let lines = new Set<number>()
    addLineNumbers(lines, undefined)
    addLineNumbers(lines, '   ')
    assert.deepEqual([...lines], [])
  })
})

describe('readCodeBlockInfo', () => {
  it('defaults a missing language to plaintext', () => {
    assert.equal(readCodeBlockInfo(undefined, undefined).language, 'plaintext')
  })

  it('defaults an empty language to plaintext', () => {
    assert.equal(readCodeBlockInfo('', '').language, 'plaintext')
  })

  it('keeps a real language name', () => {
    assert.equal(readCodeBlockInfo('ts', 'filename=app.ts').language, 'ts')
  })

  it('reclaims a bracket info string as meta when no language is given', () => {
    // remark assigns the info string to `language` when there is no meta; the reader
    // should detect that `[1-3]` is meta and move it over so the lines get parsed.
    let info = readCodeBlockInfo('[1-3]', undefined)
    assert.equal(info.language, 'plaintext')
    assert.deepEqual(
      [...info.highlightedLines].sort((a, b) => a - b),
      [1, 2, 3],
    )
  })

  it('reads the filename parameter', () => {
    assert.equal(readCodeBlockInfo('tsx', 'filename=app/router.ts').filename, 'app/router.ts')
  })

  it('falls back to the title parameter when filename is absent', () => {
    assert.equal(readCodeBlockInfo('tsx', 'title=router.ts').filename, 'router.ts')
  })

  it('omits filename when neither filename nor title is present', () => {
    assert.equal('filename' in readCodeBlockInfo('ts', 'lines=[1-3]'), false)
  })

  it('parses highlighted lines alongside a filename', () => {
    let info = readCodeBlockInfo('tsx', 'filename=app.ts lines=[2-4]')
    assert.equal(info.filename, 'app.ts')
    assert.deepEqual(
      [...info.highlightedLines].sort((a, b) => a - b),
      [2, 3, 4],
    )
  })
})
