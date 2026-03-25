import type { FrameContent, RemixNode } from 'remix/component'
import { animateEntrance, createRoot, css, on, run, spring } from 'remix/component'

import { routes } from '../routes.ts'

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    let exp = (mod as any)[exportName]
    if (typeof exp !== 'function') {
      throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a function`)
    }
    return exp
  },
  async resolveFrame(src, signal, target) {
    return resolveFrameResponse(new URL(src, window.location.href), signal, target)
  },
})

async function resolveFrameResponse(
  url: URL,
  signal?: AbortSignal,
  target?: string,
): Promise<FrameContent> {
  let headers = new Headers()
  headers.set('accept', 'text/html')
  headers.set('x-remix-frame', 'true')

  if (target) {
    headers.set('x-remix-target', target)
  }

  let res = await fetch(url, { headers, signal })

  if (res.status === 401) {
    window.location.assign(routes.auth.login.index.href())
    return new Promise(() => {})
  }

  if (!res.ok) {
    return (
      <ErrorCard
        eyebrow="Unexpected Error"
        title="Reload required"
        message="An unexpected error occurred. Please reload the page to try again."
        action={
          <a rmx-document href={window.location.href} mix={actionLinkCss}>
            Reload
          </a>
        }
      />
    )
  }

  if (res.body) return res.body
  return await res.text()
}

app.addEventListener('error', async (event) => {
  app.dispose()
  await fadeOutBody()

  let message = 'message' in event.error ? event.error.message : 'Unknown error'
  createRoot(document.body).render(
    <div mix={pageCss}>
      <ErrorCard
        eyebrow="Unexpected Error"
        title="Something went wrong"
        message={message}
        animated
        action={
          <button
            mix={[
              reloadButtonCss,
              on('click', () => {
                window.location.reload()
              }),
            ]}
          >
            Reload the page
          </button>
        }
      />
    </div>,
  )
})

async function fadeOutBody() {
  let animation = document.body.animate(
    [
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(10px) scale(0.985)' },
    ],
    { ...spring('snappy') },
  )

  await animation.finished
  document.body.innerHTML = ''
}

type ErrorCardProps = {
  eyebrow: string
  title: string
  message: string
  action?: RemixNode
  animated?: boolean
}

function ErrorCard() {
  return ({ eyebrow, title, message, action, animated }: ErrorCardProps) => (
    <div mix={animated ? [cardCss, animateGentlyIn] : cardCss}>
      <p mix={eyebrowCss}>{eyebrow}</p>
      <h1 mix={titleCss}>{title}</h1>
      <p mix={messageCss}>{message}</p>
      {action}
    </div>
  )
}

const pageCss = css({
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '32px',
  background: '#f8fafc',
  color: '#0f172a',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
})

const cardCss = css({
  width: '100%',
  maxWidth: '560px',
  padding: '40px 36px',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '20px',
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)',
})

const animateGentlyIn = animateEntrance({
  opacity: 0,
  transform: 'translateY(-14px) scale(0.97)',
  ...spring('smooth'),
})

const eyebrowCss = css({
  margin: '0 0 12px',
  fontSize: '12px',
  fontWeight: '600',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#64748b',
})

const titleCss = css({
  margin: '0 0 12px',
  fontSize: '32px',
  lineHeight: '1.1',
  fontWeight: '700',
})

const messageCss = css({
  margin: '0',
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#475569',
})

const reloadButtonCss = css({
  marginTop: '24px',
  padding: '12px 18px',
  border: 'none',
  borderRadius: '999px',
  background: '#0f172a',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '1',
  cursor: 'pointer',
  '&:hover': {
    background: '#1e293b',
  },
})

const actionLinkCss = css({
  display: 'inline-flex',
  marginTop: '24px',
  padding: '12px 18px',
  borderRadius: '999px',
  background: '#0f172a',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '1',
  textDecoration: 'none',
  '&:hover': {
    background: '#1e293b',
  },
})
