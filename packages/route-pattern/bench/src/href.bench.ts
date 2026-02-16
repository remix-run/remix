/**
 * This file benchmarks the `href` method of the `RoutePattern` class.
 *
 * The purpose of this benchmark is to capture current performance with `pnpm bench href --outputJson=main.json`
 * on the `main` branch, and then compare that to the performance of a feature branch with `pnpm bench href --compare=main.json`.
 *
 * Therefore, all `bench` calls happen in their own `describe` block, and the name passed to `bench` is arbitrary.
 */

import { execSync } from 'node:child_process'
import { bench, describe } from 'vitest'
import { RoutePattern } from '@remix-run/route-pattern'

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
  let pattern = new RoutePattern('/posts/new')
  bench(benchName, () => {
    pattern.href()
  })
})

describe('one variable', () => {
  let pattern = new RoutePattern('/posts/:id')
  bench(benchName, () => {
    pattern.href({ id: '123' })
  })
})

describe('one wildcard', () => {
  let pattern = new RoutePattern('/files/*path')
  bench(benchName, () => {
    pattern.href({ path: 'docs/readme.md' })
  })
})

describe('multiple variables', () => {
  let pattern = new RoutePattern('/users/:userId/posts/:postId')
  bench(benchName, () => {
    pattern.href({ userId: '42', postId: '123' })
  })
})

describe('optional, all params', () => {
  let pattern = new RoutePattern('/posts(/:id)')
  bench(benchName, () => {
    pattern.href({ id: '123' })
  })
})

describe('optional, omit', () => {
  let pattern = new RoutePattern('/posts(/:id)')
  bench(benchName, () => {
    pattern.href()
  })
})

describe('complex (8 variants), all params', () => {
  let pattern = new RoutePattern(
    '/dashboard/:tenant/files/*path/view(/:year(/:month(/:day)))(/format/:fmt)',
  )
  bench(benchName, () => {
    pattern.href({
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
  let pattern = new RoutePattern(
    '/dashboard/:tenant/files/*path/view(/:year(/:month(/:day)))(/format/:fmt)',
  )
  bench(benchName, () => {
    pattern.href({
      tenant: 'acme',
      path: 'client/reports',
    })
  })
})

describe('with search params', () => {
  let pattern = new RoutePattern('/posts/:id?tag=featured&tag=popular')
  bench(benchName, () => {
    pattern.href({ id: '123' }, { tag: 'tutorial' })
  })
})
