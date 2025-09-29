import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { html } from './response.ts'

describe('html()', () => {
  it('creates a Response with HTML content-type header', async () => {
    let response = html('<h1>Hello</h1>')

    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(await response.text(), '<h1>Hello</h1>')
  })

  it('preserves custom headers from init', async () => {
    let response = html('<h1>Hello</h1>', {
      headers: { 'X-Custom': 'test' },
      status: 201,
    })

    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(response.headers.get('X-Custom'), 'test')
    assert.equal(response.status, 201)
  })

  it('allows overriding Content-Type header', async () => {
    let response = html('<h1>Hello</h1>', {
      headers: { 'Content-Type': 'text/plain' },
    })

    assert.equal(response.headers.get('Content-Type'), 'text/plain')
  })

  it('handles ReadableStream content without modification', async () => {
    let stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('<h1>Stream</h1>'))
        controller.close()
      },
    })

    let response = html(stream)

    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(await response.text(), '<h1>Stream</h1>')
  })

  describe('dedenting', () => {
    it('removes common leading whitespace from indented template literals', async () => {
      let indentedHtml = `
        <html>
          <head><title>Test</title></head>
          <body>
            <h1>Hello World</h1>
          </body>
        </html>
      `

      let response = html(indentedHtml)
      let result = await response.text()

      assert.equal(
        result,
        '<html>\n  <head><title>Test</title></head>\n  <body>\n    <h1>Hello World</h1>\n  </body>\n</html>',
      )
    })

    it('preserves relative indentation', async () => {
      let indentedHtml = `
          <div>
            <p>First paragraph</p>
              <span>Nested span</span>
            <p>Second paragraph</p>
          </div>
      `

      let response = html(indentedHtml)
      let result = await response.text()

      assert.equal(
        result,
        '<div>\n  <p>First paragraph</p>\n    <span>Nested span</span>\n  <p>Second paragraph</p>\n</div>',
      )
    })

    it('handles mixed tabs and spaces by counting characters', async () => {
      let mixedIndentHtml = `
\t\t<html>
\t\t  <body>
\t\t    <h1>Mixed</h1>
\t\t  </body>
\t\t</html>
      `

      let response = html(mixedIndentHtml)
      let result = await response.text()

      assert.equal(result, '<html>\n  <body>\n    <h1>Mixed</h1>\n  </body>\n</html>')
    })

    it('removes leading and trailing empty lines', async () => {
      let htmlWithEmptyLines = `

        <h1>Title</h1>
        <p>Content</p>


      `

      let response = html(htmlWithEmptyLines)
      let result = await response.text()

      assert.equal(result, '<h1>Title</h1>\n<p>Content</p>')
    })

    it('preserves empty lines within content', async () => {
      let htmlWithInternalEmptyLines = `
        <div>
          <p>First</p>

          <p>Second</p>
        </div>
      `

      let response = html(htmlWithInternalEmptyLines)
      let result = await response.text()

      assert.equal(result, '<div>\n  <p>First</p>\n\n  <p>Second</p>\n</div>')
    })

    it('handles single line content', async () => {
      let singleLine = '<h1>Single line</h1>'

      let response = html(singleLine)
      let result = await response.text()

      assert.equal(result, '<h1>Single line</h1>')
    })

    it('handles empty string', async () => {
      let response = html('')
      let result = await response.text()

      assert.equal(result, '')
    })

    it('handles content with no common indentation', async () => {
      let noIndentHtml = `<html>
  <body>
    <h1>No common indent</h1>
  </body>
</html>`

      let response = html(noIndentHtml)
      let result = await response.text()

      assert.equal(result, '<html>\n  <body>\n    <h1>No common indent</h1>\n  </body>\n</html>')
    })

    it('handles lines with only whitespace', async () => {
      let htmlWithWhitespaceLines = `
        <div>
          <p>Content</p>
          
          <p>More content</p>
        </div>
      `

      let response = html(htmlWithWhitespaceLines)
      let result = await response.text()

      assert.equal(result, '<div>\n  <p>Content</p>\n\n  <p>More content</p>\n</div>')
    })
  })
})
