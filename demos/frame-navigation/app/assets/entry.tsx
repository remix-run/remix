import { animateEntrance, createRoot, css, on, run, spring } from 'remix/component'

let app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    let exp = (mod as any)[exportName]
    if (typeof exp !== 'function') {
      throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a function`)
    }
    return exp
  },
  async resolveFrame(src, signal, target) {
    let headers = new Headers()
    headers.set('accept', 'text/html')
    headers.set('x-remix-frame', 'true')
    headers.set('x-remix-top-frame-src', window.location.href)

    if (target) {
      headers.set('x-remix-target', target)
    }

    let res = await fetch(src, { headers, signal })
    if (!res.ok) {
      return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
    }
    if (res.body) return res.body
    return await res.text()
  },
})

app.addEventListener('error', async (event) => {
  app.dispose()
  await fadeOutBody()

  let message = 'message' in event.error ? event.error.message : 'Unknown error'
  createRoot(document.body).render(
    <div mix={pageCss}>
      <div mix={[cardCss, animateGentlyIn]}>
        <p mix={eyebrowCss}>Unexpected Error</p>
        <h1 mix={titleCss}>Something went wrong</h1>
        <p mix={messageCss}>{message}</p>
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
      </div>
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

let pageCss = css({
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '32px',
  background: '#f8fafc',
  color: '#0f172a',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
})

let cardCss = css({
  width: '100%',
  maxWidth: '560px',
  padding: '40px 36px',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '20px',
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)',
})

let animateGentlyIn = animateEntrance({
  opacity: 0,
  transform: 'translateY(-14px) scale(0.97)',
  ...spring('smooth'),
})

let eyebrowCss = css({
  margin: '0 0 12px',
  fontSize: '12px',
  fontWeight: '600',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#64748b',
})

let titleCss = css({
  margin: '0 0 12px',
  fontSize: '32px',
  lineHeight: '1.1',
  fontWeight: '700',
})

let messageCss = css({
  margin: '0',
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#475569',
})

let reloadButtonCss = css({
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
