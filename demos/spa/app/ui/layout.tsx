import { css, type Handle, type RemixNode } from 'remix/ui'
import { SPA } from 'remix/ui/spa'

import { routes } from '../routes.ts'

interface LayoutProps {
  children?: RemixNode
}

export function Fallback() {
  return () => (
    <Layout>
      <LoadingPage />
    </Layout>
  )
}

export function Layout(handle: Handle<LayoutProps>) {
  let router = handle.context.get(SPA)

  return () => {
    let isPending = router.pending != null
    let content = isPending ? <LoadingPage /> : handle.props.children

    return (
      <div mix={appShellStyle}>
        <div mix={contentStyle}>
          <header mix={headerStyle}>
            <a href={routes.home.href()} mix={brandStyle}>
              Remix SPA
            </a>
            <nav aria-label="Main navigation" mix={navStyle}>
              <a
                href={routes.home.href()}
                aria-current={router.active.pathname === routes.home.href() ? 'page' : undefined}
                mix={navLinkStyle}
              >
                Home
              </a>
              <a
                href={routes.about.href()}
                aria-current={router.active.pathname === routes.about.href() ? 'page' : undefined}
                mix={navLinkStyle}
              >
                About
              </a>
            </nav>
          </header>
          <main aria-busy={isPending} mix={mainStyle}>
            {content}
          </main>
        </div>
      </div>
    )
  }
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
  '& *': {
    boxSizing: 'border-box',
  },
})

const contentStyle = css({
  width: 'min(100% - 2rem, 48rem)',
  margin: '0 auto',
})

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

const navStyle = css({
  display: 'flex',
  gap: '0.5rem',
})

const navLinkStyle = css({
  borderRadius: 999,
  padding: '0.5rem 0.75rem',
  color: '#5b36d6',
  textDecoration: 'none',
  '&:hover, &[aria-current="page"]': {
    backgroundColor: '#e7e0ff',
  },
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
  color: '#6a48d7',
  fontSize: '1.125rem',
})
