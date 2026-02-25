import { afterEach, describe, expect, it } from 'vitest'
import { boot, clientEntry, css, on, type ComponentHandle } from '../../../index.ts'
import { renderToHTMLStream } from '../../../server.ts'
import { BeforeFrameApplyEvent } from '../../client/client-runtime.ts'

describe('hydration integration', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('hydrates SSR clientEntry output and preserves interactive text order', async () => {
    let CounterEntry = clientEntry(
      '/entries/counter.js#Counter',
      function Counter(handle: ComponentHandle, initial: number) {
        let count = initial
        return (props: { label: string }) => (
          <button
            type="button"
            mix={[
              on('click', () => {
                count++
                void handle.update()
              }),
            ]}
          >
            {props.label}: {count}
          </button>
        )
      },
    )
    let html = await readStream(
      renderToHTMLStream(
        <main>
          <CounterEntry setup={1} label="Count" />
        </main>,
      ),
    )
    document.body.innerHTML = html

    let runtime = boot({
      document,
      async loadModule(moduleUrl: string, exportName: string) {
        if (moduleUrl !== '/entries/counter.js' || exportName !== 'Counter') {
          throw new Error(`Unexpected entry request: ${moduleUrl}#${exportName}`)
        }
        return function Counter(handle: ComponentHandle, initial: number) {
          let count = initial
          return (props: { label: string }) => (
            <button
              type="button"
              mix={[
                on('click', () => {
                  count++
                  void handle.update()
                }),
              ]}
            >
              {props.label}: {count}
            </button>
          )
        }
      },
    })
    await runtime.ready()

    let button = document.querySelector('button')
    if (!button) throw new Error('missing hydrated button')
    expect(button.textContent).toBe('Count: 1')

    button.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(button.textContent).toBe('Count: 2')
  })

  it('hydrates consolidated server text into split dynamic text parts and updates correctly', async () => {
    let GreetingEntry = clientEntry(
      '/entries/greeting.js#Greeting',
      function Greeting(handle: ComponentHandle) {
        let who = 'world'
        return () => (
          <button
            type="button"
            mix={[
              on('click', () => {
                who = 'Ryan'
                void handle.update()
              }),
            ]}
          >
            {'Hello '}
            {who}
            {'!'}
          </button>
        )
      },
    )
    let html = await readStream(
      renderToHTMLStream(
        <main>
          <GreetingEntry />
        </main>,
      ),
    )
    document.body.innerHTML = html

    let runtime = boot({
      document,
      async loadModule(moduleUrl: string, exportName: string) {
        if (moduleUrl !== '/entries/greeting.js' || exportName !== 'Greeting') {
          throw new Error(`Unexpected entry request: ${moduleUrl}#${exportName}`)
        }
        return function Greeting(handle: ComponentHandle) {
          let who = 'world'
          return () => (
            <button
              type="button"
              mix={[
                on('click', () => {
                  who = 'Ryan'
                  void handle.update()
                }),
              ]}
            >
              {'Hello '}
              {who}
              {'!'}
            </button>
          )
        }
      },
    })
    await runtime.ready()

    let button = document.querySelector('button')
    if (!button) throw new Error('missing hydrated button')
    expect(button.textContent).toBe('Hello world!')
    expect(button.childNodes.length).toBe(3)

    button.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(button.textContent).toBe('Hello Ryan!')
    expect(button.childNodes.length).toBe(3)
  })

  it('adopts root and early-frame css style tags without duplicating rules', async () => {
    let StyledEntry = clientEntry('/entries/styled.js#Styled', function Styled() {
      return (props: { label: string }) => (
        <button mix={[css({ color: 'rebeccapurple', paddingTop: 8 })]}>{props.label}</button>
      )
    })
    let html = await readStream(
      renderToHTMLStream(
        <main>
          <StyledEntry label="root" />
          <frame src="/a" fallback={<p>loading a</p>} />
          <frame src="/b" fallback={<p>loading b</p>} />
        </main>,
        {
          resolveFrame: async (src) => <StyledEntry label={`frame ${src}`} />,
        },
      ),
    )
    document.body.innerHTML = html
    let extraStyleA = document.createElement('style')
    extraStyleA.setAttribute('data-rmx-css-mixin', '')
    extraStyleA.setAttribute('data-rmx-css-origin', 'server')
    extraStyleA.textContent = '.rmx-css-extra-a{color:green;}'
    document.body.appendChild(extraStyleA)
    let extraStyleB = document.createElement('style')
    extraStyleB.setAttribute('data-rmx-css-mixin', '')
    extraStyleB.setAttribute('data-rmx-css-origin', 'server')
    extraStyleB.textContent = '.rmx-css-extra-b{color:orange;}'
    document.body.appendChild(extraStyleB)
    expect(document.querySelectorAll('style[data-rmx-css-mixin]').length).toBe(3)

    let runtime = boot({
      document,
      async loadModule(moduleUrl: string, exportName: string) {
        if (moduleUrl !== '/entries/styled.js' || exportName !== 'Styled') {
          throw new Error(`Unexpected entry request: ${moduleUrl}#${exportName}`)
        }
        return function Styled() {
          return (props: { label: string }) => (
            <button mix={[css({ color: 'rebeccapurple', paddingTop: 8 })]}>{props.label}</button>
          )
        }
      },
    })
    await runtime.ready()
    await new Promise((resolve) => setTimeout(resolve, 0))

    let serverStyles = document.querySelectorAll('style[data-rmx-css-origin="server"]')
    expect(serverStyles.length).toBe(0)
    let clientStyles = document.querySelectorAll('style[data-rmx-css-origin="client"]')
    expect(clientStyles.length).toBe(1)
    let rootClass = document.querySelector('button')?.className ?? ''
    let cssText = clientStyles[0]?.textContent ?? ''
    if (!rootClass) throw new Error('missing hydrated root css class')
    let rootRuleRegex = new RegExp(`\\.${rootClass}\\{`, 'g')
    expect((cssText.match(rootRuleRegex) ?? []).length).toBe(1)
    expect(cssText).toContain('.rmx-css-extra-a{color:green;}')
    expect(cssText).toContain('.rmx-css-extra-b{color:orange;}')
  })

  it('adopts css style tags from late streamed frame templates', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- rmx:h:h1 --><button id="root">root</button><!-- /rmx:h -->',
      '<!-- f:f1 --><p id="late-fallback">loading late</p><!-- /f -->',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"h1":{"moduleUrl":"/entries/styled.js","exportName":"Styled","props":{"label":"root"}}},"f":{"f1":{"status":"pending","name":"late","src":"/late"}}}',
      '</script>',
      '</main>',
    ].join('')

    let runtime = boot({
      document,
      async loadModule(moduleUrl: string, exportName: string) {
        if (moduleUrl !== '/entries/styled.js' || exportName !== 'Styled') {
          throw new Error(`Unexpected entry request: ${moduleUrl}#${exportName}`)
        }
        return function Styled() {
          return (props: { label: string }) => (
            <button mix={[css({ color: 'rebeccapurple', paddingTop: 8 })]}>{props.label}</button>
          )
        }
      },
    })
    await runtime.ready()
    expect(document.getElementById('late-fallback')).toBeTruthy()
    let sawCleanFragment = false
    runtime.addEventListener('beforeFrameApply', (event) => {
      if (!(event instanceof BeforeFrameApplyEvent)) return
      if (event.kind !== 'frame-template') return
      if (event.start.data.trim() !== 'f:f1') return
      let styleCount = event.fragment.querySelectorAll('style[data-rmx-css-mixin]').length
      if (styleCount === 0) {
        sawCleanFragment = true
      }
    })

    let template = document.createElement('template')
    template.id = 'f1'
    template.innerHTML = [
      '<style data-rmx-css-mixin data-rmx-css-origin="server">.rmx-css-late{color:blue;}</style>',
      '<div id="late-content" class="rmx-css-late">late</div>',
    ].join('')
    document.body.appendChild(template)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.getElementById('late-content')).toBeTruthy()
    expect(sawCleanFragment).toBe(true)
    expect(document.querySelectorAll('style[data-rmx-css-origin="server"]').length).toBe(0)
    let clientStyle = document.querySelector('style[data-rmx-css-origin="client"]')
    expect(clientStyle?.textContent).toContain('.rmx-css-late{color:blue;}')
  })
})

async function readStream(stream: ReadableStream<Uint8Array>) {
  let reader = stream.getReader()
  let decoder = new TextDecoder()
  let output = ''
  while (true) {
    let result = await reader.read()
    if (result.done) break
    output += decoder.decode(result.value, { stream: true })
  }
  output += decoder.decode()
  return output
}
