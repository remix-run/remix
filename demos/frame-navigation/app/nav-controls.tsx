import { css } from 'remix/component'

type NavLinkProps = {
  href: string
  target?: string
  src?: string
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

export function NavLink() {
  return ({ href, target, src, children }: NavLinkProps) => (
    <a href={href} rmx-target={target} rmx-src={src} mix={[linkStyle]}>
      {children}
    </a>
  )
}
