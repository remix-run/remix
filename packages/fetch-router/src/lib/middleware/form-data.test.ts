import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter } from '../router.ts'
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
})
