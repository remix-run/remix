import { createRouter } from 'remix/router'
import { css, on, type Handle, type RemixNode } from 'remix/ui'
import { nodeResponse, run } from 'remix/ui/spa'

const routes = {
  home: '/',
  about: '/about',
  greet: '/greet',
}

const router = createRouter({
  defaultHandler(context) {
    return pageResponse(context.request, <NotFoundPage />, 404)
  },
})

router.get(routes.home, async (context) => {
  await sleep(700, context.request.signal)
  return pageResponse(context.request, <HomePage />)
})

router.get(routes.about, async (context) => {
  await sleep(700, context.request.signal)
  return pageResponse(context.request, <AboutPage />)
})

router.get(routes.greet, (context) => pageResponse(context.request, <GreetingPage name="friend" />))

router.post(routes.greet, async (context) => {
  let formData = await context.request.formData()
  let value = formData.get('name')
  let name = typeof value === 'string' && value.trim() !== '' ? value.trim() : 'friend'
  await sleep(700, context.request.signal)
  return pageResponse(context.request, <GreetingPage isSubmission name={name} />)
})

function pageResponse(request: Request, content: RemixNode, status = 200): Response {
  let url = new URL(request.url)
  return nodeResponse(
    <Layout pathname={url.pathname} trace={`${request.method} ${url.pathname} → nodeResponse`}>
      {content}
    </Layout>,
    { status },
  )
}

interface LayoutProps {
  children?: RemixNode
  pathname: string
  trace: string
}

function Layout(handle: Handle<LayoutProps>) {
  let isPending = false

  handle.queueTask(() => {
    handle.frame.addEventListener(
      'reloadStart',
      () => {
        if (isPending) return
        isPending = true
        void handle.update()
      },
      { signal: handle.signal },
    )
    handle.frame.addEventListener(
      'reloadComplete',
      () => {
        if (!isPending) return
        isPending = false
        void handle.update()
      },
      { signal: handle.signal },
    )
  })

  return () => (
    <div mix={appShellStyle}>
      <div mix={contentStyle}>
        <header mix={headerStyle}>
          <a href={routes.home} mix={brandStyle}>
            Remix SPA
          </a>
          <nav aria-label="Main navigation" mix={navStyle}>
            <NavLink href={routes.home} current={handle.props.pathname === routes.home}>
              Home
            </NavLink>
            <NavLink href={routes.about} current={handle.props.pathname === routes.about}>
              About
            </NavLink>
            <NavLink href={routes.greet} current={handle.props.pathname === routes.greet}>
              Greet
            </NavLink>
          </nav>
        </header>
        <main aria-busy={isPending} mix={mainStyle}>
          {isPending ? <LoadingPage /> : handle.props.children}
        </main>
        <p aria-label="Latest route resolution" mix={traceStyle}>
          {handle.props.trace}
        </p>
      </div>
    </div>
  )
}

interface NavLinkProps {
  children?: RemixNode
  current: boolean
  href: string
}

function NavLink(handle: Handle<NavLinkProps>) {
  return () => (
    <a
      href={handle.props.href}
      aria-current={handle.props.current ? 'page' : undefined}
      mix={navLinkStyle}
    >
      {handle.props.children}
    </a>
  )
}

function HomePage() {
  return () => (
    <article>
      <p mix={eyebrowStyle}>Home</p>
      <h1 mix={titleStyle}>A client-only Remix app</h1>
      <p mix={bodyStyle}>
        The fetch router still maps a web <code>Request</code> to a <code>Response</code>. That
        bodyless response carries a Remix node for the top frame to render.
      </p>
      <Counter />
      <form method="POST" action={routes.greet} mix={formStyle}>
        <label htmlFor="name" mix={labelStyle}>
          What should we call you?
        </label>
        <div mix={formControlsStyle}>
          <input id="name" name="name" autoComplete="name" required mix={inputStyle} />
          <button type="submit" mix={buttonStyle}>
            Submit
          </button>
        </div>
      </form>
    </article>
  )
}

function Counter(handle: Handle) {
  let count = 0

  return () => (
    <button
      type="button"
      mix={[
        buttonStyle,
        on('click', () => {
          count++
          void handle.update()
        }),
      ]}
    >
      Count: {count}
    </button>
  )
}

function AboutPage() {
  return () => (
    <article>
      <p mix={eyebrowStyle}>About</p>
      <h1 mix={titleStyle}>URLs in, rendered UI out</h1>
      <p mix={bodyStyle}>
        Each route waits briefly before returning a node response, making top-frame loading and
        cancellation visible without introducing a second navigation system.
      </p>
    </article>
  )
}

function GreetingPage(handle: Handle<{ isSubmission?: boolean; name: string }>) {
  return () => (
    <article>
      {handle.props.isSubmission ? <p mix={eyebrowStyle}>Form submitted</p> : null}
      <h1 mix={titleStyle}>Hello, {handle.props.name}!</h1>
      <p mix={bodyStyle}>
        The frame navigation listener turns the native form navigation into a routed request. Back
        and forward traversals revisit this URL with GET because history entries do not retain form
        data.
      </p>
      <form method="POST" action={routes.greet} mix={formStyle}>
        <label htmlFor="next-name" mix={labelStyle}>
          Try another name
        </label>
        <div mix={formControlsStyle}>
          <input id="next-name" name="name" autoComplete="name" required mix={inputStyle} />
          <button type="submit" mix={buttonStyle}>
            Submit again
          </button>
        </div>
      </form>
      <p mix={bodyStyle}>
        This form targets the current URL, so it replaces the active history entry. The first
        submission from <a href={routes.home}>home</a> pushes a new entry.
      </p>
    </article>
  )
}

function NotFoundPage() {
  return () => (
    <article>
      <p mix={eyebrowStyle}>404</p>
      <h1 mix={titleStyle}>Page not found</h1>
      <p mix={bodyStyle}>
        Try going back to the <a href={routes.home}>home page</a>.
      </p>
    </article>
  )
}

function LoadingPage() {
  return () => (
    <div role="status" mix={loadingStyle}>
      Loading…
    </div>
  )
}

function sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }

    let timeout = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, milliseconds)

    function handleAbort() {
      clearTimeout(timeout)
      reject(signal.reason)
    }

    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

const appShellStyle = css({
  position: 'fixed',
  inset: 0,
  minWidth: 320,
  overflow: 'auto',
  color: '#202124',
  backgroundColor: '#f7f5ff',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fontSynthesis: 'none',
  '& *': { boxSizing: 'border-box' },
})

const contentStyle = css({ width: 'min(100% - 2rem, 48rem)', margin: '0 auto' })
const headerStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '1.5rem 0',
})
const brandStyle = css({
  color: 'inherit',
  fontSize: '1.125rem',
  fontWeight: 700,
  textDecoration: 'none',
})
const navStyle = css({ display: 'flex', gap: '0.5rem' })
const navLinkStyle = css({
  borderRadius: 999,
  padding: '0.5rem 0.75rem',
  color: '#5b36d6',
  textDecoration: 'none',
  '&:hover, &[aria-current="page"]': { backgroundColor: '#e7e0ff' },
})
const mainStyle = css({
  minHeight: '18rem',
  border: '1px solid #ded8ef',
  borderRadius: '1rem',
  backgroundColor: 'white',
  boxShadow: '0 1rem 3rem rgb(64 44 120 / 10%)',
  padding: 'clamp(2rem, 8vw, 5rem)',
})
const traceStyle = css({
  margin: '1rem 0',
  color: '#6f687e',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '0.8rem',
})
const eyebrowStyle = css({
  margin: '0 0 0.5rem',
  color: '#6a48d7',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
})
const titleStyle = css({ margin: 0, fontSize: 'clamp(2rem, 7vw, 3.5rem)', lineHeight: 1.05 })
const bodyStyle = css({
  maxWidth: '38rem',
  margin: '1.5rem 0 0',
  color: '#5c5965',
  fontSize: '1.125rem',
  lineHeight: 1.7,
})
const formStyle = css({ display: 'grid', gap: '0.75rem', maxWidth: '30rem', marginTop: '2rem' })
const labelStyle = css({ fontWeight: 700 })
const formControlsStyle = css({ display: 'flex', gap: '0.75rem' })
const inputStyle = css({
  minWidth: 0,
  flex: 1,
  border: '1px solid #bcb4d4',
  borderRadius: '0.6rem',
  padding: '0.7rem 0.8rem',
  font: 'inherit',
})
const buttonStyle = css({
  border: 0,
  borderRadius: '0.6rem',
  padding: '0.7rem 1rem',
  color: 'white',
  backgroundColor: '#5b36d6',
  font: 'inherit',
  fontWeight: 700,
  cursor: 'pointer',
})
const loadingStyle = css({ color: '#6a48d7', fontSize: '1.125rem' })

const app = run(router)
app.addEventListener('error', (event) => {
  console.error('Remix SPA failed:', event.error)
})
await app.ready()
