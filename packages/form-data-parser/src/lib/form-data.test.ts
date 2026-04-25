import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  type FileUploadHandler,
  FormDataParseError,
  MaxFilesExceededError,
  parseFormData,
} from './form-data.ts'
import { MultipartParseError, MaxPartsExceededError, MaxTotalSizeExceededError } from '../index.ts'

// Native File normalizes some MIME types differently across runtimes (for example
// Bun adds charset for text types and rewrites application/javascript), so derive
// the input type from the current runtime before asserting the response headers.
function normalizeFileType(type: string): string {
  return new File([''], '', { type }).type
}

describe('parseFormData', () => {
  it('parses a application/x-www-form-urlencoded request', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'text=Hello%2C%20World!',
    })

    let formData = await parseFormData(request)

    assert.equal(formData.get('text'), 'Hello, World!')
  })

  it('parses a multipart/form-data request', async () => {
    let fileType = normalizeFileType('text/plain')
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="text"',
        '',
        'Hello, World!',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file"; filename="example.txt"',
        `Content-Type: ${fileType}`,
        '',
        'This is an example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    })

    let formData = await parseFormData(request)

    assert.equal(formData.get('text'), 'Hello, World!')

    let file = formData.get('file')
    assert.ok(file instanceof File)
    assert.equal(file.name, 'example.txt')
    assert.equal(file.type, fileType)
    assert.equal(await file.text(), 'This is an example file.')
  })

  it('calls the file upload handler for each file part', async (t) => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file1"; filename="example.txt"',
        'Content-Type: text/plain',
        '',
        'This is an example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file2"; filename="example.txt"',
        'Content-Type: text/plain',
        '',
        'This is another example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    })

    let fileUploadHandler = t.mock.fn<FileUploadHandler>()

    await parseFormData(request, fileUploadHandler)

    assert.equal(fileUploadHandler.mock.calls.length, 2)
  })

  it('allows returning `null` from the upload handler', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file"; filename="example.txt"',
        'Content-Type: text/plain',
        '',
        'This is an example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    })

    let formData = await parseFormData(request, () => null)

    assert.equal(formData.get('file'), null)
  })

  it('allows returning strings from the upload handler', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file"; filename="example.txt"',
        'Content-Type: text/plain',
        '',
        'This is an example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    })

    let formData = await parseFormData(request, (upload) => upload.text())

    assert.equal(formData.get('file'), 'This is an example file.')
  })

  it('allows returning files from the upload handler', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file"; filename="example.txt"',
        'Content-Type: text/plain',
        '',
        'This is an example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    })

    let uploadedFile: File | null = null
    let formData = await parseFormData(request, async (upload) => {
      uploadedFile = new File([await upload.text()], 'example.txt', { type: 'text/plain' })
      return uploadedFile
    })

    let file = formData.get('file')

    assert.ok(file instanceof File)
    assert.equal(file.name, 'example.txt')
    assert.equal(file.type, uploadedFile!.type)
    assert.equal(await file.text(), 'This is an example file.')
  })

  it('allows errors thrown by the upload handler to propagate directly', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file"; filename="example.txt"',
        'Content-Type: text/plain',
        '',
        'This is an example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    })
    let uploadError = new Error('Upload failed')

    await assert.rejects(
      async () =>
        await parseFormData(request, () => {
          throw uploadError
        }),
      (error: unknown) => error === uploadError,
    )
  })

  it('throws MaxFilesExceededError when the number of files exceeds the limit', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file1"; filename="example1.txt"',
        'Content-Type: text/plain',
        '',
        'This is the first example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file2"; filename="example2.txt"',
        'Content-Type: text/plain',
        '',
        'This is the second example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file3"; filename="example3.txt"',
        'Content-Type: text/plain',
        '',
        'This is the third example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    })

    await assert.rejects(
      async () => await parseFormData(request, { maxFiles: 2 }),
      MaxFilesExceededError,
    )
  })

  it('throws when the number of multipart parts exceeds maxParts', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="field1"',
        '',
        'value1',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file1"; filename="example1.txt"',
        'Content-Type: text/plain',
        '',
        'This is the first example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="field2"',
        '',
        'value2',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    })

    await assert.rejects(
      async () => await parseFormData(request, { maxParts: 2 }),
      MaxPartsExceededError,
    )
  })

  it('throws when aggregate multipart content size exceeds maxTotalSize', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="field1"',
        '',
        'hello',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file1"; filename="example1.txt"',
        'Content-Type: text/plain',
        '',
        'world',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    })

    await assert.rejects(
      async () => await parseFormData(request, { maxTotalSize: 9 }),
      MaxTotalSizeExceededError,
    )
  })

  it('throws when the request does not contain parseable content', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: 'Hello, World!',
    })

    await assert.rejects(async () => {
      await parseFormData(request)
    }, FormDataParseError)
  })

  it('throws when the request contains malformed multipart/form-data', async () => {
    let boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: 'invalid',
    })

    await assert.rejects(
      async () => {
        await parseFormData(request)
      },
      (error: unknown) =>
        error instanceof FormDataParseError && error.cause instanceof MultipartParseError,
    )
  })

  it('parses a multipart file without a media type', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----BOUNDARY',
      },
      body: [
        '------BOUNDARY',
        'Content-Disposition: form-data; name="file"; filename="example.txt"',
        '',
        'This is an example file.',
        '------BOUNDARY--',
      ].join('\r\n'),
    })

    let formData = await parseFormData(request)
    let file = formData.get('file')
    assert.ok(file instanceof File)
    assert.equal(file.name, 'example.txt')
    assert.equal(file.type, 'application/octet-stream')
    assert.equal(await file.text(), 'This is an example file.')
  })

  it('parses multipart uploads with non-ASCII filenames', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----BOUNDARY',
      },
      body: [
        '------BOUNDARY',
        'Content-Disposition: form-data; name="japanese"; filename="テスト画像.png"',
        'Content-Type: image/png',
        '',
        'Japanese file content.',
        '------BOUNDARY',
        'Content-Disposition: form-data; name="chinese"; filename="文件.png"',
        'Content-Type: image/png',
        '',
        'Chinese file content.',
        '------BOUNDARY',
        'Content-Disposition: form-data; name="korean"; filename="파일.png"',
        'Content-Type: image/png',
        '',
        'Korean file content.',
        '------BOUNDARY--',
      ].join('\r\n'),
    })

    let formData = await parseFormData(request)

    let japaneseFile = formData.get('japanese')
    assert.ok(japaneseFile instanceof File)
    assert.equal(japaneseFile.name, 'テスト画像.png')
    assert.equal(await japaneseFile.text(), 'Japanese file content.')

    let chineseFile = formData.get('chinese')
    assert.ok(chineseFile instanceof File)
    assert.equal(chineseFile.name, '文件.png')
    assert.equal(await chineseFile.text(), 'Chinese file content.')

    let koreanFile = formData.get('korean')
    assert.ok(koreanFile instanceof File)
    assert.equal(koreanFile.name, '파일.png')
    assert.equal(await koreanFile.text(), 'Korean file content.')
  })

  it('preserves non-ASCII multipart field names and filenames', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----BOUNDARY',
      },
      body: [
        '------BOUNDARY',
        'Content-Disposition: form-data; name="名前"; filename="テスト画像.png"',
        'Content-Type: image/png',
        '',
        'This is an example file.',
        '------BOUNDARY--',
      ].join('\r\n'),
    })

    let formData = await parseFormData(request)
    let file = formData.get('名前')
    assert.ok(file instanceof File)
    assert.equal(file.name, 'テスト画像.png')
    assert.equal(file.type, 'image/png')
    assert.equal(await file.text(), 'This is an example file.')
  })

  it('preserves literal percent sequences in multipart filenames', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----BOUNDARY',
      },
      body: [
        '------BOUNDARY',
        'Content-Disposition: form-data; name="file"; filename="%2Fetc%2Fpasswd"',
        'Content-Type: text/plain',
        '',
        'This is an example file.',
        '------BOUNDARY--',
      ].join('\r\n'),
    })

    let formData = await parseFormData(request)
    let file = formData.get('file')
    assert.ok(file instanceof File)
    assert.equal(file.name, '%2Fetc%2Fpasswd')
  })
})
