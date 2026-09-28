import { type Handle, css } from 'remix/ui'
import type { RemixNode } from 'remix/ui/jsx-runtime'

import { routes } from '../routes.ts'

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
          {showLoading ? <LoadingIndicator /> : handle.props.children}
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

export function LoadingIndicator() {
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
const loadingStyle = css({
  width: '100%',
  padding: '2rem',
  textAlign: 'center',
  color: '#6a48d7',
  fontSize: '1.125rem',
})
