import { createRoot, type Handle, type Renderable } from '@remix-run/component'

function App(this: Handle) {
  let count = 0
  return () => (
    <>
      <button
        on={{
          click: () => {
            count++
            this.update()
          },
        }}
      >
        Ye ol' counter: {count}
      </button>
      <div css={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        <svg width="100" height="100" css={{ border: '1px solid black' }}>
          <a href="https://www.google.com">
            <circle cx="50" cy="50" r="40" fill="red" />
          </a>
        </svg>
        <svg width="100" height="100" css={{ border: '1px solid black' }}>
          {/* Something is broken in rendering, this doesn't appear */}
          <SvgLink href="https://www.google.com">
            <circle cx="50" cy="50" r="40" fill="red" />
          </SvgLink>
        </svg>
        <svg width="100" height="100" css={{ border: '1px solid black' }}>
          {/* Neither does this */}
          <SvgGroup>
            <circle cx="50" cy="50" r="40" fill="red" />
          </SvgGroup>
        </svg>
      </div>
      {/* This issue is only unique to SVGs, here outside of an SVG a wrapper component renders fine */}
      <SvgLink href="https://www.google.com">
        <p>This is a link</p>
      </SvgLink>
    </>
  )
}

function SvgLink({ href, children }: { href: string; label: string; children: Renderable }) {
  return <a href={href}>{children}</a>
}

function SvgGroup({ children }: { children: Renderable }) {
  return <g>{children}</g>
}

createRoot(document.body).render(<App />)
