import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { formDataToPlainText, formDataToSearchParams } from '../lib/form-encoding.ts'

function createFormData(): FormData {
  let formData = new FormData()
  formData.append('note\r', 'one\ntwo\r\nthree')
  formData.append('upload', new File(['contents'], 'photo.png'))
  return formData
}

describe('form encoding', () => {
  it('encodes search params with CRLF line breaks and file names', () => {
    let params = formDataToSearchParams(createFormData())

    expect([...params]).toEqual([
      ['note\r\n', 'one\r\ntwo\r\nthree'],
      ['upload', 'photo.png'],
    ])
  })

  it('encodes text/plain bodies with CRLF line breaks and file names', () => {
    expect(formDataToPlainText(createFormData())).toBe(
      'note\r\n=one\r\ntwo\r\nthree\r\nupload=photo.png\r\n',
    )
  })
})
