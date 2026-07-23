import { createController } from 'remix/router'
import { css, type Handle } from 'remix/ui'

import { routes } from '../routes.ts'

export default createController(routes, {
  actions: {
    async home(context) {
      await sleep(1000, context.request.signal)
      return <HomePage />
    },

    async about(context) {
      await sleep(1000, context.request.signal)
      return <AboutPage />
    },

    async greet(context) {
      let name = ''
      if (context.request.method === 'POST') {
        let formData = await context.request.formData()
        let value = formData.get('name')
        name = typeof value === 'string' ? value.trim() : ''
      }

      await sleep(1000, context.request.signal)
      return <GreetingPage name={name || 'friend'} />
    },
  },
})

function HomePage() {
  return () => (
    <article>
      <p mix={eyebrowStyle}>Home</p>
      <h1 mix={titleStyle}>A client-only Remix app</h1>
      <p mix={bodyStyle}>
        This page came directly from a fetch router handler. No HTTP request or response was
        involved.
      </p>
      <form method="POST" action={routes.greet.href()} mix={formStyle}>
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

function AboutPage() {
  return () => (
    <article>
      <p mix={eyebrowStyle}>About</p>
      <h1 mix={titleStyle}>URLs in, rendered UI out</h1>
      <p mix={bodyStyle}>
        Each route waits briefly before returning a <code>RemixNode</code>, so the loading and
        cancellation behavior is easy to see.
      </p>
    </article>
  )
}

function GreetingPage(handle: Handle<{ name: string }>) {
  return () => (
    <article>
      <p mix={eyebrowStyle}>Form submitted</p>
      <h1 mix={titleStyle}>Hello, {handle.props.name}!</h1>
      <p mix={bodyStyle}>
        POST submissions expose the Navigation API's form data through{' '}
        <code>context.request.formData()</code> without making an HTTP request. History traversals
        return here with GET because navigation entries do not retain <code>FormData</code>.
      </p>
      <form method="POST" action={routes.greet.href()} mix={formStyle}>
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
        Because this form submits to the current URL, it replaces the current history entry. The{' '}
        <a href={routes.home.href()} mix={linkStyle}>
          first submission
        </a>{' '}
        pushed a new entry because it navigated here from another URL.
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
        Try going back to the{' '}
        <a href={routes.home.href()} mix={linkStyle}>
          home page
        </a>
        .
      </p>
    </article>
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

const eyebrowStyle = css({
  margin: '0 0 0.5rem',
  color: '#6a48d7',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
})

const titleStyle = css({
  margin: 0,
  fontSize: 'clamp(2rem, 7vw, 3.5rem)',
  lineHeight: 1.05,
})

const bodyStyle = css({
  maxWidth: '38rem',
  margin: '1.5rem 0 0',
  color: '#5c5965',
  fontSize: '1.125rem',
  lineHeight: 1.7,
})

const formStyle = css({
  display: 'grid',
  gap: '0.75rem',
  maxWidth: '30rem',
  marginTop: '2rem',
})

const labelStyle = css({
  fontWeight: 700,
})

const formControlsStyle = css({
  display: 'flex',
  gap: '0.75rem',
})

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

const linkStyle = css({
  color: '#5b36d6',
})
