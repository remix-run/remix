import type { RemixNode, VirtualRoot, VirtualRootOptions } from '@remix-run/component'
import {
  createTestContext,
  type CreateTestContextOptions,
  type TestContext,
  type TestContextFactoryResult,
} from './context.ts'

export interface RenderResult {
  container: HTMLElement
  root: VirtualRoot
  $: (s: string) => HTMLElement | null
  $$: (s: string) => NodeListOf<HTMLElement>
  act: (fn: () => unknown | Promise<unknown>) => Promise<void>
  cleanup: () => void
}

export type RenderFn = (
  node: RemixNode,
  opts?: { container?: HTMLElement } & VirtualRootOptions,
) => RenderResult

/**
 * Test Context for browser-based component tests. Extends the base {@link TestContext}
 * with a {@link DomTestContext.render} method for mounting components into the DOM.
 */
export interface DomTestContext extends TestContext {
  /**
   * Renders a component for testing purposes.
   *
   * @param node - The component node to render
   * @param opts.container - An optional container element to render into (defaults to a new div appended to the document body)
   * @returns An object containing the rendered container, root, and utility
   * functions for querying and interacting with the rendered output
   */
  render: RenderFn
}

export interface CreateDomTestContextOptions extends CreateTestContextOptions {
  render: RenderFn
}

export function createDomTestContext(
  options: CreateDomTestContextOptions,
): TestContextFactoryResult<DomTestContext> {
  let { render, ...baseOptions } = options
  let base = createTestContext(baseOptions)
  let renderCleanups: Array<() => void> = []

  let testContext: DomTestContext = {
    ...base.testContext,
    render(node, opts) {
      let result = render(node, opts)
      renderCleanups.push(result.cleanup)
      return result
    },
  }

  return {
    testContext,
    async cleanup() {
      for (let fn of renderCleanups) fn()
      renderCleanups.length = 0
      await base.cleanup()
    },
  }
}
