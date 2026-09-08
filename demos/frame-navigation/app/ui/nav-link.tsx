import type { Handle, RemixNode } from 'remix/ui'
import type { Route } from 'remix/routes'

type NavLinkProps = {
  route: Route<any, string>
  active?: boolean
  target?: string
  frameSrc?: string
  children?: RemixNode
}

export function NavLink(handle: Handle<NavLinkProps>) {
  return () => {
    let { route, active, target: frameTarget, frameSrc, children } = handle.props
    let href = route.href()

    return (
      <a
        href={href}
        aria-current={active ? 'page' : undefined}
        data-rmx-target={frameTarget}
        data-rmx-src={frameSrc}
      >
        {children}
      </a>
    )
  }
}
