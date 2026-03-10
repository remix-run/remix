import type { RemixNode } from 'remix/component'
import type { Route } from 'remix/fetch-router/routes'

type NavLinkProps = {
  route: Route<any, string>
  active?: boolean
  target?: string
  frameSrc?: string
  children?: RemixNode
}

export function NavLink() {
  return ({ route, active, target: frameTarget, frameSrc, children }: NavLinkProps) => {
    let href = route.href()

    return (
      <a
        href={href}
        aria-current={active ? 'page' : undefined}
        rmx-target={frameTarget}
        rmx-src={frameSrc}
      >
        {children}
      </a>
    )
  }
}
