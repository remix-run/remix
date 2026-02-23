import { describe, expect, it } from 'vitest'
import { renderToHTMLStream } from './render-to-html-stream.ts'

describe('renderToHTMLStream', () => {
  it('renders html with escaped text and serialized attributes', async () => {
    let stream = renderToHTMLStream(
      <main className="app" style={{ color: 'red', backgroundColor: 'black' }}>
        {'<hello>'}
      </main>,
    )
    let html = await readStream(stream)
    expect(html).toBe('<main class="app" style="color:red;background-color:black">&lt;hello&gt;</main>')
  })

  it('supports raw innerHTML and void elements', async () => {
    let stream = renderToHTMLStream(
      <section>
        <img src="/logo.png" />
        <div innerHTML="<strong>ok</strong>" />
      </section>,
    )
    let html = await readStream(stream)
    expect(html).toBe('<section><img src="/logo.png"><div><strong>ok</strong></div></section>')
  })

  it('calls onError when rendering fails', async () => {
    let errors: unknown[] = []
    let stream = renderToHTMLStream(Promise.reject(new Error('boom')), {
      onError(error) {
        errors.push(error)
      },
    })
    await expect(readStream(stream)).rejects.toThrow('boom')
    expect(errors.length).toBe(1)
  })

  it('aborts when signal is cancelled', async () => {
    let resolveValue = (_value: unknown) => {}
    let pending = new Promise((resolve) => {
      resolveValue = resolve
    })
    let controller = new AbortController()
    let stream = renderToHTMLStream(
      <root>
        {'ready'}
        {pending as any}
      </root>,
      { signal: controller.signal },
    )
    controller.abort(new Error('stop'))
    await expect(readStream(stream)).rejects.toThrow('stop')
    resolveValue(<tail />)
  })

  it('streams deferred template in a later chunk', async () => {
    let resolveFrameValue = (_value: string) => {}
    let deferredFrame = new Promise<string>((resolve) => {
      resolveFrameValue = resolve
    })
    let stream = renderToHTMLStream(
      <main>
        <frame src="/sidebar" fallback={<p>loading</p>} />
      </main>,
      {
        resolveFrame: async () => deferredFrame,
      },
    )
    let reader = stream.getReader()
    let decoder = new TextDecoder()
    let initial = ''
    let frameId: null | string = null
    while (!frameId) {
      let read = await reader.read()
      if (read.done) break
      initial += decoder.decode(read.value, { stream: true })
      frameId = initial.match(/<!-- f:([^ ]+) -->/)?.[1] ?? null
    }
    if (!frameId) {
      throw new Error('expected a frame id marker in initial chunk')
    }
    expect(initial.includes(`<template id="${frameId}">`)).toBe(false)

    resolveFrameValue('<aside>done</aside>')
    let rest = await readRemaining(reader, decoder)
    expect(initial + rest).toContain(`<main><!-- f:${frameId} --><p>loading</p><!-- /f --></main>`)
    expect(rest.includes(`<template id="${frameId}"><aside>done</aside></template>`)).toBe(true)
    expect(initial + rest).toContain(
      `<script type="application/json" id="rmx-data">{"f":{"${frameId}":{"status":"pending","src":"/sidebar"}}}</script>`,
    )
  })

  it('passes abort signal to resolveFrame', async () => {
    let capturedSignal: null | AbortSignal = null
    let resolveFrameStarted = () => {}
    let frameStarted = new Promise<void>((resolve) => {
      resolveFrameStarted = resolve
    })
    let abortController = new AbortController()
    let stream = renderToHTMLStream(
      <frame src="/x" fallback={'wait'} />,
      {
        signal: abortController.signal,
        async resolveFrame(_src, signal) {
          capturedSignal = signal
          resolveFrameStarted()
          await new Promise((resolve) => setTimeout(resolve, 0))
          return '<div>late</div>'
        },
      },
    )
    let readPromise = readStream(stream)
    await frameStarted
    abortController.abort(new Error('cancel frame'))
    await expect(readPromise).rejects.toThrow('cancel frame')
    if (!capturedSignal) {
      throw new Error('resolveFrame was not called')
    }
    expect((capturedSignal as any).aborted).toBe(true)
  })

  it('hoists head elements and emits frame metadata script', async () => {
    let stream = renderToHTMLStream(
      <html>
        <body>
          <title>From body</title>
          <frame src="/meta" fallback={'loading'} />
        </body>
      </html>,
      { resolveFrame: async () => '<div>ok</div>' },
    )
    let html = await readStream(stream)
    expect(html).toContain('<head><title>From body</title></head>')
    expect(html).toContain(
      '<script type="application/json" id="rmx-data">{"f":{"',
    )
    expect(html).toContain('"src":"/meta"')
  })
})

async function readStream(stream: ReadableStream<Uint8Array>) {
  let reader = stream.getReader()
  let decoder = new TextDecoder()
  return readRemaining(reader, decoder)
}

async function readRemaining(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder) {
  let output = ''
  while (true) {
    let result = await reader.read()
    if (result.done) break
    output += decoder.decode(result.value, { stream: true })
  }
  output += decoder.decode()
  return output
}
