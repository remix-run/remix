import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseParams } from './param-values.ts'

describe('parseParams', () => {
  it('correctly parses a string of parameters for a Content-Type header', () => {
    assert.deepEqual(parseParams('text/html; charset=utf-8'), [
      ['text/html', undefined],
      ['charset', 'utf-8'],
    ])
    assert.deepEqual(parseParams('application/json'), [['application/json', undefined]])
    assert.deepEqual(parseParams('multipart/form-data; boundary=----WebKitFormBoundaryABC123'), [
      ['multipart/form-data', undefined],
      ['boundary', '----WebKitFormBoundaryABC123'],
    ])
  })

  it('correctly parses a string of parameters for a Content-Disposition header', () => {
    assert.deepEqual(parseParams('form-data; name=fieldName'), [
      ['form-data', undefined],
      ['name', 'fieldName'],
    ])
    assert.deepEqual(parseParams('form-data; name="fieldName"; filename="filename.jpg"'), [
      ['form-data', undefined],
      ['name', 'fieldName'],
      ['filename', 'filename.jpg'],
    ])
    assert.deepEqual(
      parseParams("attachment; filename=photo.jpg; filename*=UTF-8''%E7%85%A7%E7%89%87.jpg"),
      [
        ['attachment', undefined],
        ['filename', 'photo.jpg'],
        ['filename*', "UTF-8''%E7%85%A7%E7%89%87.jpg"],
      ],
    )
    assert.deepEqual(
      parseParams('attachment; filename="photo.jpg"; filename*="UTF-8\'\'%E7%85%A7%E7%89%87.jpg"'),
      [
        ['attachment', undefined],
        ['filename', 'photo.jpg'],
        ['filename*', "UTF-8''%E7%85%A7%E7%89%87.jpg"],
      ],
    )
  })

  it('correctly parses a string of parameters for a Set-Cookie header', () => {
    assert.deepEqual(parseParams('session_id=abc123; Path=/; HttpOnly; Secure'), [
      ['session_id', 'abc123'],
      ['Path', '/'],
      ['HttpOnly', undefined],
      ['Secure', undefined],
    ])
    assert.deepEqual(parseParams('user_pref="dark_mode"; Max-Age=31536000; SameSite=Lax'), [
      ['user_pref', 'dark_mode'],
      ['Max-Age', '31536000'],
      ['SameSite', 'Lax'],
    ])
    assert.deepEqual(
      parseParams(
        'preferences={"font":"Arial","size":"12pt"}; Expires=Fri, 31 Dec 2023 23:59:59 GMT',
      ),
      [
        ['preferences', '{"font":"Arial","size":"12pt"}'],
        ['Expires', 'Fri, 31 Dec 2023 23:59:59 GMT'],
      ],
    )
    assert.deepEqual(parseParams('cart_items="[\\"item1\\",\\"item2\\"]"; Path=/cart; HttpOnly'), [
      ['cart_items', '["item1","item2"]'],
      ['Path', '/cart'],
      ['HttpOnly', undefined],
    ])
    assert.deepEqual(parseParams('account_type="premium,\\"gold\\""; Domain=example.com; Secure'), [
      ['account_type', 'premium,"gold"'],
      ['Domain', 'example.com'],
      ['Secure', undefined],
    ])
    assert.deepEqual(
      parseParams('a2f_token=987654; Path=/2fa; Secure; HttpOnly; SameSite=Strict; Max-Age=300'),
      [
        ['a2f_token', '987654'],
        ['Path', '/2fa'],
        ['Secure', undefined],
        ['HttpOnly', undefined],
        ['SameSite', 'Strict'],
        ['Max-Age', '300'],
      ],
    )
  })
})
