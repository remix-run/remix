import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Handle } from '../lib/component.ts'
import { renderToStream } from '../lib/stream.ts'
import { hydrationRoot } from '../lib/hydration-root.ts'
import { hydrate } from '../lib/hydrate-client.ts'
import { drain } from './utils.ts'

describe('hydrate', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('hydrates a single component', async () => {
    // Create a hydrated component
    let Counter = hydrationRoot(
      '/js/counter.js#Counter',
      function Counter(handle: Handle, setup: number) {
        let count = setup
        return () => (
          <button
            on={{
              click: () => {
                count++
                handle.update()
              },
            }}
          >
            Count: {count}
          </button>
        )
      },
    )

    // Server render
    let stream = renderToStream(<Counter setup={5} />)
    let html = await drain(stream)

    // Set up the document with server HTML
    document.body.innerHTML = html

    // Create a mock module loader that returns our component
    let loadModule = vi.fn().mockResolvedValue(Counter)

    // Hydrate
    let root = hydrate({ loadModule })
    await root.ready

    // Verify the component was loaded
    expect(loadModule).toHaveBeenCalledWith('/js/counter.js', 'Counter')

    // Verify the DOM is intact
    let button = document.querySelector('button')
    expect(button).toBeTruthy()
    expect(button?.textContent).toBe('Count: 5')

    // Verify interactivity works
    button?.click()
    root.flush()

    expect(button?.textContent).toBe('Count: 6')
  })

  it('hydrates multiple components', async () => {
    let Button = hydrationRoot('/js/button.js#Button', function Button(handle: Handle) {
      let clicked = false
      return ({ text }: { text: string }) => (
        <button
          on={{
            click: () => {
              clicked = true
              handle.update()
            },
          }}
        >
          {clicked ? `${text} clicked!` : text}
        </button>
      )
    })

    // Server render multiple components
    let stream = renderToStream(
      <div>
        <Button text="First" />
        <Button text="Second" />
      </div>,
    )
    let html = await drain(stream)

    document.body.innerHTML = html

    // Mock loader that returns our Button component
    let loadModule = vi.fn().mockResolvedValue(Button)

    let root = hydrate({ loadModule })
    await root.ready

    // Verify both instances were loaded
    expect(loadModule).toHaveBeenCalledTimes(2)

    // Verify both buttons exist
    let buttons = document.querySelectorAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.textContent).toBe('First')
    expect(buttons[1]?.textContent).toBe('Second')

    // Verify they're independent
    buttons[0]?.click()
    root.flush()

    expect(buttons[0]?.textContent).toBe('First clicked!')
    expect(buttons[1]?.textContent).toBe('Second')
  })

  it('handles complex props', async () => {
    let Card = hydrationRoot('/js/card.js#Card', function Card(handle: Handle) {
      return (props: { title: string; count: number; enabled: boolean; items: string[] }) => (
        <div>
          <h2>{props.title}</h2>
          <p>Count: {props.count}</p>
          <p>Enabled: {String(props.enabled)}</p>
          <ul>
            {props.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )
    })

    let stream = renderToStream(
      <Card title="Test" count={42} enabled={true} items={['one', 'two', 'three']} />,
    )
    let html = await drain(stream)

    document.body.innerHTML = html

    let loadModule = vi.fn().mockResolvedValue(Card)

    let root = hydrate({ loadModule })
    await root.ready

    // Verify the component received the correct props
    expect(loadModule).toHaveBeenCalledWith('/js/card.js', 'Card')

    // Verify content is correct
    expect(document.querySelector('h2')?.textContent).toBe('Test')
    expect(document.querySelector('p')?.textContent).toBe('Count: 42')
    expect(document.querySelectorAll('li')).toHaveLength(3)
  })

  it('does nothing when no rmx-data script exists', async () => {
    document.body.innerHTML = '<div>No hydration here</div>'

    let loadModule = vi.fn()

    let root = hydrate({ loadModule })
    await root.ready

    // Module loader should not be called
    expect(loadModule).not.toHaveBeenCalled()
  })

  it('does nothing when rmx-data has no hydration data', async () => {
    document.body.innerHTML = `
      <div>Static content</div>
      <script type="application/json" id="rmx-data">{}</script>
    `

    let loadModule = vi.fn()

    let root = hydrate({ loadModule })
    await root.ready

    expect(loadModule).not.toHaveBeenCalled()
  })

  it('warns when markers are not found for hydration root', async () => {
    // Set up rmx-data but no markers
    document.body.innerHTML = `
      <div>Content without markers</div>
      <script type="application/json" id="rmx-data">{"h":{"h1":{"moduleUrl":"/js/test.js","exportName":"Test","props":{}}}}</script>
    `

    let loadModule = vi.fn().mockResolvedValue(() => () => <div>Test</div>)
    let warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    let root = hydrate({ loadModule })
    await root.ready

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not find markers for hydration root: h1'),
    )

    warnSpy.mockRestore()
  })

  it('handles module load errors gracefully', async () => {
    let Counter = hydrationRoot('/js/counter.js#Counter', function Counter() {
      return () => <button>Count</button>
    })

    let stream = renderToStream(<Counter />)
    let html = await drain(stream)

    document.body.innerHTML = html

    let loadModule = vi.fn().mockRejectedValue(new Error('Module not found'))
    let errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    let root = hydrate({ loadModule })
    await root.ready

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load module for h1'),
      expect.any(Error),
    )

    errorSpy.mockRestore()
  })

  it('loads modules in parallel', async () => {
    let Button = hydrationRoot('/js/button.js#Button', function Button() {
      return ({ text }: { text: string }) => <button>{text}</button>
    })

    let stream = renderToStream(
      <div>
        <Button text="A" />
        <Button text="B" />
        <Button text="C" />
      </div>,
    )
    let html = await drain(stream)

    document.body.innerHTML = html

    // Track when each load starts
    let loadOrder: string[] = []
    let resolvers: Array<() => void> = []

    let loadModule = vi.fn().mockImplementation(async (url: string) => {
      loadOrder.push(`start:${url}`)
      await new Promise<void>((resolve) => resolvers.push(resolve))
      loadOrder.push(`end:${url}`)
      return Button
    })

    let root = hydrate({ loadModule })

    // All three should start loading before any finish
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(loadOrder.filter((s) => s.startsWith('start:'))).toHaveLength(3)
    expect(loadOrder.filter((s) => s.startsWith('end:'))).toHaveLength(0)

    // Resolve all
    resolvers.forEach((r) => r())
    await root.ready

    expect(loadOrder.filter((s) => s.startsWith('end:'))).toHaveLength(3)
  })

  it('adopts existing DOM nodes during hydration', async () => {
    let Counter = hydrationRoot('/js/counter.js#Counter', function Counter() {
      return () => (
        <div>
          <span>Static text</span>
        </div>
      )
    })

    let stream = renderToStream(<Counter />)
    let html = await drain(stream)

    document.body.innerHTML = html

    // Get reference to existing nodes
    let existingSpan = document.querySelector('span')
    expect(existingSpan).toBeTruthy()

    let loadModule = vi.fn().mockResolvedValue(Counter)

    let root = hydrate({ loadModule })
    await root.ready

    // The same span should still be in the DOM (adopted, not replaced)
    let spanAfterHydration = document.querySelector('span')
    expect(spanAfterHydration).toBe(existingSpan)
  })

  it('flush works before ready resolves', async () => {
    let Counter = hydrationRoot('/js/counter.js#Counter', function Counter(handle: Handle) {
      let count = 0
      return () => (
        <button
          on={{
            click: () => {
              count++
              handle.update()
            },
          }}
        >
          {count}
        </button>
      )
    })

    let stream = renderToStream(<Counter />)
    let html = await drain(stream)

    document.body.innerHTML = html

    let loadModule = vi.fn().mockResolvedValue(Counter)

    let root = hydrate({ loadModule })

    // flush() should not throw even before ready
    root.flush()

    await root.ready

    let button = document.querySelector('button')
    expect(button?.textContent).toBe('0')

    button?.click()
    root.flush()

    expect(button?.textContent).toBe('1')
  })

  it('is an EventTarget for error handling', async () => {
    let Counter = hydrationRoot('/js/counter.js#Counter', function Counter() {
      return () => <button>Count</button>
    })

    let stream = renderToStream(<Counter />)
    let html = await drain(stream)

    document.body.innerHTML = html

    let loadModule = vi.fn().mockResolvedValue(Counter)

    let root = hydrate({ loadModule })

    // Verify it's an EventTarget
    expect(root.addEventListener).toBeDefined()
    expect(root.removeEventListener).toBeDefined()
    expect(root.dispatchEvent).toBeDefined()

    // Can add error listener
    let errorHandler = vi.fn()
    root.addEventListener('error', errorHandler)

    await root.ready
  })
})
