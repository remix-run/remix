import { access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { createController } from 'remix/router'

import type { AppContext } from '../../../router.ts'
import { routes } from '../../../routes.ts'

const exampleSegmentPattern = /^[a-z0-9][a-z0-9-]*$/

type ExampleRouteContext = AppContext & {
  params: {
    chapter: string
    example: string
  }
}

type ExampleHandler = (context: AppContext) => Response | Promise<Response>

export default createController(routes.docs.examples, {
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
    if (isNotFoundError(error)) {
      return undefined
    }

    throw error
  }

  let mod: unknown = await import(moduleUrl.href)
  return readExampleHandler(mod, moduleUrl)
}

function readExampleHandler(mod: unknown, moduleUrl: URL): ExampleHandler | undefined {
  if (mod && typeof mod === 'object' && 'handler' in mod && typeof mod.handler === 'function') {
    let handler = mod.handler

    return async (context) => {
      let result = await handler(context)
      if (result instanceof Response) {
        return result
      }

      throw new Error(`Expected example handler to return a Response: ${fileURLToPath(moduleUrl)}`)
    }
  }

  return undefined
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
