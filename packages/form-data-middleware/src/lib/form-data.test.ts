import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  FormDataParseError,
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  MaxHeaderSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
  type FileUploadHandler,
} from '@remix-run/form-data-parser'
import { createRouter } from '@remix-run/fetch-router'
import type { ContextEntries, RequestContext } from '@remix-run/fetch-router'

import { formData } from './form-data.ts'

type FormDataState = {
  isDefined: boolean
  isFormData: boolean
  isEmpty: boolean
}

// Native File normalizes some MIME types differently across runtimes (for example
// Bun adds charset for text types and rewrites application/javascript), so derive
// the input type from the current runtime before asserting the response headers.
function normalizeFileType(type: string): string {
  return new File([''], '', { type }).type
}

function getFormDataState<params extends Record<string, any>, entries extends ContextEntries>(
  context: RequestContext<params, entries>,
): FormDataState {
  let formData = context.get(FormData)
  if (formData == null) {
    return {
      isDefined: false,
      isFormData: false,
      isEmpty: false,
    }
  }

  return {
    isDefined: true,
    isFormData: formData instanceof FormData,
    isEmpty: formData.entries().next().done === true,
  }
}

describe('formData middleware', () => {
  it('parses application/x-www-form-urlencoded form data from the request body', async () => {
    let router = createRouter({
      middleware: [formData()],
    })

    router.post('/', (context) => {
      let entries = Object.fromEntries(context.get(FormData).entries())
      return Response.json(entries)
    })

    let response = await router.fetch('https://remix.run/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'name=test',
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { name: 'test' })
  })

  it('parses multipart/form-data form data from the request body', async () => {
    let router = createRouter({
      middleware: [formData()],
    })

    router.post('/', (context) => {
      let entries = Object.fromEntries(context.get(FormData).entries())
      return Response.json(entries)
    })

    let boundary = '----WebKitFormBoundary1234567890'
    let response = await router.fetch('https://remix.run/', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: [
        `--${boundary}`,
        'Content-Disposition: form-data; name="name"',
        '',
        'test',
        `--${boundary}--`,
      ].join('\r\n'),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { name: 'test' })
  })

  it('stores uploaded files in context.get(FormData) on a multipart/form-data request', async () => {
    let router = createRouter({
      middleware: [formData()],
    })

    router.post('/', (context) => {
      let file1 = context.get(FormData).get('file1')
      let file2 = context.get(FormData).get('file2')

      return Response.json({
        file1: {
          isFile: file1 instanceof File,
          name: file1 instanceof File ? file1.name : null,
          type: file1 instanceof File ? file1.type : null,
        },
        file2: {
          isFile: file2 instanceof File,
          name: file2 instanceof File ? file2.name : null,
          type: file2 instanceof File ? file2.type : null,
        },
      })
    })

    let boundary = '----WebKitFormBoundary1234567890'
    let fileType = normalizeFileType('text/plain')
    let response = await router.fetch('https://remix.run/', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file1"; filename="test1.txt"',
        `Content-Type: ${fileType}`,
        '',
        'test 1',
        `--${boundary}`,
        'Content-Disposition: form-data; name="file2"; filename="test2.txt"',
        `Content-Type: ${fileType}`,
        '',
        'test 2',
        `--${boundary}--`,
      ].join('\r\n'),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      file1: {
        isFile: true,
        name: 'test1.txt',
        type: fileType,
      },
      file2: {
        isFile: true,
        name: 'test2.txt',
        type: fileType,
      },
    })
  })

  it('provides an empty FormData for GET requests', async () => {
    let router = createRouter({
      middleware: [formData()],
    })

    router.get('/', (context) => Response.json(getFormDataState(context)))

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      isDefined: true,
      isFormData: true,
      isEmpty: true,
    })
  })

  it('provides an empty FormData for HEAD requests', async () => {
    let formDataState: FormDataState | undefined
    let router = createRouter({
      middleware: [formData()],
    })

    router.head('/', (context) => {
      formDataState = getFormDataState(context)
      return new Response(null)
    })

    let response = await router.fetch('https://remix.run/', { method: 'HEAD' })

    assert.equal(response.status, 200)
    assert.deepEqual(formDataState, {
      isDefined: true,
      isFormData: true,
      isEmpty: true,
    })
  })

  it('throws when the request body is malformed multipart/form-data', async () => {
    let router = createRouter({
      middleware: [formData()],
    })

    router.post('/', (context) => Response.json(context.get(FormData)))

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: 'invalid',
      })
    }, FormDataParseError)
  })

  it('suppresses parse errors when suppressErrors is true', async () => {
    let router = createRouter({
      middleware: [formData({ suppressErrors: true })],
    })

    router.post('/', (context) => {
      let entries = Object.fromEntries(context.get(FormData).entries())
      return Response.json(entries)
    })

    let response = await router.fetch('https://remix.run/', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: 'invalid',
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {})
  })

  it('sets context.get(FormData) to an empty FormData when parse errors are suppressed', async () => {
    let router = createRouter({
      middleware: [formData({ suppressErrors: true })],
    })

    router.post('/', (context) =>
      // Explicitly check that FormData exists in request context
      Response.json({
        isDefined: context.has(FormData),
        isFormData: context.get(FormData) instanceof FormData,
        isEmpty: context.get(FormData).entries().next().done,
      }),
    )

    let response = await router.fetch('https://remix.run/', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: 'invalid',
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      isDefined: true,
      isFormData: true,
      isEmpty: true,
    })
  })

  it('does not suppress maxFiles errors when suppressErrors is true', async () => {
    let actionCalled = false
    let router = createRouter({
      middleware: [formData({ suppressErrors: true, maxFiles: 1 })],
    })

    router.post('/', () => {
      actionCalled = true
      return new Response('ok')
    })

    let boundary = '----WebKitFormBoundary1234567890'

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: [
          `--${boundary}`,
          'Content-Disposition: form-data; name="file1"; filename="test1.txt"',
          'Content-Type: text/plain',
          '',
          'test1',
          `--${boundary}`,
          'Content-Disposition: form-data; name="file2"; filename="test2.txt"',
          'Content-Type: text/plain',
          '',
          'test2',
          `--${boundary}--`,
        ].join('\r\n'),
      })
    }, MaxFilesExceededError)

    assert.equal(actionCalled, false)
  })

  it('does not suppress maxHeaderSize errors when suppressErrors is true', async () => {
    let actionCalled = false
    let router = createRouter({
      middleware: [formData({ suppressErrors: true, maxHeaderSize: 4 * 1024 })],
    })

    router.post('/', () => {
      actionCalled = true
      return new Response('ok')
    })

    let boundary = '----WebKitFormBoundary1234567890'

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: [
          `--${boundary}`,
          'Content-Disposition: form-data; name="field1"',
          'X-Large-Header: ' + 'X'.repeat(6 * 1024),
          '',
          'value1',
          `--${boundary}--`,
        ].join('\r\n'),
      })
    }, MaxHeaderSizeExceededError)

    assert.equal(actionCalled, false)
  })

  it('does not suppress maxFileSize errors when suppressErrors is true', async () => {
    let actionCalled = false
    let router = createRouter({
      middleware: [formData({ suppressErrors: true, maxFileSize: 4 })],
    })

    router.post('/', () => {
      actionCalled = true
      return new Response('ok')
    })

    let boundary = '----WebKitFormBoundary1234567890'

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: [
          `--${boundary}`,
          'Content-Disposition: form-data; name="file1"; filename="test1.txt"',
          'Content-Type: text/plain',
          '',
          'hello',
          `--${boundary}--`,
        ].join('\r\n'),
      })
    }, MaxFileSizeExceededError)

    assert.equal(actionCalled, false)
  })

  it('does not suppress maxParts errors when suppressErrors is true', async () => {
    let actionCalled = false
    let router = createRouter({
      middleware: [formData({ suppressErrors: true, maxParts: 2 })],
    })

    router.post('/', () => {
      actionCalled = true
      return new Response('ok')
    })

    let boundary = '----WebKitFormBoundary1234567890'

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: [
          `--${boundary}`,
          'Content-Disposition: form-data; name="field1"',
          '',
          'value1',
          `--${boundary}`,
          'Content-Disposition: form-data; name="file1"; filename="test1.txt"',
          'Content-Type: text/plain',
          '',
          'test1',
          `--${boundary}`,
          'Content-Disposition: form-data; name="field2"',
          '',
          'value2',
          `--${boundary}--`,
        ].join('\r\n'),
      })
    }, MaxPartsExceededError)

    assert.equal(actionCalled, false)
  })

  it('does not suppress maxTotalSize errors when suppressErrors is true', async () => {
    let actionCalled = false
    let router = createRouter({
      middleware: [formData({ suppressErrors: true, maxTotalSize: 9 })],
    })

    router.post('/', () => {
      actionCalled = true
      return new Response('ok')
    })

    let boundary = '----WebKitFormBoundary1234567890'

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: [
          `--${boundary}`,
          'Content-Disposition: form-data; name="field1"',
          '',
          'hello',
          `--${boundary}`,
          'Content-Disposition: form-data; name="file1"; filename="test1.txt"',
          'Content-Type: text/plain',
          '',
          'world',
          `--${boundary}--`,
        ].join('\r\n'),
      })
    }, MaxTotalSizeExceededError)

    assert.equal(actionCalled, false)
  })

  it('invokes a custom `uploadHandler` for file uploads', async (t) => {
    let uploadHandler = t.mock.fn<FileUploadHandler>()

    let router = createRouter({
      middleware: [formData({ uploadHandler })],
    })

    router.post('/', () => new Response('home'))

    let boundary = '----WebKitFormBoundary1234567890'
    let fileType = normalizeFileType('text/plain')
    let response = await router.fetch('https://remix.run/', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file1"; filename="test1.txt"',
        `Content-Type: ${fileType}`,
        '',
        'test 1',
        `--${boundary}`,
        'Content-Disposition: form-data; name="file2"; filename="test2.txt"',
        `Content-Type: ${fileType}`,
        '',
        'test 2',
        `--${boundary}--`,
      ].join('\r\n'),
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'home')

    assert.equal(uploadHandler.mock.calls.length, 2)

    let call0 = uploadHandler.mock.calls[0]
    let upload1 = call0.arguments[0]
    assert.equal(upload1.fieldName, 'file1')
    assert.equal(upload1.name, 'test1.txt')
    assert.equal(upload1.type, fileType)
    assert.equal(await upload1.text(), 'test 1')

    let call1 = uploadHandler.mock.calls[1]
    let upload2 = call1.arguments[0]
    assert.equal(upload2.fieldName, 'file2')
    assert.equal(upload2.name, 'test2.txt')
    assert.equal(upload2.type, fileType)
    assert.equal(await upload2.text(), 'test 2')
  })

  it('is a no-op when FormData has already been parsed by an earlier middleware', async (t) => {
    let firstUploadHandler = t.mock.fn<FileUploadHandler>((upload) => `first:${upload.name}`)
    let secondUploadHandler = t.mock.fn<FileUploadHandler>((upload) => `second:${upload.name}`)

    let router = createRouter({
      middleware: [
        formData({ uploadHandler: firstUploadHandler }),
        formData({ uploadHandler: secondUploadHandler }),
      ],
    })

    router.post('/', (context) =>
      Response.json({
        file: context.get(FormData).get('file'),
      }),
    )

    let boundary = '----WebKitFormBoundary1234567890'
    let response = await router.fetch('https://remix.run/', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="test.txt"',
        'Content-Type: text/plain',
        '',
        'test',
        `--${boundary}--`,
      ].join('\r\n'),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      file: 'first:test.txt',
    })
    assert.equal(firstUploadHandler.mock.calls.length, 1)
    assert.equal(secondUploadHandler.mock.calls.length, 0)
  })

  it('is a no-op when FormData has already been parsed by earlier request pipeline middleware', async (t) => {
    let globalUploadHandler = t.mock.fn<FileUploadHandler>((upload) => `global:${upload.name}`)
    let routeUploadHandler = t.mock.fn<FileUploadHandler>((upload) => `route:${upload.name}`)

    let router = createRouter({
      middleware: [formData({ uploadHandler: globalUploadHandler })],
    })

    router.post('/', {
      middleware: [formData({ uploadHandler: routeUploadHandler })],
      handler(context) {
        return Response.json({
          file: context.get(FormData).get('file'),
        })
      },
    })

    let boundary = '----WebKitFormBoundary1234567890'
    let response = await router.fetch('https://remix.run/', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="test.txt"',
        'Content-Type: text/plain',
        '',
        'test',
        `--${boundary}--`,
      ].join('\r\n'),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      file: 'global:test.txt',
    })
    assert.equal(globalUploadHandler.mock.calls.length, 1)
    assert.equal(routeUploadHandler.mock.calls.length, 0)
  })
})
