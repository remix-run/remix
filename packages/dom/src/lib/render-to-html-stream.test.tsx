import { describe, expect, it } from 'vitest'
import { clientEntry } from '../index.ts'
import { renderToHTMLStream } from './render-to-html-stream.ts'

describe('renderToHTMLStream', () => {
  it('renders html with escaped text and serialized attributes', async () => {
    let stream = renderToHTMLStream(
      <main className="app" style={{ color: 'red', backgroundColor: 'black' }}>
        {'<hello>'}
      </main>,
    )
    let html = await readStream(stream)
    expect(html).toContain('<main')
    expect(html).toContain('class="app"')
    expect(html).toContain('style="color:red;background-color:black"')
    expect(html).toContain('&lt;hello&gt;</main>')
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

  it('streams each deferred frame template as it resolves', async () => {
    let resolveA = (_value: string) => {}
    let resolveB = (_value: string) => {}
    let frameA = new Promise<string>((resolve) => {
      resolveA = resolve
    })
    let frameB = new Promise<string>((resolve) => {
      resolveB = resolve
    })
    let stream = renderToHTMLStream(
      <main>
        <frame src="/a" fallback={<p>loading a</p>} />
        <frame src="/b" fallback={<p>loading b</p>} />
      </main>,
      {
        resolveFrame: async (src) => (src === '/a' ? frameA : frameB),
      },
    )

    let reader = stream.getReader()
    let decoder = new TextDecoder()
    let initial = ''
    let frameAId: null | string = null
    let frameBId: null | string = null
    while (!frameAId || !frameBId) {
      let read = await reader.read()
      if (read.done) break
      initial += decoder.decode(read.value, { stream: true })
      frameAId = initial.match(/<!-- f:([^ ]+) -->/)?.[1] ?? frameAId
      let frameMarkers = Array.from(initial.matchAll(/<!-- f:([^ ]+) -->/g))
      if (frameMarkers.length >= 2) {
        frameAId = frameMarkers[0]?.[1] ?? frameAId
        frameBId = frameMarkers[1]?.[1] ?? frameBId
      }
    }
    if (!frameAId || !frameBId) {
      throw new Error('expected two frame ids in initial chunk')
    }

    resolveB('<aside>done b</aside>')
    let firstTemplateHtml = await readUntil(
      reader,
      decoder,
      (html) => html.includes(`<template id="${frameBId}">`) || html.includes(`<template id="${frameAId}">`),
      100,
    )
    expect(firstTemplateHtml).toContain(`<template id="${frameBId}"><aside>done b</aside></template>`)
    expect(firstTemplateHtml.includes(`<template id="${frameAId}">`)).toBe(false)

    resolveA('<aside>done a</aside>')
    let rest = await readRemaining(reader, decoder)
    expect(firstTemplateHtml + rest).toContain(
      `<template id="${frameAId}"><aside>done a</aside></template>`,
    )
  })

  it('passes abort signal to resolveFrame', async () => {
    let capturedSignal: null | AbortSignal = null
    let resolveFrameStarted = () => {}
    let frameStarted = new Promise<void>((resolve) => {
      resolveFrameStarted = resolve
    })
    let abortController = new AbortController()
    let stream = renderToHTMLStream(<frame src="/x" fallback={'wait'} />, {
      signal: abortController.signal,
      async resolveFrame(_src, signal) {
        capturedSignal = signal
        resolveFrameStarted()
        await new Promise((resolve) => setTimeout(resolve, 0))
        return '<div>late</div>'
      },
    })
    let readPromise = readStream(stream)
    await frameStarted
    abortController.abort(new Error('cancel frame'))
    await expect(readPromise).rejects.toThrow('cancel frame')
    if (!capturedSignal) {
      throw new Error('resolveFrame was not called')
    }
    expect((capturedSignal as any).aborted).toBe(true)
  })

  it('aborts while rendering frame JSX through the renderer bridge', async () => {
    let resolveFrameStarted = () => {}
    let started = new Promise<void>((resolve) => {
      resolveFrameStarted = resolve
    })
    let abortController = new AbortController()
    let stream = renderToHTMLStream(<frame src="/jsx" fallback={'wait'} />, {
      signal: abortController.signal,
      async resolveFrame(_src, signal) {
        resolveFrameStarted()
        await new Promise((resolve) => setTimeout(resolve, 0))
        if (signal.aborted) {
          return <div>late</div>
        }
        return <div>ok</div>
      },
    })
    let readPromise = readStream(stream)
    await started
    abortController.abort(new Error('cancel jsx frame'))
    await expect(readPromise).rejects.toThrow('cancel jsx frame')
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
    expect(html).toContain('<script type="application/json" id="rmx-data">{"f":{"')
    expect(html).toContain('"src":"/meta"')
  })

  it('injects hoisted head content into an existing head element', async () => {
    let html = await readStream(
      renderToHTMLStream(
        <html>
          <head>
            <meta charSet="utf-8" />
          </head>
          <body>
            <title>Late title</title>
          </body>
        </html>,
      ),
    )
    expect(html).toContain('<head><meta char-set="utf-8"><title>Late title</title></head>')
    expect(html.indexOf('<head>')).toBeLessThan(html.indexOf('<body>'))
  })

  it('inserts rmx-data script before closing body when html root exists', async () => {
    let html = await readStream(
      renderToHTMLStream(
        <html>
          <body>
            <frame src="/meta-script" fallback={'loading'} />
          </body>
        </html>,
        { resolveFrame: async () => '<div>ok</div>' },
      ),
    )
    let bodyClose = html.indexOf('</body>')
    let dataIndex = html.indexOf('id="rmx-data"')
    expect(dataIndex).toBeGreaterThan(-1)
    expect(dataIndex).toBeLessThan(bodyClose)
  })

  it('inserts rmx-data before closing html when body tag is missing', async () => {
    let html = await readStream(
      renderToHTMLStream(
        <html>
          <frame src="/only-html" fallback={'loading'} />
        </html>,
        { resolveFrame: async () => '<div>ok</div>' },
      ),
    )
    let htmlClose = html.indexOf('</html>')
    let dataIndex = html.indexOf('id="rmx-data"')
    expect(dataIndex).toBeGreaterThan(-1)
    expect(dataIndex).toBeLessThan(htmlClose)
  })

  it('prepends head and appends metadata for non-html roots', async () => {
    let html = await readStream(
      renderToHTMLStream(
        <main>
          <title>Title</title>
          <frame src="/rootless" fallback={'loading'} />
        </main>,
        { resolveFrame: async () => '<div>ok</div>' },
      ),
    )
    expect(html.startsWith('<head><title>Title</title></head>')).toBe(true)
    expect(html.endsWith('</script><template')).toBe(false)
    expect(html).toContain('id="rmx-data"')
  })

  it('omits metadata script when there are no frames', async () => {
    let html = await readStream(renderToHTMLStream(<main>plain</main>))
    expect(html.includes('id="rmx-data"')).toBe(false)
  })

  it('marks frame metadata as resolved when no fallback is provided', async () => {
    let html = await readStream(
      renderToHTMLStream(<frame src="/resolved" />, {
        resolveFrame: async () => '<div>resolved</div>',
      }),
    )
    expect(html).toContain('"status":"resolved"')
    expect(html).toContain('"src":"/resolved"')
    expect(html).toContain('<!-- f:')
    expect(html).toContain('<div>resolved</div>')
    expect(html.includes('<template id=')).toBe(false)
  })

  it('throws when frame boundaries are rendered without resolveFrame', async () => {
    let stream = renderToHTMLStream(<frame src="/x" fallback={<i>f</i>} />)
    await expect(readStream(stream)).rejects.toThrow('No resolveFrame provided')
  })

  it('includes frame name metadata when provided', async () => {
    let html = await readStream(
      renderToHTMLStream(<frame name="cart" src="/cart" fallback={'wait'} />, {
        resolveFrame: async () => '<aside>ready</aside>',
      }),
    )
    expect(html).toContain('"name":"cart"')
  })

  it('runs blocking resolved frame content through plugins', async () => {
    let html = await readStream(
      renderToHTMLStream(<frame src="/plugin-check" />, {
        resolveFrame: async () => (
          <section className="box" tabIndex={2}>
            ok
          </section>
        ),
      }),
    )
    expect(html).toContain('<section class="box" tabindex="2">ok</section>')
  })

  it('supports resolveFrame returning Uint8Array', async () => {
    let html = await readStream(
      renderToHTMLStream(<frame src="/u8" fallback={'wait'} />, {
        resolveFrame: async () => new TextEncoder().encode('<b>u8</b>'),
      }),
    )
    expect(html).toContain('<template id="')
    expect(html).toContain('<b>u8</b>')
  })

  it('supports resolveFrame returning ReadableStream and escapes template closers', async () => {
    let bytes = new TextEncoder().encode('<div>x</div></template><div>y</div>')
    let streamValue = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 7))
        controller.enqueue(bytes.slice(7))
        controller.close()
      },
    })
    let html = await readStream(
      renderToHTMLStream(<frame src="/stream" fallback={'wait'} />, {
        resolveFrame: async () => streamValue,
      }),
    )
    expect(html).toContain('<template id="')
    expect(html).toContain('<\\/template>')
  })

  it('serializes boolean attributes and skips null/false/function attributes', async () => {
    let html = await readStream(
      renderToHTMLStream(
        <main hidden={true} disabled={false} data-empty={null as any} onclick={() => {}}>
          ok
        </main>,
      ),
    )
    expect(html).toContain('<main hidden>')
    expect(html).not.toContain('disabled=')
    expect(html).not.toContain('data-empty=')
    expect(html).not.toContain('onclick=')
  })

  it('hoists managed script tags that use innerHTML bodies', async () => {
    let html = await readStream(
      renderToHTMLStream(
        <html>
          <body>
            <script type="application/ld+json" innerHTML={'{"name":"x"}'} />
          </body>
        </html>,
      ),
    )
    expect(html).toContain('<head><script type="application/ld+json">{"name":"x"}</script></head>')
  })

  it('handles empty and zero-length streamed frame chunks', async () => {
    let encoder = new TextEncoder()
    let streamValue = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array())
        controller.enqueue(new Uint8Array())
        controller.enqueue(encoder.encode('<b>from-stream</b>'))
        controller.close()
      },
    })
    let html = await readStream(
      renderToHTMLStream(<frame src="/empty-stream" fallback={'wait'} />, {
        resolveFrame: async () => streamValue,
      }),
    )
    expect(html).toContain('<template id="')
    expect(html).toContain('<b>from-stream</b>')
  })

  it('emits an empty template when streamed frame has no bytes', async () => {
    let emptyStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      },
    })
    let html = await readStream(
      renderToHTMLStream(<frame src="/totally-empty" fallback={'wait'} />, {
        resolveFrame: async () => emptyStream,
      }),
    )
    expect(html).toContain('<template id="')
    expect(html).toContain('</template>')
  })

  it('aborts blocking frame boundaries before deferred open content is emitted', async () => {
    let resolveFrameValue = (_value: string) => {}
    let pending = new Promise<string>((resolve) => {
      resolveFrameValue = resolve
    })
    let controller = new AbortController()
    let stream = renderToHTMLStream(<frame src="/blocking-abort" />, {
      signal: controller.signal,
      resolveFrame: async () => pending,
    })
    let readPromise = readStream(stream)
    controller.abort(new Error('abort blocking open'))
    resolveFrameValue('<div>late</div>')
    await expect(readPromise).rejects.toThrow('abort blocking open')
  })

  it('closes deferred frame template when a named template appears mid-stream', async () => {
    let encoder = new TextEncoder()
    let streamValue = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('<div>start'))
        controller.enqueue(encoder.encode('</div><template id="late">x</template><p>tail</p>'))
        controller.close()
      },
    })
    let html = await readStream(
      renderToHTMLStream(<frame src="/named-template-stream" fallback={'wait'} />, {
        resolveFrame: async () => streamValue,
      }),
    )
    expect(html).toContain('<template id="')
    expect(html).toContain('<div>start</div></template><template id="late">x</template><p>tail</p>')
  })

  it('runs deferred resolved frame content through plugins', async () => {
    let html = await readStream(
      renderToHTMLStream(<frame src="/deferred-plugin" fallback={'wait'} />, {
        resolveFrame: async () => <aside className="pane" tabIndex={3}>done</aside>,
      }),
    )
    expect(html).toContain('<template id="')
    expect(html).toContain('<aside class="pane" tabindex="3">done</aside>')
  })

  it('includes nested frame metadata when resolveFrame returns JSX with nested pending frame', async () => {
    let html = await readStream(
      renderToHTMLStream(<frame src="/outer" fallback={'loading outer'} />, {
        resolveFrame: async (src) => {
          if (src === '/outer') {
            return (
              <section>
                <frame src="/inner" fallback={'loading inner'} />
              </section>
            )
          }
          if (src === '/inner') {
            return '<div>inner done</div>'
          }
          return '<div>unknown</div>'
        },
      }),
    )
    expect(html).toContain('"src":"/outer"')
    expect(html).toContain('"src":"/inner"')
  })

  it('streams nested non-blocking frames in separate chunks for blocking outer frames', async () => {
    let resolveInner = (_value: string) => {}
    let innerPromise = new Promise<string>((resolve) => {
      resolveInner = resolve
    })
    let stream = renderToHTMLStream(<frame src="/outer" />, {
      resolveFrame: async (src) => {
        if (src === '/outer') {
          return renderToHTMLStream(
            <section>
              Outer
              <frame src="/inner" fallback={<span>Inner loading</span>} />
            </section>,
            {
              resolveFrame: async (nestedSrc) => {
                if (nestedSrc === '/inner') return innerPromise
                return '<div>unexpected</div>'
              },
            },
          )
        }
        if (src === '/inner') return innerPromise
        return '<div>unexpected</div>'
      },
    })
    let reader = stream.getReader()
    let decoder = new TextDecoder()
    let first = await readUntil(
      reader,
      decoder,
      (html) => html.includes('Inner loading') || html.includes('<template id="'),
      100,
    )
    expect(first).toContain('Outer')
    expect(first).toContain('Inner loading')
    expect(first.includes('<template id="')).toBe(false)

    resolveInner('<article>Inner done</article>')
    let second = await readUntil(reader, decoder, (html) => html.includes('<template id="'), 100)
    expect(second).toContain('<template id="')
    expect(second).toContain('<article>Inner done</article>')
  })

  it('streams nested non-blocking frames in separate chunks for non-blocking outer frames', async () => {
    let resolveOuter = (_value: ReadableStream<Uint8Array>) => {}
    let resolveInner = (_value: string) => {}
    let outerPromise = new Promise<ReadableStream<Uint8Array>>((resolve) => {
      resolveOuter = resolve
    })
    let innerPromise = new Promise<string>((resolve) => {
      resolveInner = resolve
    })
    let stream = renderToHTMLStream(<frame src="/outer" fallback={'Loading outer'} />, {
      resolveFrame: async (src) => {
        if (src === '/outer') return outerPromise
        if (src === '/inner') return innerPromise
        return '<div>unexpected</div>'
      },
    })
    let reader = stream.getReader()
    let decoder = new TextDecoder()
    let initial = await readUntil(reader, decoder, (html) => html.includes('Loading outer'), 100)
    expect(initial).toContain('Loading outer')

    resolveOuter(
      renderToHTMLStream(
        <section>
          Outer
          <frame src="/inner" fallback={<span>Inner loading</span>} />
        </section>,
        {
          resolveFrame: async (src) => {
            if (src === '/inner') return innerPromise
            return '<div>unexpected</div>'
          },
        },
      ),
    )
    let second = await readUntil(reader, decoder, (html) => html.includes('<template id="'), 100)
    expect(second).toContain('<template id="')
    expect(second).toContain('Outer')
    expect(second).toContain('Inner loading')
    expect(second.includes('Inner done')).toBe(false)

    resolveInner('<article>Inner done</article>')
    let third = await readUntil(reader, decoder, (html) => html.includes('Inner done'), 100)
    expect(third).toContain('<template id="')
    expect(third).toContain('Inner done')
  })

  it('renders nested blocking frames in the first chunk for blocking outer frames', async () => {
    let resolveInner = (_value: string) => {}
    let innerPromise = new Promise<string>((resolve) => {
      resolveInner = resolve
    })
    let stream = renderToHTMLStream(<frame src="/outer" />, {
      resolveFrame: async (src) => {
        if (src === '/outer') {
          return renderToHTMLStream(
            <section>
              Outer
              <frame src="/inner" />
            </section>,
            {
              resolveFrame: async (nestedSrc) => {
                if (nestedSrc === '/inner') return innerPromise
                return '<div>unexpected</div>'
              },
            },
          )
        }
        if (src === '/inner') return innerPromise
        return '<div>unexpected</div>'
      },
    })
    let reader = stream.getReader()
    let decoder = new TextDecoder()
    resolveInner('<article>Inner done</article>')
    let first = await readUntil(
      reader,
      decoder,
      (html) => html.includes('Outer') && html.includes('Inner done'),
      200,
    )
    expect(first).toContain('Outer')
    expect(first).toContain('<article>Inner done</article>')
    expect(first.includes('<template id="')).toBe(false)
  })

  it('emits non-blocking outer template with nested blocking child resolved content', async () => {
    let resolveOuter = (_value: ReadableStream<Uint8Array>) => {}
    let resolveInner = (_value: string) => {}
    let outerPromise = new Promise<ReadableStream<Uint8Array>>((resolve) => {
      resolveOuter = resolve
    })
    let innerPromise = new Promise<string>((resolve) => {
      resolveInner = resolve
    })
    let stream = renderToHTMLStream(<frame src="/outer" fallback={'Loading outer'} />, {
      resolveFrame: async (src) => {
        if (src === '/outer') return outerPromise
        if (src === '/inner') return innerPromise
        return '<div>unexpected</div>'
      },
    })
    let reader = stream.getReader()
    let decoder = new TextDecoder()
    let initial = await readUntil(reader, decoder, (html) => html.includes('Loading outer'), 100)
    expect(initial).toContain('Loading outer')

    resolveOuter(
      renderToHTMLStream(
        <section>
          Outer
          <frame src="/inner" />
        </section>,
        {
          resolveFrame: async (src) => {
            if (src === '/inner') return innerPromise
            return '<div>unexpected</div>'
          },
        },
      ),
    )
    resolveInner('<article>Inner done</article>')
    let next = await readUntil(
      reader,
      decoder,
      (html) => html.includes('<template id="') && html.includes('Inner done'),
      200,
    )
    expect(next).toContain('<template id="')
    expect(next).toContain('Outer')
    expect(next).toContain('<article>Inner done</article>')
    expect(next.includes('Loading inner')).toBe(false)
  })

  it('throws when frame src is not a string', async () => {
    let stream = renderToHTMLStream(<frame src={123 as any} fallback={'x'} />)
    await expect(readStream(stream)).rejects.toThrow('<frame> requires a "src" string prop')
  })

  it('honors already-aborted signal before streaming starts', async () => {
    let controller = new AbortController()
    controller.abort(new Error('already stopped'))
    let stream = renderToHTMLStream(<frame src="/x" fallback={'wait'} />, {
      signal: controller.signal,
      resolveFrame: async () => '<div>late</div>',
    })
    await expect(readStream(stream)).rejects.toThrow('already stopped')
  })

  it('consumes framework-only props and normalizes style variants', async () => {
    let html = await readStream(
      renderToHTMLStream(
        <main>
          <div mix={{} as any} style={{ '--x': 1, color: 'red', width: Infinity as any } as any} />
          <p style={'display:block' as any} />
          <span style={123 as any} />
        </main>,
      ),
    )
    expect(html).toContain('<div style="--x:1;color:red"></div>')
    expect(html).toContain('<p style="display:block"></p>')
    expect(html).toContain('<span></span>')
    expect(html.includes(' mix=')).toBe(false)
  })

  it('normalizes key HTML and SVG attribute aliases through plugins', async () => {
    let html = await readStream(
      renderToHTMLStream(
        <main tabIndex={1} acceptCharset="utf-8" httpEquiv="x">
          <svg viewBox="0 0 10 10">
            <use xlinkHref="#icon" />
          </svg>
        </main>,
      ),
    )
    expect(html).toContain('tabindex="1"')
    expect(html).toContain('accept-charset="utf-8"')
    expect(html).toContain('http-equiv="x"')
    expect(html).toContain('<svg viewBox="0 0 10 10">')
    expect(html).toContain('<use xlink:href="#icon"></use>')
  })

  it('hoists managed script tags and keeps non-managed scripts inline', async () => {
    let html = await readStream(
      renderToHTMLStream(
        <html>
          <body>
            <script type="application/ld+json">{'{"a":1}'}</script>
            <script type="module">{'console.log(1)'}</script>
          </body>
        </html>,
      ),
    )
    expect(html).toContain('<head><script type="application/ld+json">{"a":1}</script></head>')
    expect(html).toContain('<script type="module">console.log(1)</script>')
  })

  it('emits hydration markers and rmx-data.h for client entries', async () => {
    let CounterEntry = clientEntry(
      '/entries/counter.js#Counter',
      () => (props: { label: string }) => <button>{props.label}</button>,
    )
    let html = await readStream(
      renderToHTMLStream(
        <main>
          <CounterEntry label="hello" />
        </main>,
      ),
    )
    let hydrationId = html.match(/<!-- rmx:h:([^ ]+) -->/)?.[1]
    if (!hydrationId) throw new Error('missing hydration marker')
    expect(html).toContain(`<!-- rmx:h:${hydrationId} --><button>hello</button><!-- /rmx:h -->`)
    expect(html).toContain(
      `<script type="application/json" id="rmx-data">{"h":{"${hydrationId}":{"moduleUrl":"/entries/counter.js","exportName":"Counter","props":{"label":"hello"}}}}</script>`,
    )
  })

  it('emits both h and f payloads when entries and frames coexist', async () => {
    let ClientWidget = clientEntry('/entries/widget.js#Widget', () => () => <div>client</div>)
    let html = await readStream(
      renderToHTMLStream(
        <main>
          <ClientWidget />
          <frame src="/sidebar" fallback={<p>loading</p>} />
        </main>,
        {
          resolveFrame: async () => '<aside>done</aside>',
        },
      ),
    )
    expect(html).toContain('"h":{')
    expect(html).toContain('"f":{')
  })

  it('escapes script-significant characters in hydration payload json', async () => {
    let EscapeEntry = clientEntry('/entries/escape.js#Escape', () => (props: { text: string }) => (
      <div>{props.text}</div>
    ))
    let html = await readStream(
      renderToHTMLStream(<EscapeEntry text={'</script><x>'} />),
    )
    expect(html).toContain('\\u003c/script>\\u003cx>')
  })

  it('renders regular components without hydration boundaries', async () => {
    function Plain() {
      return () => <section>plain component</section>
    }
    let html = await readStream(
      renderToHTMLStream(
        <main>
          <Plain />
        </main>,
      ),
    )
    expect(html).toContain('<main><section>plain component</section></main>')
    expect(html).not.toContain('rmx:h:')
  })

  it('throws when clientEntry receives non-object props', async () => {
    let BadEntry = clientEntry('/entries/bad-props.js#Bad', () => () => <div>bad</div>)
    let badElement = {
      $rmx: true as const,
      type: BadEntry as unknown,
      key: null,
      props: [] as unknown as Record<string, unknown>,
    }
    await expect(readStream(renderToHTMLStream(badElement as any))).rejects.toThrow(
      'clientEntry props must be an object',
    )
  })

  it('streams named templates discovered in the first resolved frame chunk', async () => {
    let encoder = new TextEncoder()
    let streamValue = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode('<div>before</div><template id="late-inline"><i>x</i></template>'),
        )
        controller.enqueue(encoder.encode('<p>tail</p>'))
        controller.close()
      },
    })
    let html = await readStream(
      renderToHTMLStream(<frame src="/named-first-chunk" fallback={'wait'} />, {
        resolveFrame: async () => streamValue,
      }),
    )
    expect(html).toContain('<template id="')
    expect(html).toContain('<template id="late-inline"><i>x</i></template>')
    expect(html).toContain('<p>tail</p>')
  })
})

async function readStream(stream: ReadableStream<Uint8Array>) {
  let reader = stream.getReader()
  let decoder = new TextDecoder()
  return readRemaining(reader, decoder)
}

async function readRemaining(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
) {
  let output = ''
  while (true) {
    let result = await reader.read()
    if (result.done) break
    output += decoder.decode(result.value, { stream: true })
  }
  output += decoder.decode()
  return output
}

async function readWithTimeout<value>(promise: Promise<value>, timeoutMs: number) {
  let timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs)
  })
  return await Promise.race([promise, timeout])
}

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  done: (html: string) => boolean,
  timeoutMs: number,
) {
  let html = ''
  while (true) {
    let next = await readWithTimeout(reader.read(), timeoutMs)
    if (!next || next.done) return html
    html += decoder.decode(next.value, { stream: true })
    if (done(html)) return html
  }
}
