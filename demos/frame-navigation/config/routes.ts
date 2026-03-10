import { form, get, post, route } from 'remix/fetch-router/routes'
import { Route } from 'remix/fetch-router/routes'
import type { RouteDefs, RouteMap } from 'remix/fetch-router/routes'

type NavRoute = Route<any, string>
type NavController = RouteMap<string>

export let frames = {
  settings: 'settings',
} as const

let routeControllers = new WeakMap<NavRoute, NavController>()
let controllerPrefixes = new WeakMap<NavController, string>()

export function controllerFor(route: NavRoute): NavController | undefined {
  return routeControllers.get(route)
}

export function routeAddsControllerSegments(route: NavRoute): boolean {
  let controller = controllerFor(route)
  let controllerPrefix = controller && controllerPrefixes.get(controller)
  if (!controllerPrefix) return true

  return normalizePathname(route.pattern.pathname) !== controllerPrefix
}

export function matchController(controller: NavController, url: string | URL): boolean {
  for (let value of Object.values(controller)) {
    if (value instanceof Route) {
      if (value.match(url)) return true
      continue
    }

    if (matchController(value, url)) return true
  }

  return false
}

function controller<base extends string, const defs extends RouteDefs>(prefix: base, defs: defs) {
  let routes = route(prefix, defs)
  controllerPrefixes.set(routes, normalizePathname(prefix))
  registerControllers(routes)
  return routes
}

function registerControllers(controller: NavController) {
  for (let value of Object.values(controller)) {
    if (value instanceof Route) {
      routeControllers.set(value, controller)
      continue
    }

    registerControllers(value)
  }
}

function normalizePathname(pathname: string): string {
  let normalized = pathname.replace(/^\/+|\/+$/g, '')
  return normalized === '' ? '/' : `/${normalized}`
}

export let routes = {
  main: controller('/', {
    index: get('/'),
    courses: get('courses'),
    calendar: get('calendar'),
    account: get('account'),
  }),
  auth: controller('auth', {
    index: get('/'),
    login: form('login'),
    logout: post('logout'),
  }),
  settings: controller('settings', {
    index: get('/'),
    profile: get('profile'),
    notifications: get('notifications'),
    privacy: get('privacy'),
    grading: get('grading'),
    integrations: get('integrations'),
  }),
}
