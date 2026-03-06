import type { Handle, RemixNode } from 'remix/component'
import type { Route } from 'remix/fetch-router/routes'

import { controllerFor, matchController, routeAddsControllerSegments } from '../../config/routes.ts'

type NavLinkProps = {
  route: Route<any, string>
  match?: 'route' | 'controller'
  target?: string
  frameSrc?: string
  children?: RemixNode
}

export function NavLink(handle: Handle) {
  handle.queueTask((signal) => {
    window.navigation.addEventListener(
      'navigate',
      () => {
        void handle.update()
      },
      { signal },
    )
  })

  return ({ route, match = 'route', target: frameTarget, frameSrc, children }: NavLinkProps) => {
    let href = route.href()
    let controller = controllerFor(route)
    let isActive = route.match(handle.frames.top.src) != null
    if (
      !isActive &&
      match === 'controller' &&
      controller &&
      !routeAddsControllerSegments(route) &&
      href !== '/'
    ) {
      isActive = matchController(controller, handle.frames.top.src)
    }

    return (
      <a
        href={href}
        aria-current={isActive ? 'page' : undefined}
        rmx-target={frameTarget}
        rmx-src={frameSrc ?? (frameTarget ? href : undefined)}
      >
        {children}
      </a>
    )
  }
}
