import * as assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import { detectContentType } from './detect-content-type.ts'
import { detectMimeType } from './detect-mime-type.ts'
import { isCompressibleMimeType } from './is-compressible-mime-type.ts'
import { mimeTypeToContentType } from './mime-type-to-content-type.ts'
import { defineMimeType, resetMimeTypes } from './define-mime-type.ts'

describe('defineMimeType()', () => {
  beforeEach(() => {
    resetMimeTypes()
  })

  describe('custom mime types', () => {
    it('registers a new extension', () => {
      defineMimeType({
        extensions: 'customext1',
        mimeType: 'text/custom1',
      })

      assert.equal(detectMimeType('customext1'), 'text/custom1')
    })

    it('overrides a builtin extension', () => {
      assert.equal(detectMimeType('ts'), 'video/mp2t')

      defineMimeType({
        extensions: 'ts',
        mimeType: 'text/typescript',
      })

      assert.equal(detectMimeType('ts'), 'text/typescript')
    })

    it('normalizes extension to lowercase', () => {
      defineMimeType({
        extensions: 'MDX',
        mimeType: 'text/mdx',
      })

      assert.equal(detectMimeType('mdx'), 'text/mdx')
      assert.equal(detectMimeType('MDX'), 'text/mdx')
    })

    it('handles extension with leading dot', () => {
      defineMimeType({
        extensions: '.mdx',
        mimeType: 'text/mdx',
      })

      assert.equal(detectMimeType('mdx'), 'text/mdx')
      assert.equal(detectMimeType('.mdx'), 'text/mdx')
    })

    it('trims extension whitespace', () => {
      defineMimeType({
        extensions: '  mdx  ',
        mimeType: 'text/mdx',
      })

      assert.equal(detectMimeType('mdx'), 'text/mdx')
    })

    it('works with detectContentType', () => {
      defineMimeType({
        extensions: 'mdx',
        mimeType: 'text/mdx',
      })

      // text/* types get charset by default
      assert.equal(detectContentType('mdx'), 'text/mdx; charset=utf-8')
      assert.equal(detectContentType('file.mdx'), 'text/mdx; charset=utf-8')
    })

    it('registers multiple extensions for the same MIME type', () => {
      defineMimeType({
        extensions: ['jpg', 'jpeg', 'jpe'],
        mimeType: 'image/jpeg',
      })

      assert.equal(detectMimeType('jpg'), 'image/jpeg')
      assert.equal(detectMimeType('jpeg'), 'image/jpeg')
      assert.equal(detectMimeType('jpe'), 'image/jpeg')
    })
  })

  describe('custom compressibility', () => {
    it('registers a compressible type', () => {
      defineMimeType({
        extensions: 'myext',
        mimeType: 'application/x-myformat',
        compressible: true,
      })

      assert.equal(isCompressibleMimeType('application/x-myformat'), true)
    })

    it('registers a non-compressible type', () => {
      defineMimeType({
        extensions: 'myext',
        mimeType: 'application/x-myformat',
        compressible: false,
      })

      assert.equal(isCompressibleMimeType('application/x-myformat'), false)
    })

    it('can mark a custom format as compressible', () => {
      // Custom application/* formats don't match default compressibility heuristics
      defineMimeType({
        extensions: 'mydata',
        mimeType: 'application/x-mydata',
        compressible: true,
      })

      assert.equal(isCompressibleMimeType('application/x-mydata'), true)
    })

    it('can override builtin compressibility', () => {
      // text/html is compressible by default
      assert.equal(isCompressibleMimeType('text/html'), true)

      defineMimeType({
        extensions: 'html',
        mimeType: 'text/html',
        compressible: false,
      })

      assert.equal(isCompressibleMimeType('text/html'), false)
    })

    it('falls back to default heuristics when compressible is omitted', () => {
      // text/* types are compressible by default heuristic
      defineMimeType({
        extensions: 'mdx',
        mimeType: 'text/mdx',
      })

      assert.equal(isCompressibleMimeType('text/mdx'), true)

      // application/* types without +json are not compressible by default
      defineMimeType({
        extensions: 'mybin',
        mimeType: 'application/x-mybin',
      })

      assert.equal(isCompressibleMimeType('application/x-mybin'), false)
    })

    it('handles Content-Type with parameters', () => {
      defineMimeType({
        extensions: 'myext',
        mimeType: 'application/x-myformat',
        compressible: true,
      })

      assert.equal(isCompressibleMimeType('application/x-myformat; charset=utf-8'), true)
    })
  })

  describe('custom charset', () => {
    it('adds charset when specified', () => {
      defineMimeType({
        extensions: 'myext',
        mimeType: 'application/x-myformat',
        charset: 'utf-8',
      })

      assert.equal(
        mimeTypeToContentType('application/x-myformat'),
        'application/x-myformat; charset=utf-8',
      )
    })

    it('adds custom charset', () => {
      defineMimeType({
        extensions: 'myext',
        mimeType: 'application/x-myformat',
        charset: 'iso-8859-1',
      })

      assert.equal(
        mimeTypeToContentType('application/x-myformat'),
        'application/x-myformat; charset=iso-8859-1',
      )
    })

    it('falls back to default heuristics when charset is omitted', () => {
      // text/* types get charset by default
      defineMimeType({
        extensions: 'mdx',
        mimeType: 'text/mdx',
      })

      assert.equal(mimeTypeToContentType('text/mdx'), 'text/mdx; charset=utf-8')

      // application/* types without +json don't get charset
      defineMimeType({
        extensions: 'mybin',
        mimeType: 'application/x-mybin',
      })

      assert.equal(mimeTypeToContentType('application/x-mybin'), 'application/x-mybin')
    })

    it('does not add charset if already present in input', () => {
      defineMimeType({
        extensions: 'myext',
        mimeType: 'application/x-myformat',
        charset: 'utf-8',
      })

      assert.equal(
        mimeTypeToContentType('application/x-myformat; charset=iso-8859-1'),
        'application/x-myformat; charset=iso-8859-1',
      )
    })

    it('does not override text/xml exception (XML has built-in encoding)', () => {
      defineMimeType({
        extensions: 'xml',
        mimeType: 'text/xml',
        charset: 'utf-8',
      })

      // text/xml is a hardcoded exception because XML documents have
      // built-in encoding detection via BOM and <?xml?> declarations
      assert.equal(mimeTypeToContentType('text/xml'), 'text/xml')
    })
  })

  describe('combined options', () => {
    it('supports all options together', () => {
      defineMimeType({
        extensions: 'myext',
        mimeType: 'application/x-myformat',
        compressible: true,
        charset: 'utf-8',
      })

      assert.equal(detectMimeType('myext'), 'application/x-myformat')
      assert.equal(detectMimeType('file.myext'), 'application/x-myformat')
      assert.equal(isCompressibleMimeType('application/x-myformat'), true)
      assert.equal(
        mimeTypeToContentType('application/x-myformat'),
        'application/x-myformat; charset=utf-8',
      )
      assert.equal(detectContentType('myext'), 'application/x-myformat; charset=utf-8')
    })

    it('allows multiple registrations', () => {
      defineMimeType({
        extensions: 'mdx',
        mimeType: 'text/mdx',
        compressible: true,
      })

      defineMimeType({
        extensions: 'prisma',
        mimeType: 'text/x-prisma',
        compressible: true,
      })

      assert.equal(detectMimeType('mdx'), 'text/mdx')
      assert.equal(detectMimeType('prisma'), 'text/x-prisma')
    })

    it('last registration wins for same extension', () => {
      defineMimeType({
        extensions: 'myext',
        mimeType: 'application/x-first',
      })

      defineMimeType({
        extensions: 'myext',
        mimeType: 'application/x-second',
      })

      assert.equal(detectMimeType('myext'), 'application/x-second')
    })
  })

  describe('resetMimeTypes()', () => {
    it('clears all custom registrations', () => {
      defineMimeType({
        extensions: 'reset-test',
        mimeType: 'application/x-reset-test',
        compressible: true,
        charset: 'utf-8',
      })

      assert.equal(detectMimeType('reset-test'), 'application/x-reset-test')
      assert.equal(isCompressibleMimeType('application/x-reset-test'), true)
      assert.equal(
        mimeTypeToContentType('application/x-reset-test'),
        'application/x-reset-test; charset=utf-8',
      )

      resetMimeTypes()

      // Falls back to defaults (reset-test is unknown)
      assert.equal(detectMimeType('reset-test'), undefined)
      // Falls back to heuristic (application/* without +json is not compressible)
      assert.equal(isCompressibleMimeType('application/x-reset-test'), false)
      // Falls back to heuristic (application/* without +json gets no charset)
      assert.equal(mimeTypeToContentType('application/x-reset-test'), 'application/x-reset-test')
    })

    it('restores overridden builtins', () => {
      defineMimeType({
        extensions: 'txt',
        mimeType: 'text/custom',
      })

      assert.equal(detectMimeType('txt'), 'text/custom')

      resetMimeTypes()

      assert.equal(detectMimeType('txt'), 'text/plain')
    })
  })
})
