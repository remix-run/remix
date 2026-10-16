import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  type FileUploadHandler,
  type FileUpload,
  BufferedFile,
  FormDataParseError,
  MaxFilesExceededError,
  parseFormData,
} from './form-data.ts'
import {
  MultipartParseError,
  MaxFileSizeExceededError,
  MaxHeaderSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
} from '../index.ts'

// Native File normalizes some MIME types differently across runtimes (for example
// Bun adds charset for text types and rewrites application/javascript), so derive
// the input type from the current runtime before asserting the response headers.
function normalizeFileType(type: string): string {
  return new File([''], '', { type }).type
}

describe('parseFormData', () => {
  it('reports the uploaded media type independently of the filename extension', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=ExampleBoundary' },
      body: [
        '--ExampleBoundary',
        'Content-Disposition: form-data; name="file"; filename="example.txt"',
        'Content-Type: Text/HTML; charset=UTF-8',
        '',
        '<p>Example</p>',
        '--ExampleBoundary--',
      ].join('\r\n'),
    })

    let formData = await parseFormData(request)
    let file = formData.get('file')
    assert.ok(file instanceof File)
    assert.equal(file.name, 'example.txt')
    assert.equal(file.type, normalizeFileType('Text/HTML'))
    assert.equal(await file.text(), '<p>Example</p>')
  })

  function createMixedCaseMultipartRequest(): Request {
    return new Request('https://remix.run', {
      method: 'POST',
      headers: { 'Content-Type': 'Multipart/Form-Data; boundary="ExampleBoundary"' },
      body: [
        '--ExampleBoundary',
        'Content-Disposition: form-data; name="text"',
        '',
        'hello',
        '--ExampleBoundary',
        'Content-Disposition: form-data; name="file"; filename="example.txt"',
        'Content-Type: text/plain',
        '',
        'world',
        '--ExampleBoundary--',
      ].join('\r\n'),
    })
  }

  it('calls the upload handler for mixed-case multipart media types', async () => {
    let formData = await parseFormData(createMixedCaseMultipartRequest(), async (upload) => {
      assert.equal(upload.name, 'example.txt')
      return `stored: ${await upload.text()}`
    })

    assert.equal(formData.get('text'), 'hello')
    assert.equal(formData.get('file'), 'stored: world')
  })

  it('enforces maxFiles for mixed-case multipart media types', async () => {
    await assert.rejects(
      () => parseFormData(createMixedCaseMultipartRequest(), { maxFiles: 0 }),
      MaxFilesExceededError,
    )
  })

  it('enforces maxFileSize for mixed-case multipart media types', async () => {
    await assert.rejects(
      () => parseFormData(createMixedCaseMultipartRequest(), { maxFileSize: 1 }),
      MaxFileSizeExceededError,
    )
  })

  it('enforces maxHeaderSize for mixed-case multipart media types', async () => {
    await assert.rejects(
      () => parseFormData(createMixedCaseMultipartRequest(), { maxHeaderSize: 1 }),
      MaxHeaderSizeExceededError,
    )
  })

  it('enforces maxParts for mixed-case multipart media types', async () => {
    await assert.rejects(
      () => parseFormData(createMixedCaseMultipartRequest(), { maxParts: 1 }),
      MaxPartsExceededError,
    )
  })

  it('enforces maxTotalSize for mixed-case multipart media types', async () => {
    await assert.rejects(
      () => parseFormData(createMixedCaseMultipartRequest(), { maxTotalSize: 1 }),
      MaxTotalSizeExceededError,
    )
  })

  it('enforces maxParts for mixed-case urlencoded media types', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: { 'Content-Type': 'Application/X-Www-Form-Urlencoded; charset=UTF-8' },
      body: 'tag=red&tag=green',
    })

    await assert.rejects(() => parseFormData(request, { maxParts: 1 }), MaxPartsExceededError)
  })

  it('enforces maxTotalSize for mixed-case urlencoded media types', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: { 'Content-Type': 'APPLICATION/X-WWW-FORM-URLENCODED' },
      body: 'tag=red',
    })

    await assert.rejects(
      () => parseFormData(request, { maxTotalSize: 1 }),
      MaxTotalSizeExceededError,
    )
  })

  it('preserves repeated fields for mixed-case urlencoded media types', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: { 'Content-Type': 'Application/X-Www-Form-Urlencoded; charset=UTF-8' },
      body: 'tag=red&tag=green',
    })

    let formData = await parseFormData(request, { maxParts: 2 })
    assert.deepEqual(formData.getAll('tag'), ['red', 'green'])
  })

  it('does not parse media types that only start with the urlencoded media type', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded-extra' },
      body: 'tag=red&tag=green',
    })

    await assert.rejects(
      () => parseFormData(request, { maxParts: 1, maxTotalSize: 7 }),
      FormDataParseError,
    )
    assert.equal(request.bodyUsed, false)
  })

  it('rejects unsupported media types even if the native parser accepts them', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded-extra' },
      body: 'tag=red&tag=green',
    })
    request.formData = async function () {
      let formData = new FormData()
      formData.append('tag', 'red')
      formData.append('tag', 'green')
      return formData
    }

    await assert.rejects(
      () => parseFormData(request, { maxParts: 1, maxTotalSize: 7 }),
      FormDataParseError,
    )
  })

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

  it('throws when urlencoded form data exceeds maxParts', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'field1=value1&field2=value2',
    })

    await assert.rejects(
      async () => await parseFormData(request, { maxParts: 1 }),
      MaxPartsExceededError,
    )
  })

  it('throws when urlencoded form data exceeds maxTotalSize', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'field1=value1&field2=value2',
    })

    await assert.rejects(
      async () => await parseFormData(request, { maxTotalSize: 1 }),
      MaxTotalSizeExceededError,
    )
  })

  it('preserves repeated urlencoded form fields', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'tag=red&tag=green&tag=blue',
    })

    let formData = await parseFormData(request)

    assert.deepEqual(formData.getAll('tag'), ['red', 'green', 'blue'])
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

describe('BufferedFile', () => {
  function createContent(size: number): Uint8Array<ArrayBuffer> {
    let content = new Uint8Array(size)
    for (let index = 0; index < size; index++) content[index] = index % 251
    return content
  }

  it('streams the full contents of a file larger than one chunk', async () => {
    let content = createContent(200 * 1024 + 7)
    let file = new BufferedFile([content], 'example.bin')

    let chunks: Uint8Array[] = []
    for await (let chunk of file.stream()) chunks.push(chunk)

    assert.ok(chunks.length > 1)
    assert.deepEqual(new Uint8Array(await new Blob(chunks as BlobPart[]).arrayBuffer()), content)
  })

  it('streams an empty file', async () => {
    let file = new BufferedFile([], 'example.bin')

    let chunks: Uint8Array[] = []
    for await (let chunk of file.stream()) chunks.push(chunk)

    assert.deepEqual(chunks, [])
  })

  it('supports reading the stream into a caller-provided buffer', async () => {
    let content = createContent(100 * 1024)
    let file = new BufferedFile([content], 'example.bin')

    let reader = file.stream().getReader({ mode: 'byob' })
    let received = new Uint8Array(content.length)
    let offset = 0
    while (true) {
      let { done, value } = await reader.read(new Uint8Array(16 * 1024))
      if (done || value == null) break
      received.set(value, offset)
      offset += value.byteLength
    }

    assert.equal(offset, content.length)
    assert.deepEqual(received, content)
  })
})

describe('FileUpload', () => {
  function createRequest(...parts: string[][]): Request {
    return new Request('https://remix.run', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=----BOUNDARY' },
      body: [...parts.flatMap((part) => ['------BOUNDARY', ...part]), '------BOUNDARY--'].join(
        '\r\n',
      ),
    })
  }

  function textPart(name: string, value: string): string[] {
    return [`Content-Disposition: form-data; name="${name}"`, '', value]
  }

  function filePart(name: string, filename: string, content: string, type = 'text/plain') {
    return [
      `Content-Disposition: form-data; name="${name}"; filename="${filename}"`,
      `Content-Type: ${type}`,
      '',
      content,
    ]
  }

  it('streams file contents to the upload handler', async () => {
    let request = createRequest(
      textPart('title', 'Hello'),
      filePart('file', 'example.txt', 'This is an example file.'),
      textPart('after', 'World'),
    )

    let formData = await parseFormData(request, async (upload) => {
      assert.equal(upload.fieldName, 'file')
      assert.equal(upload.name, 'example.txt')
      assert.equal(upload.type, normalizeFileType('text/plain'))
      assert.throws(() => upload.size, TypeError)

      let text = await new Response(upload.stream()).text()
      assert.equal(upload.size, text.length)
      return text
    })

    assert.equal(formData.get('title'), 'Hello')
    assert.equal(formData.get('file'), 'This is an example file.')
    assert.equal(formData.get('after'), 'World')
  })

  it('calls the upload handler before the file contents arrive', async () => {
    let encoder = new TextEncoder()
    let { promise: handlerCalled, resolve: onHandlerCalled } = Promise.withResolvers<void>()
    let body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            [
              '------BOUNDARY',
              'Content-Disposition: form-data; name="file"; filename="example.txt"',
              '',
              '',
            ].join('\r\n'),
          ),
        )
        await handlerCalled
        controller.enqueue(encoder.encode('Late contents\r\n------BOUNDARY--'))
        controller.close()
      },
    })
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=----BOUNDARY' },
      body,
      duplex: 'half',
    } as RequestInit)

    let formData = await parseFormData(request, async (upload) => {
      onHandlerCalled()
      return upload.text()
    })

    assert.equal(formData.get('file'), 'Late contents')
  })

  it('reads contents with bytes, arrayBuffer, and text', async () => {
    let request = createRequest(
      filePart('a', 'a.txt', 'aaa'),
      filePart('b', 'b.txt', 'bbbb'),
      filePart('c', 'c.txt', 'ccccc'),
    )

    let formData = await parseFormData(request, async (upload) => {
      if (upload.fieldName === 'a') return String((await upload.bytes()).length)
      if (upload.fieldName === 'b') return String((await upload.arrayBuffer()).byteLength)
      return upload.text()
    })

    assert.equal(formData.get('a'), '3')
    assert.equal(formData.get('b'), '4')
    assert.equal(formData.get('c'), 'ccccc')
  })

  it('only allows the contents to be read once', async () => {
    let request = createRequest(filePart('file', 'example.txt', 'contents'))

    await parseFormData(request, async (upload) => {
      await upload.text()
      await assert.rejects(() => upload.text(), TypeError)
      assert.throws(() => upload.stream(), TypeError)
      assert.throws(() => upload.slice(), TypeError)
    })
  })

  it('discards contents the upload handler does not read', async () => {
    let request = createRequest(
      filePart('skipped', 'skipped.txt', 'Skipped contents'),
      filePart('file', 'example.txt', 'Read contents'),
    )

    let formData = await parseFormData(request, async (upload) =>
      upload.fieldName === 'skipped' ? null : upload.text(),
    )

    assert.equal(formData.get('skipped'), null)
    assert.equal(formData.get('file'), 'Read contents')
  })

  it('stores the upload as a File when the handler returns it unread', async () => {
    let request = createRequest(filePart('file', 'example.txt', 'contents'))

    let formData = await parseFormData(request, (upload) => upload)

    let file = formData.get('file')
    assert.ok(file instanceof File)
    assert.equal(file.name, 'example.txt')
    assert.equal(file.type, normalizeFileType('text/plain'))
    assert.equal(await file.text(), 'contents')
  })

  it('stores the upload in memory when using the default upload handler', async () => {
    let request = createRequest(filePart('file', 'example.txt', 'contents'))

    let formData = await parseFormData(request)

    let file = formData.get('file')
    assert.ok(file instanceof File)
    assert.equal(await file.text(), 'contents')
  })

  it('throws when the handler returns the upload after reading it', async () => {
    let request = createRequest(filePart('file', 'example.txt', 'contents'))

    await assert.rejects(
      parseFormData(request, async (upload) => {
        await upload.text()
        return upload
      }),
      TypeError,
    )
  })

  it('normalizes the media type like File', async () => {
    let request = createRequest(filePart('upper', 'a.txt', 'a', 'Text/PLAIN'), [
      'Content-Disposition: form-data; name="missing"; filename="b.bin"',
      '',
      'b',
    ])
    let types: string[] = []

    await parseFormData(request, (upload) => {
      types.push(upload.type)
    })

    assert.deepEqual(types, [normalizeFileType('Text/PLAIN'), 'application/octet-stream'])
  })

  it('throws MaxFileSizeExceededError from the upload stream and the parser', async () => {
    let request = createRequest(filePart('file', 'example.txt', 'x'.repeat(100)))
    let streamError: unknown

    await assert.rejects(
      parseFormData(request, { maxFileSize: 10 }, async (upload) => {
        try {
          await upload.text()
        } catch (error) {
          streamError = error
          throw error
        }
      }),
      MaxFileSizeExceededError,
    )
    assert.ok(streamError instanceof MaxFileSizeExceededError)
  })

  it('throws MaxFileSizeExceededError for files the handler does not read', async () => {
    let request = createRequest(filePart('file', 'example.txt', 'x'.repeat(100)))

    await assert.rejects(
      parseFormData(request, { maxFileSize: 10 }, () => null),
      MaxFileSizeExceededError,
    )
  })

  it('throws MaxFilesExceededError before calling the upload handler', async () => {
    let request = createRequest(
      filePart('file1', 'a.txt', 'a'),
      filePart('file2', 'b.txt', 'b'),
      filePart('file3', 'c.txt', 'c'),
    )
    let calls = 0

    await assert.rejects(
      parseFormData(request, { maxFiles: 2 }, () => {
        calls++
      }),
      MaxFilesExceededError,
    )
    assert.equal(calls, 2)
  })

  it('throws FormDataParseError for malformed multipart data', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=----BOUNDARY' },
      body: [
        '------BOUNDARY',
        'Content-Disposition: form-data; name="file"; filename="example.txt"',
        '',
        'Truncated contents',
      ].join('\r\n'),
    })
    let streamError: unknown

    await assert.rejects(
      parseFormData(request, async (upload) => {
        try {
          await upload.text()
        } catch (error) {
          streamError = error
          throw error
        }
      }),
      FormDataParseError,
    )
    assert.ok(streamError instanceof FormDataParseError)
    assert.ok(streamError.cause instanceof MultipartParseError)
  })

  it('allows errors thrown by the upload handler to propagate directly', async () => {
    let request = createRequest(filePart('file', 'example.txt', 'contents'))
    let error = new Error('Upload failed')

    await assert.rejects(
      parseFormData(request, () => {
        throw error
      }),
      (thrown: unknown) => thrown === error,
    )
  })

  it('parses urlencoded requests', async () => {
    let request = new Request('https://remix.run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'a=1&b=2',
    })

    let formData = await parseFormData(request)

    assert.equal(formData.get('a'), '1')
    assert.equal(formData.get('b'), '2')
  })

  it('throws when its contents are read after the upload handler returns', async () => {
    let request = createRequest(filePart('file', 'example.txt', 'contents'))
    let upload: FileUpload | undefined

    await parseFormData(request, (file) => {
      upload = file
    })

    assert.ok(upload)
    assert.throws(() => upload!.stream(), TypeError)
    await assert.rejects(() => upload!.text(), TypeError)
  })

  it('throws instead of converting to a string', async () => {
    let request = createRequest(filePart('file', 'example.txt', 'contents'))

    await parseFormData(request, (upload) => {
      assert.throws(() => String(upload), TypeError)
      assert.throws(() => new FormData().append('file', upload as unknown as Blob), TypeError)
    })
  })

  it('parses JSON contents', async () => {
    let request = createRequest(filePart('file', 'data.json', '{"a":1}', 'application/json'))

    let formData = await parseFormData(request, async (upload) => String((await upload.json()).a))

    assert.equal(formData.get('file'), '1')
  })
})
