import { clientEntry, css, link, navigate, on, type Handle } from 'remix/component'

type NavLinkProps = {
  href: string
  target?: string
  permalink?: string
  children?: any
}

type NavigateButtonProps = {
  href: string
  target?: string
  permalink?: string
  children?: any
}

let linkStyle = css({
  color: '#d3ddff',
  textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 8,
  padding: '6px 10px',
  display: 'inline-block',
  '&:hover': {
    background: 'rgba(255,255,255,0.08)',
  },
})

let buttonStyle = css({
  color: '#d3ddff',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 8,
  padding: '6px 10px',
  background: 'rgba(255,255,255,0.02)',
  cursor: 'pointer',
  '&:hover': {
    background: 'rgba(255,255,255,0.08)',
  },
})

export let NavLink = clientEntry(
  '/assets/nav-controls.js#NavLink',
  (_handle: Handle) =>
    ({ href, target, permalink, children }: NavLinkProps) => (
      <a
        mix={[
          link(href, {
            target,
            permalink,
          }),
          linkStyle,
        ]}
      >
        {children}
      </a>
    ),
)

export let NavigateButton = clientEntry(
  '/assets/nav-controls.js#NavigateButton',
  (_handle: Handle) =>
    ({ href, target, permalink, children }: NavigateButtonProps) => (
      <button
        type="button"
        mix={[
          buttonStyle,
          on('click', () => {
            void navigate(href, { target, permalink })
          }),
        ]}
      >
        {children}
      </button>
    ),
)
