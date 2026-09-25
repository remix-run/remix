import { type Handle, css, on } from 'remix/ui'

import { routes } from '../routes.ts'
import { Layout } from '../ui/app-shell.tsx'

interface PageProps {
  url: URL
}

export function HomePage(handle: Handle<PageProps>) {
  return () => (
    <Layout url={handle.props.url}>
      <article>
        <p mix={eyebrowStyle}>Home</p>
        <h1 mix={titleStyle}>A client-only Remix app</h1>
        <p mix={bodyStyle}>
          Route handlers use <code>render()</code> while the SPA runtime preserves the fetch
          router's <code>Request</code>-to-<code>Response</code> contract.
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
    </Layout>
  )
}

export function AboutPage(handle: Handle<PageProps>) {
  return () => (
    <Layout url={handle.props.url}>
      <article>
        <p mix={eyebrowStyle}>About</p>
        <h1 mix={titleStyle}>URLs in, rendered UI out</h1>
        <p mix={bodyStyle}>
          Each route waits briefly before returning a SPA response, making top-frame loading and
          cancellation visible without introducing a second navigation system.
        </p>
      </article>
    </Layout>
  )
}

export function NotFoundPage(handle: Handle<PageProps>) {
  return () => (
    <Layout url={handle.props.url}>
      <article>
        <p mix={eyebrowStyle}>404</p>
        <h1 mix={titleStyle}>Page not found</h1>
        <p mix={bodyStyle}>
          Try going back to the <a href={routes.home.href()}>home page</a>.
        </p>
      </article>
    </Layout>
  )
}

interface GreetingPageProps extends PageProps {
  isSubmission?: boolean
  name: string
}

export function GreetingPage(handle: Handle<GreetingPageProps>) {
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
    <Layout url={handle.props.url}>
      <article>
        {handle.props.isSubmission ? <p mix={eyebrowStyle}>Form submitted</p> : null}
        <h1 mix={titleStyle}>Hello, {handle.props.name}!</h1>
        <p mix={bodyStyle}>
          The frame navigation listener turns the native form navigation into a routed request. Back
          and forward traversals revisit this URL with GET because history entries do not retain
          form data.
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
    </Layout>
  )
}

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
