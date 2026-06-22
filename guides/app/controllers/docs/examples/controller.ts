import { access } from 'node:fs/promises'

import { createController } from 'remix/router'

import type { AppContext } from '../../../middleware/render.ts'
import { routes } from '../../../routes.ts'

const exampleSegmentPattern = /^[a-z0-9][a-z0-9-]*$/

type ExampleRouteContext = AppContext & {
  params: {
    chapter: string
    example: string
  }
}

type ExampleHandler = (context: AppContext) => Response | Promise<Response>

type ExampleModule = {
  handler?: unknown
}

export const docsExamplesController = createController(routes.docs.examples, {
  actions: {
    show: showExampleHandler,
  },
})

async function showExampleHandler(context: ExampleRouteContext) {
  let { chapter, example } = context.params

  if (!exampleSegmentPattern.test(chapter) || !exampleSegmentPattern.test(example)) {
    return new Response('Not Found', { status: 404 })
  }

  let handler = await loadExampleHandler(chapter, example)
  if (!handler) {
    return new Response('Not Found', { status: 404 })
  }

  return handler(context)
}

async function loadExampleHandler(
  chapter: string,
  example: string,
): Promise<ExampleHandler | undefined> {
  let moduleUrl = new URL(`./${chapter}/${example}.tsx`, import.meta.url)

  try {
    await access(moduleUrl)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined
    }

    throw error
  }

  let mod = (await import(moduleUrl.href)) as ExampleModule
  return typeof mod.handler === 'function' ? (mod.handler as ExampleHandler) : undefined
}
