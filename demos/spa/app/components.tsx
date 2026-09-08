import { type Handle, css, on } from 'remix/ui'
import type { RemixNode } from 'remix/ui/jsx-runtime'
import { routes } from './routes.ts'

interface LayoutProps {
  children?: RemixNode
  url: URL
}

export function Layout(handle: Handle<LayoutProps>) {
  let showLoading = false

  handle.queueTask(() => {
    handle.frame.addEventListener(
      'reloadStart',
      () => {
        showLoading = new URL(handle.frame.src).pathname !== handle.props.url.pathname
        void handle.update()
      },
      { signal: handle.signal },
    )
    handle.frame.addEventListener(
      'reloadComplete',
      () => {
        if (!showLoading) return
        showLoading = false
        void handle.update()
      },
      { signal: handle.signal },
    )
  })

  return () => (
    <div mix={appShellStyle}>
      <div mix={contentStyle}>
        <header mix={headerStyle}>
          <a href={routes.home.href()} mix={brandStyle}>
            Remix SPA
          </a>
          <nav aria-label="Main navigation" mix={navStyle}>
            <NavLink
              href={routes.home.href()}
              current={handle.props.url.pathname === routes.home.href()}
            >
              Home
            </NavLink>
            <NavLink
              href={routes.about.href()}
              current={handle.props.url.pathname === routes.about.href()}
            >
              About
            </NavLink>
            <NavLink
              href={routes.greet.href()}
              current={handle.props.url.pathname === routes.greet.href()}
            >
              Greet
            </NavLink>
          </nav>
        </header>
        <main aria-busy={showLoading} mix={mainStyle}>
          {showLoading ? <LoadingPage /> : handle.props.children}
        </main>
      </div>
    </div>
  )
}

interface NavLinkProps {
  children?: RemixNode
  current: boolean
  href: string
}

export function NavLink(handle: Handle<NavLinkProps>) {
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

export function HomePage() {
  return () => (
    <article>
      <p mix={eyebrowStyle}>Home</p>
      <h1 mix={titleStyle}>A client-only Remix app</h1>
      <p mix={bodyStyle}>
        The SPA runtime preserves the fetch router's <code>Request</code> to <code>Response</code>{' '}
        contract while route handlers work directly with Remix nodes through <code>render()</code>.
      </p>
      <form method="POST" action={routes.submitGreet.href()} mix={formStyle}>
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

export function AboutPage() {
  return () => (
    <article>
      <p mix={eyebrowStyle}>About</p>
      <h1 mix={titleStyle}>URLs in, rendered UI out</h1>
      <p mix={bodyStyle}>
        Each route waits briefly before returning a SPA response, making top-frame loading and
        cancellation visible without introducing a second navigation system.
      </p>
    </article>
  )
}

export function GreetingPage(handle: Handle<{ isSubmission?: boolean; name: string }>) {
  let isPending = false

  handle.frame.addEventListener(
    'reloadComplete',
    () => {
      if (!isPending) return
      isPending = false
      void handle.update()
    },
    { signal: handle.signal },
  )

  return () => (
    <article>
      {handle.props.isSubmission ? <p mix={eyebrowStyle}>Form submitted</p> : null}
      <h1 mix={titleStyle}>Hello, {handle.props.name}!</h1>
      <p mix={bodyStyle}>
        The frame navigation listener turns the native form navigation into a routed request. Back
        and forward traversals revisit this URL with GET because history entries do not retain form
        data.
      </p>
      <form
        method="POST"
        action={routes.submitGreet.href()}
        mix={[
          formStyle,
          on('submit', () => {
            isPending = true
            void handle.update()
          }),
        ]}
      >
        <label htmlFor="next-name" mix={labelStyle}>
          Try another name
        </label>
        <div mix={formControlsStyle}>
          <input id="next-name" name="name" autoComplete="name" required mix={inputStyle} />
          <button type="submit" disabled={isPending} aria-busy={isPending} mix={buttonStyle}>
            {isPending ? 'Submitting…' : 'Submit again'}
          </button>
        </div>
      </form>
      <p mix={bodyStyle}>
        This form targets the current URL, so it replaces the active history entry. The first
        submission from <a href={routes.home.href()}>home</a> pushes a new entry.
      </p>
    </article>
  )
}

export function NotFoundPage() {
  return () => (
    <article>
      <p mix={eyebrowStyle}>404</p>
      <h1 mix={titleStyle}>Page not found</h1>
      <p mix={bodyStyle}>
        Try going back to the <a href={routes.home.href()}>home page</a>.
      </p>
    </article>
  )
}

export function LoadingPage() {
  return () => (
    <div role="status" mix={loadingStyle}>
      Loading…
    </div>
  )
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
  '&:disabled': { cursor: 'wait', opacity: 0.7 },
})
const loadingStyle = css({
  width: '100%',
  padding: '2rem',
  textAlign: 'center',
  color: '#6a48d7',
  fontSize: '1.125rem',
})
