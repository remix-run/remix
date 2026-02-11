import * as assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { FormDataParseError, type FileUploadHandler } from '@remix-run/form-data-parser'
import { createRouter } from '@remix-run/fetch-router'

import { formData } from './form-data.ts'

describe('formData middleware', () => {
  it('parses application/x-www-form-urlencoded form data from the request body', async () => {
    let router = createRouter({
      middleware: [formData()],
    })

    router.post('/', (context) => {
      let entries = Object.fromEntries(context.formData.entries())
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
      let entries = Object.fromEntries(context.formData.entries())
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

  it('provides context.files on a POST with a multipart/form-data body', async () => {
    let router = createRouter({
      middleware: [formData()],
    })

    router.post('/', (context) => {
      let file1 = context.files?.get('file1')
      let file2 = context.files?.get('file2')

      return Response.json({
        file1: {
          name: file1?.name,
          type: file1?.type,
        },
        file2: {
          name: file2?.name,
          type: file2?.type,
        },
      })
    })

    let boundary = '----WebKitFormBoundary1234567890'
    let response = await router.fetch('https://remix.run/', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file1"; filename="test1.txt"',
        'Content-Type: text/plain',
        '',
        'test 1',
        `--${boundary}`,
        'Content-Disposition: form-data; name="file2"; filename="test2.txt"',
        'Content-Type: text/plain',
        '',
        'test 2',
        `--${boundary}--`,
      ].join('\r\n'),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      file1: {
        name: 'test1.txt',
        type: 'text/plain',
      },
      file2: {
        name: 'test2.txt',
        type: 'text/plain',
      },
    })
  })

  it('throws when the request body is malformed multipart/form-data', async () => {
    let router = createRouter({
      middleware: [formData()],
    })

    router.post('/', (context) => Response.json(context.formData))

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
      let entries = Object.fromEntries(context.formData.entries())
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

  it('sets context.formData to an empty FormData when parse errors are suppressed', async () => {
    let router = createRouter({
      middleware: [formData({ suppressErrors: true })],
    })

    router.post('/', (context) =>
      // Explicitly check that formData is defined and is a FormData instance
      Response.json({
        isDefined: context.formData !== undefined,
        isFormData: context.formData instanceof FormData,
        isEmpty: context.formData.entries().next().done,
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

  it('invokes a custom `uploadHandler` for file uploads', async () => {
    let uploadHandler = mock.fn<FileUploadHandler>()

    let router = createRouter({
      middleware: [formData({ uploadHandler })],
    })

    router.post('/', () => new Response('home'))

    let boundary = '----WebKitFormBoundary1234567890'
    let response = await router.fetch('https://remix.run/', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file1"; filename="test1.txt"',
        'Content-Type: text/plain',
        '',
        'test 1',
        `--${boundary}`,
        'Content-Disposition: form-data; name="file2"; filename="test2.txt"',
        'Content-Type: text/plain',
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
    assert.equal(upload1.type, 'text/plain')
    assert.equal(await upload1.text(), 'test 1')

    let call1 = uploadHandler.mock.calls[1]
    let upload2 = call1.arguments[0]
    assert.equal(upload2.fieldName, 'file2')
    assert.equal(upload2.name, 'test2.txt')
    assert.equal(upload2.type, 'text/plain')
    assert.equal(await upload2.text(), 'test 2')
  })
})
