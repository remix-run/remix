import { createDomReconciler, css, on } from '@remix-run/dom'

let baseButton = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minWidth: 120,
  border: 'none',
  borderRadius: 14,
  padding: '12px 16px',
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 0.2,
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'transform 120ms ease, box-shadow 120ms ease, filter 160ms ease',
  ':hover': {
    transform: 'translateY(-1px)',
    filter: 'brightness(1.06)',
  },
  ':active': {
    transform: 'translateY(1px) scale(0.99)',
  },
  ':focus-visible': {
    outline: '3px solid rgba(255,255,255,0.75)',
    outlineOffset: 2,
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
    transform: 'none',
  },
})

let pink = css({
  color: '#fff',
  background: 'linear-gradient(135deg, #ff4d8d 0%, #ff7a18 100%)',
  boxShadow: '0 10px 26px rgba(255, 94, 143, 0.35)',
})

let ocean = css({
  color: '#e8fcff',
  background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
  boxShadow: '0 10px 26px rgba(37, 99, 235, 0.35)',
})

let mint = css({
  color: '#082f21',
  background: 'linear-gradient(135deg, #34d399 0%, #a7f3d0 100%)',
  boxShadow: '0 10px 26px rgba(16, 185, 129, 0.26)',
})

let glass = css({
  color: '#f8fafc',
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(15, 23, 42, 0.35)',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 8px 24px rgba(2, 6, 23, 0.45)',
  ':hover': {
    borderColor: 'rgba(255,255,255,0.6)',
  },
})

let page = css({
  margin: 0,
  padding: 24,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  color: '#e2e8f0',
  background: 'radial-gradient(circle at 20% 0%, #1e293b 0%, #0f172a 52%, #020617 100%)',
})

let card = css({
  maxWidth: 760,
  margin: '0 auto',
  padding: 24,
  borderRadius: 18,
  background: 'rgba(15, 23, 42, 0.72)',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  boxShadow: '0 20px 50px rgba(2, 6, 23, 0.5)',
})

let row = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 16,
})

function App(handle: { update(): Promise<AbortSignal> }, _setup: unknown) {
  let clicks = 0
  return () => (
    <main mix={[page]}>
      <section mix={[card]}>
        <h1 style={{ margin: 0, fontSize: '30px' }}>css() mixin demo</h1>
        <p style={{ marginTop: '10px', color: '#94a3b8' }}>
          Layer reusable style mixes with pseudo selectors and transitions.
        </p>

        <div mix={[row]}>
          <button mix={[baseButton, pink]}>Pink Burst</button>
          <button mix={[baseButton, ocean]}>Ocean Beam</button>
          <button mix={[baseButton, mint]}>Mint Pop</button>
          <button mix={[baseButton, glass]}>Glass Night</button>
        </div>

        <div mix={[row]} style={{ marginTop: '20px' }}>
          <button
            mix={[
              baseButton,
              ocean,
              on('click', () => {
                clicks++
                void handle.update()
              }),
            ]}
            disabled={clicks >= 10}
          >
            Click me
          </button>
          <button
            mix={[
              baseButton,
              glass,
              on('click', () => {
                clicks = 0
                void handle.update()
              }),
            ]}
          >
            Reset
          </button>
          <span style={{ alignSelf: 'center', color: '#cbd5e1' }}>Clicks: {clicks}</span>
        </div>
      </section>
    </main>
  )
}

document.body.style.margin = '0'
let reconciler = createDomReconciler(document)
let root = reconciler.createRoot(document.body)
root.render(<App />)
