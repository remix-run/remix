import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'

describe('router', () => {
  it('streams frame fallbacks and resolved templates incrementally', async () => {
    let response = await router.fetch(new Request('http://localhost/'))

    assert.equal(response.status, 200)
    assert.ok(response.body)

    let chunks = readChunks(response.body)

    let initial = await readUntil(
      chunks,
      (html) => html.includes('Loading sidebar…') && html.includes('Loading activity…'),
    )
    assert.ok(initial.includes('Loading sidebar…'))
    assert.ok(initial.includes('Loading activity…'))
    assert.ok(!initial.includes('This content is rendered by <code>/frames/sidebar</code>.'))
    assert.ok(!initial.includes('Rendered by <code>/frames/activity</code>'))
    assert.equal(countTemplates(initial), 0)

    let sidebar = await readUntil(chunks, (html) =>
      html.includes('This content is rendered by <code>/frames/sidebar</code>.'),
    )
    assert.ok(sidebar.includes('<template'))
    assert.ok(sidebar.includes('This content is rendered by <code>/frames/sidebar</code>.'))
    assert.ok(!sidebar.includes('Rendered by <code>/frames/activity</code>'))
    assert.ok(!sidebar.includes('Nested frame with a hydrated counter:'))

    let activity = await readUntil(chunks, (html) =>
      html.includes('Rendered by <code>/frames/activity</code>'),
    )
    assert.ok(activity.includes('Rendered by <code>/frames/activity</code>'))
    assert.ok(activity.includes('Loading detail…'))
    assert.ok(!activity.includes('Nested frame with a hydrated counter:'))

    let detail = await readUntil(chunks, (html) =>
      html.includes('Nested frame with a hydrated counter:'),
    )
    assert.ok(detail.includes('Nested frame with a hydrated counter:'))
    assert.ok(detail.includes('Loading server time…'))
    assert.ok(!detail.includes('Server time'))
    assert.ok(!detail.includes('<\\/template'))

    let time = await readUntil(chunks, (html) => html.includes('Server time'))
    assert.ok(time.includes('Server time'))
    assert.ok(time.includes('In a frame'))
    assert.ok(!time.includes('<\\/template'))
  })
})

async function* readChunks(stream: ReadableStream<Uint8Array>): AsyncGenerator<string, void, void> {
  let reader = stream.getReader()
  let decoder = new TextDecoder()

  try {
    while (true) {
      let { done, value } = await reader.read()
      if (done) break
      yield decoder.decode(value, { stream: true })
    }

    let final = decoder.decode()
    if (final) yield final
  } finally {
    reader.releaseLock()
  }
}

async function readUntil(
  chunks: AsyncGenerator<string, void, void>,
  predicate: (html: string) => boolean,
): Promise<string> {
  let html = ''

  while (true) {
    let result = await chunks.next()
    assert.equal(result.done, false)
    html += result.value
    if (predicate(html)) return html
  }
}

function countTemplates(html: string): number {
  return html.match(/<template\b/g)?.length ?? 0
}
