import * as assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import {
  type FileUploadHandler,
  FormDataParseError,
  MaxFilesExceededError,
  parseFormData,
} from './form-data.ts'

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
        'Content-Type: text/plain',
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
    assert.equal(file.type, 'text/plain')
    assert.equal(await file.text(), 'This is an example file.')
  })

  it('calls the file upload handler for each file part', async () => {
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

    let fileUploadHandler = mock.fn<FileUploadHandler>()

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

    let formData = await parseFormData(
      request,
      async (upload) => new File([await upload.text()], 'example.txt', { type: 'text/plain' }),
    )

    let file = formData.get('file')

    assert.ok(file instanceof File)
    assert.equal(file.name, 'example.txt')
    assert.equal(file.type, 'text/plain')
    assert.equal(await file.text(), 'This is an example file.')
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

    await assert.rejects(async () => {
      await parseFormData(request)
    }, FormDataParseError)
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
})
