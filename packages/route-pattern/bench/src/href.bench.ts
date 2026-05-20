/**
 * This file benchmarks href generation for parsed route patterns.
 *
 * The purpose of this benchmark is to capture current performance with `pnpm bench href --outputJson=main.json`
 * on the `main` branch, and then compare that to the performance of a feature branch with `pnpm bench href --compare=main.json`.
 *
 * Therefore, all `bench` calls happen in their own `describe` block, and the name passed to `bench` is arbitrary.
 */

import { execSync } from 'node:child_process'
import { bench, describe } from 'vitest'
import { RoutePattern } from '@remix-run/route-pattern'
import { createHref } from '@remix-run/route-pattern/href'

let benchName = getBenchName()

/**
 * Returns the benchmark name as `<branch> (<short commit>)`.
 * Fallback to 'bench' if git commands fail.
 */
function getBenchName(): string {
  try {
    let branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
    let shortCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
    return `${branch} (${shortCommit})`
  } catch {
    return 'bench'
  }
}

describe('static', () => {
  let pattern = RoutePattern.parse('/posts/new')
  bench(benchName, () => {
    createHref(pattern)
  })
})

describe('one variable', () => {
  let pattern = RoutePattern.parse('/posts/:id')
  bench(benchName, () => {
    createHref(pattern, { id: '123' })
  })
})

describe('one wildcard', () => {
  let pattern = RoutePattern.parse('/files/*path')
  bench(benchName, () => {
    createHref(pattern, { path: 'docs/readme.md' })
  })
})

describe('multiple variables', () => {
  let pattern = RoutePattern.parse('/users/:userId/posts/:postId')
  bench(benchName, () => {
    createHref(pattern, { userId: '42', postId: '123' })
  })
})

describe('optional, all params', () => {
  let pattern = RoutePattern.parse('/posts(/:id)')
  bench(benchName, () => {
    createHref(pattern, { id: '123' })
  })
})

describe('optional, omit', () => {
  let pattern = RoutePattern.parse('/posts(/:id)')
  bench(benchName, () => {
    createHref(pattern)
  })
})

describe('complex (8 variants), all params', () => {
  let pattern = RoutePattern.parse(
    '/dashboard/:tenant/files/*path/view(/:year(/:month(/:day)))(/format/:fmt)',
  )
  bench(benchName, () => {
    createHref(pattern, {
      tenant: 'acme',
      path: 'client/reports',
      year: '2024',
      month: '01',
      day: '15',
      fmt: 'pdf',
    })
  })
})

describe('complex (8 variants), no optionals', () => {
  let pattern = RoutePattern.parse(
    '/dashboard/:tenant/files/*path/view(/:year(/:month(/:day)))(/format/:fmt)',
  )
  bench(benchName, () => {
    createHref(pattern, {
      tenant: 'acme',
      path: 'client/reports',
    })
  })
})

describe('with search params', () => {
  let pattern = RoutePattern.parse('/posts/:id?tag=featured&tag=popular')
  bench(benchName, () => {
    createHref(pattern, { id: '123' }, { tag: 'tutorial' })
  })
})
