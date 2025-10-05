import * as assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { formData } from './form-data.ts'
import { createRoutes } from '../route-map.ts'
import { createRouter } from '../router.ts'
import { FormDataParseError, type FileUploadHandler } from '@remix-run/form-data-parser'

describe('formData', () => {
  it('parses multipart/form-data requests', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()

    router.use(formData())

    let parsed: FormData | undefined
    router.map(routes.home, ({ formData }) => {
      parsed = formData
      return new Response('Home')
    })

    let response = await router.fetch('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="text"',
        '',
        'Hello, World!',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    assert.ok(parsed!)
    assert.equal(parsed.get('text'), 'Hello, World!')
  })

  it('parses application/x-www-form-urlencoded requests', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()

    router.use(formData())

    let parsed: FormData | undefined
    router.map(routes.home, ({ formData }) => {
      parsed = formData
      return new Response('Home')
    })

    let response = await router.fetch('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'text=Hello%2C%20World!',
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    assert.ok(parsed!)
    assert.equal(parsed.get('text'), 'Hello, World!')
  })

  it('populates the files object for uploaded files', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()

    router.use(formData())

    let parsed: Record<string, File> | undefined
    router.map(routes.home, ({ files }) => {
      parsed = files
      return new Response('Home')
    })

    let response = await router.fetch('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file1"; filename="example1.txt"',
        'Content-Type: text/plain',
        '',
        'This is an example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file2"; filename="example2.txt"',
        'Content-Type: text/plain',
        '',
        'This is another example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    assert.ok(parsed!)
    assert.equal(parsed.file1.name, 'example1.txt')
    assert.equal(parsed.file1.type, 'text/plain')
    assert.equal(await parsed.file1.text(), 'This is an example file.')

    assert.equal(parsed.file2.name, 'example2.txt')
    assert.equal(parsed.file2.type, 'text/plain')
    assert.equal(await parsed.file2.text(), 'This is another example file.')
  })

  it('calls a custom uploadHandler for each uploaded file', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()

    let uploadHandler = mock.fn<FileUploadHandler>()
    router.use(formData({ uploadHandler }))

    router.map(routes.home, () => {
      return new Response('Home')
    })

    let response = await router.fetch('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file1"; filename="example1.txt"',
        'Content-Type: text/plain',
        '',
        'This is an example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    assert.equal(uploadHandler.mock.calls.length, 1)
    let firstFileUpload = uploadHandler.mock.calls[0].arguments[0]
    assert.equal(firstFileUpload.fieldName, 'file1')
    assert.equal(await firstFileUpload.text(), 'This is an example file.')
  })

  it('throws parse errors by default', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()

    router.use(formData())

    router.map(routes.home, () => {
      throw new Error('Parse error')
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'Hello, World!',
      })
    }, FormDataParseError)
  })

  it('suppresses parse errors when configured', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()

    router.use(formData({ suppressParseErrors: true }))

    router.map(routes.home, () => {
      return new Response('Home')
    })

    let response = await router.fetch('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: 'Hello, World!',
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
  })
})
