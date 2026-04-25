import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createRouter } from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'

import { logger } from './logger.ts'

const reset = '\x1b[0m'
const green = (value: string): string => `\x1b[32m${value}${reset}`
const cyan = (value: string): string => `\x1b[36m${value}${reset}`
const yellow = (value: string): string => `\x1b[33m${value}${reset}`
const red = (value: string): string => `\x1b[31m${value}${reset}`

describe('logger', () => {
  it('logs the request', async () => {
    let { message, response } = await logRequest({
      loggerOptions: { colors: false },
      response: new Response('Home', {
        headers: {
          'Content-Length': '4',
          'Content-Type': 'text/plain',
        },
      }),
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
    assert.match(message, /\[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}\] GET \/ \d+ \d+/)
  })

  it('colorizes high-signal tokens when colors are enabled', async () => {
    await withNoColor(undefined, async () => {
      let { message } = await logRequest({
        loggerOptions: {
          colors: true,
          format: '%method %status %duration %contentLength',
        },
        response: new Response('Home', {
          headers: {
            'Content-Length': '2048',
          },
        }),
      })

      let [method, status, duration, contentLength] = message.split(' ')

      assert.equal(method, green('GET'))
      assert.equal(status, green('200'))
      assert.match(duration, /^\x1b\[(32|33|35|31)m\d+\x1b\[0m$/)
      assert.equal(contentLength, cyan('2048'))
    })
  })

  it('colorizes methods, statuses, and content lengths by severity', async () => {
    await withNoColor(undefined, async () => {
      let { message } = await logRequest({
        loggerOptions: {
          colors: true,
          format: '%method %status %contentLength',
        },
        requestInit: {
          method: 'DELETE',
        },
        response: new Response('Nope', {
          status: 404,
          headers: {
            'Content-Length': '204800',
          },
        }),
      })

      assert.equal(message, `${red('DELETE')} ${yellow('404')} ${yellow('204800')}`)
    })
  })

  it('opts out of colors with the colors option', async () => {
    await withNoColor(undefined, async () => {
      let { message } = await logRequest({
        loggerOptions: {
          colors: false,
          format: '%method %status %contentLength',
        },
        response: new Response('Home', {
          headers: {
            'Content-Length': '2048',
          },
        }),
      })

      assert.equal(message, 'GET 200 2048')
    })
  })

  it('respects NO_COLOR when the process global is defined', async () => {
    await withNoColor('1', async () => {
      let { message } = await logRequest({
        loggerOptions: {
          colors: true,
          format: '%method %status %contentLength',
        },
        response: new Response('Home', {
          headers: {
            'Content-Length': '2048',
          },
        }),
      })

      assert.equal(message, 'GET 200 2048')
    })
  })

  it('enables colors by default in TTY environments', async () => {
    await withNoColor(undefined, async () => {
      await withTTY(true, async () => {
        let { message } = await logRequest({
          loggerOptions: {
            format: '%method %status',
          },
        })

        assert.equal(message, `${green('GET')} ${green('200')}`)
      })
    })
  })

  it('leaves colors off by default outside TTY environments', async () => {
    await withNoColor(undefined, async () => {
      await withTTY(false, async () => {
        let { message } = await logRequest({
          loggerOptions: {
            format: '%method %status %contentLength',
          },
          response: new Response('Home', {
            headers: {
              'Content-Length': '2048',
            },
          }),
        })

        assert.equal(message, 'GET 200 2048')
      })
    })
  })

  it('leaves invalid content lengths uncolored', async () => {
    await withNoColor(undefined, async () => {
      let { message } = await logRequest({
        loggerOptions: {
          colors: true,
          format: '%contentLength',
        },
        response: new Response('Home', {
          headers: {
            'Content-Length': 'bad',
          },
        }),
      })

      assert.equal(message, 'bad')
    })
  })
})

async function logRequest({
  loggerOptions = {},
  requestInit,
  response = new Response('Home'),
}: {
  loggerOptions?: Parameters<typeof logger>[0]
  requestInit?: RequestInit
  response?: Response
}): Promise<{ message: string; response: Response }> {
  let routes = route({
    home: '/',
  })

  let messages: string[] = []

  let router = createRouter({
    middleware: [
      logger({
        ...loggerOptions,
        log: (message) => messages.push(message),
      }),
    ],
  })

  router.map(routes.home, () => response)

  let result = await router.fetch('https://remix.run', requestInit)

  assert.equal(messages.length, 1)

  return {
    message: messages[0],
    response: result,
  }
}

async function withNoColor<result>(
  value: string | undefined,
  callback: () => Promise<result>,
): Promise<result> {
  let hadNoColor = Object.hasOwn(process.env, 'NO_COLOR')
  let previous = process.env.NO_COLOR

  if (value === undefined) {
    delete process.env.NO_COLOR
  } else {
    process.env.NO_COLOR = value
  }

  try {
    return await callback()
  } finally {
    if (hadNoColor) {
      process.env.NO_COLOR = previous
    } else {
      delete process.env.NO_COLOR
    }
  }
}

async function withTTY<result>(value: boolean, callback: () => Promise<result>): Promise<result> {
  let descriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    value,
  })

  try {
    return await callback()
  } finally {
    if (descriptor) {
      Object.defineProperty(process.stdout, 'isTTY', descriptor)
    } else {
      Reflect.deleteProperty(process.stdout, 'isTTY')
    }
  }
}
