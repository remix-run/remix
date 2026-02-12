import { createRoot, type Handle, type RemixNode } from 'remix/component'
import { TypedEventTarget } from 'remix/interaction'

// ============================================================================
// Getting Started - Basic App Example
// ============================================================================
function App(handle: Handle) {
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
      Count: {count}
    </button>
  )
}

// ============================================================================
// Component State and Updates - Counter
// ============================================================================
function Counter(handle: Handle) {
  let count = 0

  return () => (
    <div>
      <span>Count: {count}</span>
      <button
        on={{
          click: () => {
            count++
            handle.update()
          },
        }}
      >
        Increment
      </button>
    </div>
  )
}

// ============================================================================
// Components - Greeting
// ============================================================================
function Greeting(handle: Handle) {
  return (props: { name: string }) => <h1>Hello, {props.name}!</h1>
}

// ============================================================================
// Stateful Components - CounterWithSetup
// ============================================================================
function CounterWithSetup(handle: Handle, setup: number) {
  // Setup phase: runs once
  let count = setup

  // Return render function: runs on every update
  return (props: { label?: string }) => (
    <div>
      {props.label || 'Count'}: {count}
      <button
        on={{
          click: () => {
            count++
            handle.update()
          },
        }}
      >
        Increment
      </button>
    </div>
  )
}

// ============================================================================
// Setup Prop vs Props - CounterWithLabel
// ============================================================================
function CounterWithLabel(handle: Handle, setup: number) {
  let count = setup // use setup for initialization

  return (props: { label?: string }) => (
    // props only contains render-time values
    <div>
      {props.label}: {count}
      <button
        on={{
          click: () => {
            count++
            handle.update()
          },
        }}
      >
        +
      </button>
    </div>
  )
}

// ============================================================================
// Events - SearchInput
// ============================================================================
function SearchInput(handle: Handle) {
  let query = ''
  let results: string[] = []
  let loading = false

  return () => (
    <div>
      <input
        type="text"
        value={query}
        placeholder="Type to search..."
        on={{
          input: (event, signal) => {
            query = event.currentTarget.value
            loading = true
            handle.update()

            // Simulated search with timeout
            setTimeout(() => {
              if (signal.aborted) return
              results = query ? [`Result for "${query}" 1`, `Result for "${query}" 2`] : []
              loading = false
              handle.update()
            }, 300)
          },
        }}
      />
      {loading && <div>Loading...</div>}
      {!loading && results.length > 0 && (
        <ul>
          {results.map((r) => (
            <li>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ============================================================================
// Controlled Input - Slug Form
// ============================================================================
function SlugForm(handle: Handle) {
  let slug = ''
  let generatedSlug = ''

  return () => (
    <form>
      <label css={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="checkbox"
          on={{
            change: (event) => {
              if (event.currentTarget.checked) {
                generatedSlug = crypto.randomUUID().slice(0, 8)
              } else {
                generatedSlug = ''
              }
              handle.update()
            },
          }}
        />
        Auto-generate slug
      </label>
      <label css={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        Slug
        <input
          type="text"
          value={generatedSlug || slug}
          disabled={!!generatedSlug}
          on={{
            input: (event) => {
              slug = event.currentTarget.value
              handle.update()
            },
          }}
        />
      </label>
    </form>
  )
}

// ============================================================================
// Global Events - KeyboardTracker
// ============================================================================
function KeyboardTracker(handle: Handle) {
  let keys: string[] = []

  handle.on(document, {
    keydown: (event) => {
      keys.push(event.key)
      if (keys.length > 10) keys.shift()
      handle.update()
    },
  })

  return () => <div>Keys: {keys.join(', ') || '(press some keys)'}</div>
}

// ============================================================================
// CSS Prop - Button (Basic)
// ============================================================================
function ButtonBasic(handle: Handle) {
  return () => (
    <button
      css={{
        color: 'white',
        backgroundColor: 'rgb(54, 113, 246)',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: 'rgb(37, 90, 210)',
        },
        '&:active': {
          transform: 'scale(0.98)',
        },
      }}
    >
      Click me
    </button>
  )
}

// ============================================================================
// CSS Prop - Button (Advanced with nested rules)
// ============================================================================
function ButtonAdvanced(handle: Handle) {
  return () => (
    <button
      css={{
        color: 'white',
        backgroundColor: 'rgb(54, 113, 246)',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '6px',
        cursor: 'pointer',
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        '&:hover': {
          backgroundColor: 'rgb(37, 90, 210)',
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: '-2px',
          borderRadius: '8px',
          background: 'linear-gradient(45deg, rgb(54, 113, 246), rgb(99, 179, 255))',
          zIndex: -1,
          opacity: 0,
          transition: 'opacity 0.2s',
        },
        '&:hover::before': {
          opacity: 1,
        },
        '.icon': {
          width: '16px',
          height: '16px',
        },
      }}
    >
      <span className="icon">★</span>
      Click me
    </button>
  )
}

// ============================================================================
// Connect Prop - Form (Basic)
// ============================================================================
function FormBasic(handle: Handle) {
  let inputRef: HTMLInputElement

  return () => (
    <div>
      <input
        type="text"
        placeholder="Click the button to select this"
        // get the input node
        connect={(node) => (inputRef = node)}
        css={{ marginRight: '8px', padding: '4px 8px' }}
      />
      <button
        on={{
          click: () => {
            // Select it from other parts of the form
            inputRef.select()
          },
        }}
        css={{ padding: '4px 12px' }}
      >
        Select Input
      </button>
    </div>
  )
}

// ============================================================================
// Connect Prop with AbortSignal - ResizeObserver Component
// ============================================================================
function ResizeComponent(handle: Handle) {
  let dimensions = { width: 0, height: 0 }

  return () => (
    <div
      connect={(node, signal) => {
        // Set up something that needs cleanup
        let observer = new ResizeObserver((entries) => {
          let entry = entries[0]
          if (entry) {
            dimensions.width = Math.round(entry.contentRect.width)
            dimensions.height = Math.round(entry.contentRect.height)
            handle.update()
          }
        })
        observer.observe(node)

        // Clean up when element is removed
        signal.addEventListener('abort', () => {
          observer.disconnect()
        })
      }}
      css={{
        padding: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        resize: 'both',
        overflow: 'auto',
        minWidth: '100px',
        minHeight: '60px',
        border: '1px solid rgb(209, 213, 219)',
      }}
    >
      Resize me! ({dimensions.width} × {dimensions.height})
    </div>
  )
}

// ============================================================================
// handle.update() - Player
// ============================================================================
function Player(handle: Handle) {
  let isPlaying = false
  let playButton: HTMLButtonElement
  let stopButton: HTMLButtonElement

  return () => (
    <div css={{ display: 'flex', gap: '8px' }}>
      <button
        disabled={isPlaying}
        connect={(node) => (playButton = node)}
        on={{
          async click() {
            isPlaying = true
            await handle.update()
            // Focus the enabled button after update completes
            stopButton.focus()
          },
        }}
        css={{
          padding: '8px 16px',
          opacity: isPlaying ? 0.5 : 1,
        }}
      >
        ▶ Play
      </button>
      <button
        disabled={!isPlaying}
        connect={(node) => (stopButton = node)}
        on={{
          async click() {
            isPlaying = false
            await handle.update()
            // Focus the enabled button after update completes
            playButton.focus()
          },
        }}
        css={{
          padding: '8px 16px',
          opacity: !isPlaying ? 0.5 : 1,
        }}
      >
        ⏹ Stop
      </button>
    </div>
  )
}

// ============================================================================
// handle.queueTask - Form with scroll
// ============================================================================
function FormWithScroll(handle: Handle) {
  let showDetails = false
  let detailsSection: HTMLElement

  return () => (
    <div>
      <label css={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={showDetails}
          on={{
            change: (event) => {
              showDetails = event.currentTarget.checked
              handle.update()
              if (showDetails) {
                // Scroll to the expanded section after it renders
                handle.queueTask(() => {
                  detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                })
              }
            },
          }}
        />
        Show additional details
      </label>
      {showDetails && (
        <section
          connect={(node) => (detailsSection = node)}
          css={{
            marginTop: '1rem',
            padding: '1rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          }}
        >
          <h3 css={{ margin: '0 0 0.5rem 0' }}>Additional Details</h3>
          <p css={{ margin: 0 }}>This section appears when the checkbox is checked.</p>
        </section>
      )}
    </div>
  )
}

// ============================================================================
// handle.signal - Clock
// ============================================================================
function Clock(handle: Handle) {
  let interval = setInterval(() => {
    // clear the interval when the component is disconnected
    if (handle.signal.aborted) {
      clearInterval(interval)
      return
    }
    handle.update()
  }, 1000)
  return () => <span>{new Date().toLocaleTimeString()}</span>
}

// ============================================================================
// handle.id - LabeledInput
// ============================================================================
function LabeledInput(handle: Handle) {
  return () => (
    <div css={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label htmlFor={handle.id}>Name</label>
      <input
        id={handle.id}
        type="text"
        css={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.3)' }}
      />
    </div>
  )
}

// ============================================================================
// Context API - Theme Provider and Consumer
// ============================================================================
function ThemeProvider(handle: Handle<{ theme: string }>) {
  handle.context.set({ theme: 'dark' })

  return () => (
    <div css={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <ThemedHeader />
    </div>
  )
}

function ThemedHeader(handle: Handle) {
  // Consume context from ThemeProvider
  let { theme } = handle.context.get(ThemeProvider)

  return () => (
    <header
      css={{
        backgroundColor: theme === 'dark' ? '#000' : '#fff',
        color: theme === 'dark' ? '#fff' : '#000',
      }}
    >
      Header
    </header>
  )
}

// ============================================================================
// Context API with EventTarget - Advanced Theme
// ============================================================================
class Theme extends TypedEventTarget<{ change: Event }> {
  #value: 'light' | 'dark' = 'light'

  get value() {
    return this.#value
  }

  setValue(value: 'light' | 'dark') {
    this.#value = value
    this.dispatchEvent(new Event('change'))
  }
}

function ThemeProviderAdvanced(handle: Handle<Theme>) {
  let theme = new Theme()
  handle.context.set(theme)

  return () => (
    <div css={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        on={{
          click: () => {
            // no updates in the parent component
            theme.setValue(theme.value === 'light' ? 'dark' : 'light')
          },
        }}
        css={{ padding: '8px 16px', alignSelf: 'flex-start' }}
      >
        Toggle Theme (EventTarget)
      </button>
      <ThemedContent />
    </div>
  )
}

function ThemedContent(handle: Handle) {
  let theme = handle.context.get(ThemeProviderAdvanced)

  // Subscribe to theme changes and update when it changes
  handle.on(theme, { change: () => handle.update() })

  return () => (
    <div
      css={{
        padding: '12px',
        borderRadius: '6px',
        backgroundColor: theme.value === 'dark' ? '#1a1a1a' : '#f0f0f0',
        color: theme.value === 'dark' ? '#fff' : '#000',
      }}
    >
      Current theme: {theme.value}
    </div>
  )
}

// ============================================================================
// Fragments - List
// ============================================================================
function ListWithFragment(handle: Handle) {
  return () => (
    <ul css={{ margin: 0, paddingLeft: '20px' }}>
      <>
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
      </>
    </ul>
  )
}

// ============================================================================
// Example Container Component
// ============================================================================
function Example(handle: Handle) {
  return (props: { title: string; children: RemixNode }) => (
    <div className="example">
      <h2>{props.title}</h2>
      <div className="example-content">{props.children}</div>
    </div>
  )
}

// ============================================================================
// Main Demo App
// ============================================================================
function DemoApp(handle: Handle) {
  return () => (
    <div className="examples-grid">
      <Example title="Getting Started - Counter">
        <App />
      </Example>

      <Example title="Component State - Counter">
        <Counter />
      </Example>

      <Example title="Greeting">
        <Greeting name="World" />
      </Example>

      <Example title="Counter with Setup">
        <CounterWithSetup setup={10} label="Total" />
      </Example>

      <Example title="Setup vs Props">
        <CounterWithLabel setup={5} label="Score" />
      </Example>

      <Example title="Events - Search Input">
        <SearchInput />
      </Example>

      <Example title="Controlled Input - Slug Form">
        <SlugForm />
      </Example>

      <Example title="Global Events - Keyboard Tracker">
        <KeyboardTracker />
      </Example>

      <Example title="CSS Prop - Basic Button">
        <ButtonBasic />
      </Example>

      <Example title="CSS Prop - Advanced Button">
        <ButtonAdvanced />
      </Example>

      <Example title="Connect Prop - Form">
        <FormBasic />
      </Example>

      <Example title="Connect with AbortSignal - Resize Observer">
        <ResizeComponent />
      </Example>

      <Example title="handle.update() - Player">
        <Player />
      </Example>

      <Example title="handle.queueTask - Scroll to Section">
        <FormWithScroll />
      </Example>

      <Example title="handle.signal - Clock">
        <Clock />
      </Example>

      <Example title="handle.id - Labeled Input">
        <LabeledInput />
      </Example>

      <Example title="Context API - Theme Provider">
        <ThemeProvider />
      </Example>

      <Example title="Context with EventTarget">
        <ThemeProviderAdvanced />
      </Example>

      <Example title="Fragments - List">
        <ListWithFragment />
      </Example>
    </div>
  )
}

createRoot(document.getElementById('app')!).render(<DemoApp />)
