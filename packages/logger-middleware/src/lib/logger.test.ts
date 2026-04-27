import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createRouter } from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'
import { createStyles } from '@remix-run/terminal'

import { logger } from './logger.ts'

const styles = createStyles({ colors: true, env: {} })

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

      assert.equal(method, styles.green('GET'))
      assert.equal(status, styles.green('200'))
      assert.match(duration, /^\x1b\[(32|33|35|31)m\d+\x1b\[39m$/)
      assert.equal(contentLength, styles.cyan('2048'))
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

      assert.equal(
        message,
        `${styles.red('DELETE')} ${styles.yellow('404')} ${styles.yellow('204800')}`,
      )
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

  it('respects NO_COLOR by default when the process global is defined', async () => {
    await withNoColor('1', async () => {
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

  it('forces colors on with the colors option', async () => {
    await withNoColor('1', async () => {
      let { message } = await logRequest({
        loggerOptions: {
          colors: true,
          format: '%method %status',
        },
      })

      assert.equal(message, `${styles.green('GET')} ${styles.green('200')}`)
    })
  })

  it('enables colors by default in TTY environments', async () => {
    await withDefaultColorEnvironment(async () => {
      await withTTY(true, async () => {
        let { message } = await logRequest({
          loggerOptions: {
            format: '%method %status',
          },
        })

        assert.equal(message, `${styles.green('GET')} ${styles.green('200')}`)
      })
    })
  })

  it('leaves colors off by default outside TTY environments', async () => {
    await withDefaultColorEnvironment(async () => {
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

async function withDefaultColorEnvironment<result>(
  callback: () => Promise<result>,
): Promise<result> {
  return withEnv('NO_COLOR', undefined, () =>
    withEnv('FORCE_COLOR', undefined, () =>
      withEnv('CI', undefined, () => withEnv('TERM', undefined, callback)),
    ),
  )
}

async function withNoColor<result>(
  value: string | undefined,
  callback: () => Promise<result>,
): Promise<result> {
  return withEnv('NO_COLOR', value, callback)
}

async function withEnv<result>(
  name: string,
  value: string | undefined,
  callback: () => Promise<result>,
): Promise<result> {
  let hadValue = Object.hasOwn(process.env, name)
  let previous = process.env[name]

  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }

  try {
    return await callback()
  } finally {
    if (hadValue) {
      process.env[name] = previous
    } else {
      delete process.env[name]
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
