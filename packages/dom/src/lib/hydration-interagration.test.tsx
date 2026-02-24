import { afterEach, describe, expect, it } from 'vitest'
import { boot, clientEntry, on, renderToHTMLStream, type ComponentHandle } from '../index.ts'

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
