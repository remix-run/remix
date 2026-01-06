import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ContentDisposition } from './content-disposition.ts'

describe('ContentDisposition', () => {
  it('initializes with an empty string', () => {
    let header = new ContentDisposition('')
    assert.equal(header.type, undefined)
    assert.equal(header.filename, undefined)
  })

  it('initializes with a string', () => {
    let header = new ContentDisposition('attachment; filename="example.txt"')
    assert.equal(header.type, 'attachment')
    assert.equal(header.filename, 'example.txt')
  })

  it('initializes with an object', () => {
    let header = new ContentDisposition({ type: 'attachment', filename: 'example.txt' })
    assert.equal(header.type, 'attachment')
    assert.equal(header.filename, 'example.txt')
  })

  it('initializes with another ContentDisposition', () => {
    let header = new ContentDisposition(
      new ContentDisposition('attachment; filename="example.txt"'),
    )
    assert.equal(header.type, 'attachment')
    assert.equal(header.filename, 'example.txt')
  })

  it('handles whitespace in initial value', () => {
    let header = new ContentDisposition(' inline ;  filename = "document.pdf" ')
    assert.equal(header.type, 'inline')
    assert.equal(header.filename, 'document.pdf')
  })

  it('sets and gets type', () => {
    let header = new ContentDisposition('attachment')
    header.type = 'inline'
    assert.equal(header.type, 'inline')
  })

  it('sets and gets filename', () => {
    let header = new ContentDisposition('attachment')
    header.filename = 'example.txt'
    assert.equal(header.filename, 'example.txt')
  })

  it('sets and gets name', () => {
    let header = new ContentDisposition('form-data')
    header.name = 'field1'
    assert.equal(header.name, 'field1')
  })

  it('sets and gets filenameSplat', () => {
    let header = new ContentDisposition('attachment')
    header.filenameSplat = "UTF-8''%E6%96%87%E4%BB%B6.txt"
    assert.equal(header.filenameSplat, "UTF-8''%E6%96%87%E4%BB%B6.txt")
  })

  it('handles quoted attribute values', () => {
    let header = new ContentDisposition('attachment; filename="file with spaces.txt"')
    assert.equal(header.filename, 'file with spaces.txt')
  })

  it('converts to string correctly', () => {
    let header = new ContentDisposition('attachment; filename="example.txt"')
    assert.equal(header.toString(), 'attachment; filename=example.txt')
  })

  it('converts to an empty string when type is not set', () => {
    let header = new ContentDisposition()
    header.filename = 'example.txt'
    assert.equal(header.toString(), '')
  })

  it('handles multiple attributes', () => {
    let header = new ContentDisposition('form-data; name="field1"; filename="example.txt"')
    assert.equal(header.type, 'form-data')
    assert.equal(header.name, 'field1')
    assert.equal(header.filename, 'example.txt')
  })

  it('preserves case for type', () => {
    let header = new ContentDisposition('Attachment')
    assert.equal(header.type, 'Attachment')
  })

  it('handles attribute values with special characters', () => {
    let header = new ContentDisposition(
      'attachment; filename="file with spaces and (parentheses).txt"',
    )
    assert.equal(header.filename, 'file with spaces and (parentheses).txt')
  })

  it('correctly quotes attribute values in toString()', () => {
    let header = new ContentDisposition('attachment')
    header.filename = 'file "with" quotes.txt'
    assert.equal(header.toString(), 'attachment; filename="file \\"with\\" quotes.txt"')
  })

  it('handles empty attribute values', () => {
    let header = new ContentDisposition('form-data; name=')
    assert.equal(header.name, '')
  })

  it('ignores attributes without values', () => {
    let header = new ContentDisposition('attachment; filename')
    assert.equal(header.filename, undefined)
  })

  it('preserves order of attributes in toString()', () => {
    let header = new ContentDisposition('form-data; name="field1"; filename="example.txt"')
    assert.equal(header.toString(), 'form-data; name=field1; filename=example.txt')
  })

  it('handles filename* (RFC 5987) correctly', () => {
    let header = new ContentDisposition("attachment; filename*=UTF-8''%E6%96%87%E4%BB%B6.txt")
    assert.equal(header.filenameSplat, "UTF-8''%E6%96%87%E4%BB%B6.txt")
  })

  it('prioritizes filename* over filename when both are present', () => {
    let header = new ContentDisposition(
      'attachment; filename="fallback.txt"; filename*=UTF-8\'\'%E6%96%87%E4%BB%B6.txt',
    )
    assert.equal(header.filename, 'fallback.txt')
    assert.equal(header.filenameSplat, "UTF-8''%E6%96%87%E4%BB%B6.txt")
  })

  it('handles form-data disposition type correctly', () => {
    let header = new ContentDisposition('form-data; name="uploadedfile"; filename="example.txt"')
    assert.equal(header.type, 'form-data')
    assert.equal(header.name, 'uploadedfile')
    assert.equal(header.filename, 'example.txt')
  })

  describe('preferredFilename', () => {
    it('returns filename* when both filename and filename* are present', () => {
      let header = new ContentDisposition(
        'attachment; filename="old.txt"; filename*=UTF-8\'\'new.txt',
      )
      assert.equal(header.preferredFilename, 'new.txt')
    })

    it('returns filename when only filename is present', () => {
      let header = new ContentDisposition('attachment; filename="document.pdf"')
      assert.equal(header.preferredFilename, 'document.pdf')
    })

    it('returns filename* when only filename* is present', () => {
      let header = new ContentDisposition("attachment; filename*=UTF-8''special%20file.txt")
      assert.equal(header.preferredFilename, 'special file.txt')
    })

    it('handles UTF-8 encoded filename* with special characters', () => {
      let header = new ContentDisposition("attachment; filename*=UTF-8''%E6%96%87%E4%BB%B6.txt")
      assert.equal(header.preferredFilename, '文件.txt')
    })

    it('handles ISO-8859-1 encoded filename* with special characters', () => {
      let header = new ContentDisposition("attachment; filename*=ISO-8859-1''f%F6o.txt")
      assert.equal(header.preferredFilename, 'föo.txt')
    })

    it('handles filename* with spaces and other special characters', () => {
      let header = new ContentDisposition(
        "attachment; filename*=UTF-8''hello%20world%21%20%26%20goodbye.txt",
      )
      assert.equal(header.preferredFilename, 'hello world! & goodbye.txt')
    })

    it('returns undefined when no filename or filename* is present', () => {
      let header = new ContentDisposition('attachment')
      assert.equal(header.preferredFilename, undefined)
    })

    it('falls back to filename when filename* is invalid', () => {
      let header = new ContentDisposition('attachment; filename="fallback.txt"; filename*=invalid')
      assert.equal(header.preferredFilename, 'fallback.txt')
    })

    it('correctly decodes ISO-8859-1 encoded filename', () => {
      let header = new ContentDisposition("attachment; filename*=ISO-8859-1''f%F6o.txt")
      assert.equal(header.preferredFilename, 'föo.txt')
    })

    it('correctly decodes ISO-8859-15 encoded filename', () => {
      let header = new ContentDisposition("attachment; filename*=ISO-8859-15''file%A4.txt")
      assert.equal(header.preferredFilename, 'file€.txt')
    })

    it('correctly decodes windows-1252 encoded filename', () => {
      let header = new ContentDisposition("attachment; filename*=windows-1252''file%80.txt")
      assert.equal(header.preferredFilename, 'file\x80.txt')
    })

    it('handles UTF-8 encoded filename correctly', () => {
      let header = new ContentDisposition("attachment; filename*=UTF-8''%E6%96%87%E4%BB%B6.txt")
      assert.equal(header.preferredFilename, '文件.txt')
    })

    it('falls back gracefully with a warning for unknown charsets', () => {
      let warn = console.warn
      let warnWasCalled = false
      console.warn = () => {
        warnWasCalled = true
      }

      let header = new ContentDisposition("attachment; filename*=unknown-charset''file%FF.txt")

      assert.equal(header.preferredFilename, 'fileÿ.txt')
      assert.ok(warnWasCalled, 'console.warn should have been called')

      console.warn = warn
    })
  })
})

describe('ContentDisposition.from', () => {
  it('parses a string value', () => {
    let result = ContentDisposition.from('attachment; filename="test.txt"')
    assert.ok(result instanceof ContentDisposition)
    assert.equal(result.type, 'attachment')
    assert.equal(result.filename, 'test.txt')
  })
})
