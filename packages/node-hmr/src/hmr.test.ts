import * as fs from 'node:fs/promises'
import * as net from 'node:net'
import * as path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const nodeTsxImportUrl = import.meta.resolve('@remix-run/node-tsx')
const isWindows = process.platform === 'win32'

describe('node-hmr', () => {
  it('hot updates self-accepting modules without restarting the server', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./message.ts', 'getMessage()'),
      'message.ts': [
        `export let message = 'one'`,
        `export function getMessage() {`,
        `  return message`,
        `}`,
        `if (import.meta.hot) {`,
        `  import.meta.hot.accept((module) => {`,
        `    if (module && typeof module === 'object' && 'message' in module) {`,
        `      message = String(module.message)`,
        `    }`,
        `  })`,
        `}`,
      ].join('\n'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      await fs.writeFile(
        path.join(fixture.path, 'message.ts'),
        [
          `export let message = 'two'`,
          `export function getMessage() {`,
          `  return message`,
          `}`,
          `if (import.meta.hot) {`,
          `  import.meta.hot.accept((module) => {`,
          `    if (module && typeof module === 'object' && 'message' in module) {`,
          `      message = String(module.message)`,
          `    }`,
          `  })`,
          `}`,
        ].join('\n'),
      )

      await waitForResponse(ready.port, 'two')
      assert.equal(server.readyCount, 1)
      await waitForOutput(server, /hmr update message\.ts/)
    } finally {
      await server.stop()
    }
  })

  it('preserves source-map locations after injecting hot context', async () => {
    await using fixture = await createFixture(
      {
        'server.ts': [
          `import { createServer } from 'node:http'`,
          `import { getMessage } from './message.ts'`,
          ``,
          `let server = createServer((_request, response) => {`,
          `  try {`,
          `    response.end(getMessage())`,
          `  } catch (error) {`,
          `    response.statusCode = 500`,
          `    response.end(error instanceof Error && error.stack ? error.stack : String(error))`,
          `  }`,
          `})`,
          ``,
          `server.listen(0, '127.0.0.1', () => {`,
          `  let address = server.address()`,
          `  if (address && typeof address === 'object') {`,
          `    console.log(JSON.stringify({ type: 'ready', port: address.port, pid: process.pid }))`,
          `  }`,
          `})`,
        ].join('\n'),
        'message.ts': [
          `export function getMessage() {`,
          `  throw new Error('mapped failure')`,
          `}`,
          ``,
          `if (import.meta.hot) {`,
          `  import.meta.hot.accept()`,
          `}`,
        ].join('\n'),
      },
      {
        nodeArgs: ['--enable-source-maps', '--import', nodeTsxImportUrl],
      },
    )
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      let stack = await fetchText(ready.port)

      assert.match(stack, /Error: mapped failure/)
      assert.match(stack, /message\.ts:2:\d+/)
    } finally {
      await server.stop()
    }
  })

  it('restarts when a statically self-accepting module does not register an accept handler', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./message.ts', 'getMessage()'),
      'message.ts': [
        `export function getMessage() {`,
        `  return 'one'`,
        `}`,
        ``,
        `if (globalThis.__enableMessageHmr) {`,
        `  import.meta.hot.accept()`,
        `}`,
      ].join('\n'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      await fs.writeFile(
        path.join(fixture.path, 'message.ts'),
        [
          `export function getMessage() {`,
          `  return 'two'`,
          `}`,
          ``,
          `if (globalThis.__enableMessageHmr) {`,
          `  import.meta.hot.accept()`,
          `}`,
        ].join('\n'),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      assert.equal(await fetchText(restarted.port), 'two')
      assert.match(server.output, /No HMR accept handler found for .*message\.ts/)
      assert.match(server.output, /restart No HMR accept handler found for .*message\.ts/)
    } finally {
      await server.stop()
    }
  })

  it('coalesces rapid restart-causing file changes', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./message.ts', 'getMessage()'),
      'message.ts': [`export function getMessage() {`, `  return 'one'`, `}`].join('\n'),
      'unused.ts': `export const unused = 'one'`,
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      await fs.writeFile(
        path.join(fixture.path, 'message.ts'),
        [`export function getMessage() {`, `  return 'two'`, `}`].join('\n'),
      )
      await fs.writeFile(path.join(fixture.path, 'unused.ts'), `export const unused = 'two'`)

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      await waitForResponse(restarted.port, 'two', () => server.output)
      await assertNoReadyEvent(server, 2)
    } finally {
      await server.stop()
    }
  })

  it('proxies requests through the ready child server generation', async () => {
    await using fixture = await createHmrProxyFixture({
      'server.ts': getHmrProxyChildServerSource('one'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      await fs.writeFile(fixture.entryPath, getHmrProxyChildServerSource('two'))
      await waitForOutput(server, /restart server\.ts/)

      let response = await fetch(`http://127.0.0.1:${ready.port}`)
      assert.equal(await response.text(), 'two')
      await waitForOutput(server, /"type":"child-ready","message":"two"/)
    } finally {
      await server.stop()
    }
  })

  it('waits for entry hot updates before proxying requests', async () => {
    await using fixture = await createHmrProxyFixture({
      'server.ts': getHmrProxyHotChildServerSource('one', { listenDelayMs: 0 }),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      await fs.writeFile(
        fixture.entryPath,
        getHmrProxyHotChildServerSource('two', { listenDelayMs: 250 }),
      )
      await waitForOutput(server, /"type":"entry-scheduled","message":"two"/)

      let response = await fetch(`http://127.0.0.1:${ready.port}`)
      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'two')
      await waitForOutput(server, /"type":"child-ready","message":"two"/)
    } finally {
      await server.stop()
    }
  })

  it('retries safe proxy responses during a restart', async () => {
    await using fixture = await createHmrProxyFixture({
      'server.ts': getHmrProxyChildServerSource('one'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      let responsePromise = fetch(`http://127.0.0.1:${ready.port}/retry-during-restart`)
      await waitForOutput(server, /retry-during-restart/)
      await fs.writeFile(fixture.entryPath, getHmrProxyChildServerSource('two'))

      let response = await responsePromise
      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'two')
      await waitForOutput(server, /"type":"child-ready","message":"two"/)
    } finally {
      await server.stop()
    }
  })

  it('hot updates dependency changes through accepting importers without restarting the server', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./message.ts', 'getMessage()'),
      'message.ts': [
        `import { message as importedMessage } from './value.ts'`,
        ``,
        `let message = importedMessage`,
        ``,
        `export function getMessage() {`,
        `  return message`,
        `}`,
        ``,
        `if (import.meta.hot) {`,
        `  import.meta.hot.accept('./value.ts', (module) => {`,
        `    if (module && typeof module === 'object' && 'message' in module) {`,
        `      message = String(module.message)`,
        `    }`,
        `  })`,
        `}`,
      ].join('\n'),
      'value.ts': `export const message = 'one'`,
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      await fs.writeFile(path.join(fixture.path, 'value.ts'), `export const message = 'two'`)

      await waitForResponse(ready.port, 'two')
      assert.equal(server.readyCount, 1)
      assert.match(server.output, /hmr update value\.ts/)
    } finally {
      await server.stop()
    }
  })

  it('disposes accepted dependencies that are not HMR boundaries without restarting the server', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./message.ts', 'getMessage()'),
      'message.ts': [
        `import { message as importedMessage } from './value.ts'`,
        ``,
        `let message = importedMessage`,
        ``,
        `export function getMessage() {`,
        `  return [message, ...(globalThis.__hmrEvents ?? [])].join('|')`,
        `}`,
        ``,
        `if (import.meta.hot) {`,
        `  import.meta.hot.accept('./value.ts', (module) => {`,
        `    if (module && typeof module === 'object' && 'message' in module) {`,
        `      message = String(module.message)`,
        `      globalThis.__hmrEvents.push(\`parent accept: \${message}\`)`,
        `    }`,
        `  })`,
        `}`,
      ].join('\n'),
      'value.ts': getDisposeOnlyValueSource('one'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one|message eval: one')

      await fs.writeFile(path.join(fixture.path, 'value.ts'), getDisposeOnlyValueSource('two'))

      await waitForResponse(
        ready.port,
        [
          'two',
          'message eval: one',
          'message dispose: one',
          'message eval after dispose: one',
          'message eval: two',
          'parent accept: two',
        ].join('|'),
        () => server.output,
      )
      assert.equal(server.readyCount, 1)
      assert.match(server.output, /hmr update value\.ts/)
    } finally {
      await server.stop()
    }
  })

  it('bubbles runtime invalidation to accepting importers without restarting the server', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./parent.ts', 'getMessage()'),
      'parent.ts': [
        `import { getMessage as getImportedMessage } from './message.ts'`,
        ``,
        `let getMessage = getImportedMessage`,
        ``,
        `if (import.meta.hot) {`,
        `  import.meta.hot.accept('./message.ts', (module) => {`,
        `    if (module && typeof module === 'object' && 'getMessage' in module) {`,
        `      getMessage = module.getMessage as typeof getMessage`,
        `    }`,
        `  })`,
        `}`,
        ``,
        `export { getMessage }`,
      ].join('\n'),
      'message.ts': [
        `export function getMessage() {`,
        `  return 'one'`,
        `}`,
        ``,
        `if (import.meta.hot) {`,
        `  import.meta.hot.accept((module) => {`,
        `    if (module && typeof module === 'object' && 'getMessage' in module) {`,
        `      import.meta.hot.invalidate('message boundary declined update')`,
        `    }`,
        `  })`,
        `}`,
      ].join('\n'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      await fs.writeFile(
        path.join(fixture.path, 'message.ts'),
        [
          `export function getMessage() {`,
          `  return 'two'`,
          `}`,
          ``,
          `if (import.meta.hot) {`,
          `  import.meta.hot.accept((module) => {`,
          `    if (module && typeof module === 'object' && 'getMessage' in module) {`,
          `      import.meta.hot.invalidate('message boundary declined update')`,
          `    }`,
          `  })`,
          `}`,
        ].join('\n'),
      )

      await waitForResponse(ready.port, 'two', () => server.output)
      assert.equal(server.readyCount, 1)
      assert.match(server.output, /message boundary declined update/)
      assert.match(server.output, /hmr update message\.ts/)
      assert.doesNotMatch(server.output, /restart message boundary declined update/)
    } finally {
      await server.stop()
    }
  })

  it('restarts when runtime invalidation cannot bubble to an accepting importer', async () => {
    await using fixture = await createFixture({
      'server.ts': getPidServerSource('./message.ts', 'getMessage()'),
      'message.ts': [
        `export function getMessage() {`,
        `  return 'one'`,
        `}`,
        ``,
        `if (import.meta.hot) {`,
        `  import.meta.hot.accept(() => {`,
        `    import.meta.hot.invalidate('message boundary declined update')`,
        `  })`,
        `}`,
      ].join('\n'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), `${ready.pid}:one`)

      await fs.writeFile(
        path.join(fixture.path, 'message.ts'),
        [
          `export function getMessage() {`,
          `  return 'two'`,
          `}`,
          ``,
          `if (import.meta.hot) {`,
          `  import.meta.hot.accept(() => {`,
          `    import.meta.hot.invalidate('message boundary declined update')`,
          `  })`,
          `}`,
        ].join('\n'),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      assert.equal(await fetchText(restarted.port), `${restarted.pid}:two`)
      assert.match(server.output, /message boundary declined update/)
      assert.match(server.output, /restart message boundary declined update/)
    } finally {
      await server.stop()
    }
  })

  it('hot updates bare dependency changes through accepting importers without restarting the server', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./message.ts', 'getMessage()'),
      'message.ts': [
        `import { message as importedMessage } from 'fixture-message'`,
        ``,
        `let message = importedMessage`,
        ``,
        `export function getMessage() {`,
        `  return message`,
        `}`,
        ``,
        `if (import.meta.hot) {`,
        `  import.meta.hot.accept('fixture-message', (module) => {`,
        `    if (module && typeof module === 'object' && 'message' in module) {`,
        `      message = String(module.message)`,
        `    }`,
        `  })`,
        `}`,
      ].join('\n'),
      'packages/fixture-message/index.ts': `export const message = 'one'`,
      'packages/fixture-message/require.ts': `export const message = 'require'`,
      'packages/fixture-message/package.json': JSON.stringify({
        exports: {
          import: './index.ts',
          require: './require.ts',
        },
        name: 'fixture-message',
        type: 'module',
      }),
    })
    await fs.mkdir(path.join(fixture.path, 'node_modules'), { recursive: true })
    await fs.symlink(
      path.join(fixture.path, 'packages/fixture-message'),
      path.join(fixture.path, 'node_modules/fixture-message'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      await fs.writeFile(
        path.join(fixture.path, 'packages/fixture-message/index.ts'),
        `export const message = 'two'`,
      )

      await waitForResponse(ready.port, 'two')
      assert.equal(server.readyCount, 1)
      assert.match(server.output, /hmr update packages\/fixture-message\/index\.ts/)
    } finally {
      await server.stop()
    }
  })

  it('ignores files that leave the imported module graph after a module update', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./message.ts', 'getMessage()'),
      'message.ts': [
        `import { message as importedMessage } from './value.ts'`,
        ``,
        `let message = importedMessage`,
        ``,
        `export function getMessage() {`,
        `  return message`,
        `}`,
        ``,
        `if (import.meta.hot) {`,
        `  import.meta.hot.accept((module) => {`,
        `    if (module && typeof module === 'object' && 'getMessage' in module) {`,
        `      message = String(module.getMessage())`,
        `    }`,
        `  })`,
        `}`,
      ].join('\n'),
      'other.ts': `export const message = 'two'`,
      'value.ts': `export const message = 'one'`,
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      await fs.writeFile(
        path.join(fixture.path, 'message.ts'),
        [
          `import { message as importedMessage } from './other.ts'`,
          ``,
          `let message = importedMessage`,
          ``,
          `export function getMessage() {`,
          `  return message`,
          `}`,
          ``,
          `if (import.meta.hot) {`,
          `  import.meta.hot.accept((module) => {`,
          `    if (module && typeof module === 'object' && 'getMessage' in module) {`,
          `      message = String(module.getMessage())`,
          `    }`,
          `  })`,
          `}`,
        ].join('\n'),
      )

      await waitForResponse(ready.port, 'two', () => server.output)
      assert.equal(server.readyCount, 1)
      assert.match(server.output, /hmr update message\.ts/)

      await fs.writeFile(path.join(fixture.path, 'value.ts'), `export const message = 'stale'`)

      await new Promise((resolve) => setTimeout(resolve, 250))
      assert.equal(server.readyCount, 1)
      assert.doesNotMatch(server.output, /restart value\.ts/)
      assert.equal(await fetchText(ready.port), 'two')
    } finally {
      await server.stop()
    }
  })

  it('ignores file changes outside the imported module graph', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./message.ts', 'getMessage()'),
      'message.ts': [`export function getMessage() {`, `  return 'one'`, `}`].join('\n'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      let sessionPath = path.join(fixture.path, 'tmp/sessions/session-id')
      await fs.mkdir(path.dirname(sessionPath), { recursive: true })
      await fs.writeFile(sessionPath, 'session data')

      await new Promise((resolve) => setTimeout(resolve, 250))
      assert.equal(server.readyCount, 1)
      assert.doesNotMatch(server.output, /restart tmp/)
      assert.equal(await fetchText(ready.port), 'one')
    } finally {
      await server.stop()
    }
  })

  it('restarts when a dependency has both accepting and non-accepting importer paths', async () => {
    await using fixture = await createFixture({
      'server.ts': [
        `import './side-effect.ts'`,
        getServerSource('./message.ts', 'getMessage()'),
      ].join('\n'),
      'message.ts': [
        `import { message as importedMessage } from './value.ts'`,
        ``,
        `let message = importedMessage`,
        ``,
        `export function getMessage() {`,
        `  return message`,
        `}`,
        ``,
        `if (import.meta.hot) {`,
        `  import.meta.hot.accept('./value.ts', (module) => {`,
        `    if (module && typeof module === 'object' && 'message' in module) {`,
        `      message = String(module.message)`,
        `    }`,
        `  })`,
        `}`,
      ].join('\n'),
      'side-effect.ts': [`import { message } from './value.ts'`, `void message`].join('\n'),
      'value.ts': `export const message = 'one'`,
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      await fs.writeFile(path.join(fixture.path, 'value.ts'), `export const message = 'two'`)

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      await waitForResponse(restarted.port, 'two', () => server.output)
      assert.match(server.output, /restart value\.ts/)
    } finally {
      await server.stop()
    }
  })

  it('hot updates when a transitive importer accepts updates without restarting the server', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./message.ts', 'getMessage()'),
      'message.ts': [
        `import { message as importedMessage } from './intermediate.ts'`,
        ``,
        `let message = importedMessage`,
        ``,
        `export function getMessage() {`,
        `  return message`,
        `}`,
        ``,
        `if (import.meta.hot) {`,
        `  import.meta.hot.accept('./intermediate.ts', (module) => {`,
        `    if (module && typeof module === 'object' && 'message' in module) {`,
        `      message = String(module.message)`,
        `    }`,
        `  })`,
        `}`,
      ].join('\n'),
      'intermediate.ts': [`import { message } from './value.ts'`, `export { message }`].join('\n'),
      'value.ts': `export const message = 'one'`,
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      await fs.writeFile(path.join(fixture.path, 'value.ts'), `export const message = 'two'`)

      await waitForResponse(ready.port, 'two')
      assert.equal(server.readyCount, 1)
      assert.match(server.output, /hmr update value\.ts/)
    } finally {
      await server.stop()
    }
  })

  it('restarts when changed modules are not self-accepting', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./message.ts', 'getMessage()'),
      'message.ts': [`export function getMessage() {`, `  return 'one'`, `}`].join('\n'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      await fs.writeFile(
        path.join(fixture.path, 'message.ts'),
        [`export function getMessage() {`, `  return 'two'`, `}`].join('\n'),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      await waitForResponse(restarted.port, 'two', () => server.output)
      assert.match(server.output, /restart message\.ts/)
    } finally {
      await server.stop()
    }
  })

  it('hot updates self-accepted modules with mutable exports without restarting the server', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': getGenericGreetingSource({ message: 'Hello from generic boundary' }),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'Hello from generic boundary')

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        getGenericGreetingSource({ message: 'Updated from generic boundary' }),
      )

      await waitForResponse(ready.port, 'Updated from generic boundary', () => server.output)
      assert.equal(server.readyCount, 1)
      assert.match(server.output, /hmr update greeting\.tsx/)
    } finally {
      await server.stop()
    }
  })

  it('restarts once when an accepted module export is added', async () => {
    await using fixture = await createFixture({
      'server.ts': getPidServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': getGenericGreetingSource({ message: 'Hello from generic boundary' }),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from generic boundary`)

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        getGenericGreetingSource({
          extraExports: [`export function addedExport() {`, `  return 'added'`, `}`],
          message: 'Updated after restart',
          runtimeExportNames: ['Greeting', 'addedExport'],
        }),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      assert.equal(await fetchText(restarted.port), `${restarted.pid}:Updated after restart`)
      assert.match(server.output, /restart Updated module added export "addedExport"/)
      assert.doesNotMatch(server.output, /Failed to hot update/)
      assert.equal(server.readyCount, 2)
    } finally {
      await server.stop()
    }
  })

  it('restarts once when an accepted module adds a runtime export', async () => {
    await using fixture = await createFixture({
      'server.ts': getPidServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': getGenericGreetingSource({ message: 'Hello from generic boundary' }),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from generic boundary`)

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        getGenericGreetingSource({
          extraExports: [`export const foo = true`],
          message: 'Updated after restart',
          runtimeExportNames: ['Greeting', 'foo'],
        }),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      assert.equal(await fetchText(restarted.port), `${restarted.pid}:Updated after restart`)
      assert.match(server.output, /restart Updated module added export "foo"/)
      assert.doesNotMatch(server.output, /Failed to hot update/)
      assert.equal(server.readyCount, 2)
    } finally {
      await server.stop()
    }
  })

  it('restarts once when an accepted module removes a runtime export', async () => {
    await using fixture = await createFixture({
      'server.ts': getPidServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': getGenericGreetingSource({
        extraExports: [`export const foo = true`],
        message: 'Hello from generic boundary',
        runtimeExportNames: ['Greeting', 'foo'],
      }),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from generic boundary`)

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        getGenericGreetingSource({ message: 'Updated after restart' }),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      assert.equal(await fetchText(restarted.port), `${restarted.pid}:Updated after restart`)
      assert.match(server.output, /restart Updated module removed export "foo"/)
      assert.doesNotMatch(server.output, /Failed to hot update/)
      assert.equal(server.readyCount, 2)
    } finally {
      await server.stop()
    }
  })

  it('restarts once when an accepted module changes a runtime export', async () => {
    await using fixture = await createFixture({
      'server.ts': getPidServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': getGenericGreetingSource({
        extraExports: [`export const foo = true`],
        message: 'Hello from generic boundary',
        runtimeExportNames: ['Greeting', 'foo'],
      }),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from generic boundary`)

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        getGenericGreetingSource({
          extraExports: [`export const foo = false`],
          message: 'Updated after restart',
          runtimeExportNames: ['Greeting', 'foo'],
        }),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      assert.equal(await fetchText(restarted.port), `${restarted.pid}:Updated after restart`)
      assert.match(server.output, /restart Updated module changed export "foo"/)
      assert.doesNotMatch(server.output, /Failed to hot update/)
      assert.equal(server.readyCount, 2)
    } finally {
      await server.stop()
    }
  })

  it('hot updates accepted modules when runtime exports are strictly equal', async () => {
    await using fixture = await createFixture({
      'server.ts': getPidServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': getGenericGreetingSource({
        extraExports: [`import { foo } from './stable.ts'`, `export { foo }`],
        message: 'Hello from generic boundary',
        runtimeExportNames: ['Greeting', 'foo'],
      }),
      'stable.ts': `export const foo = {}`,
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from generic boundary`)

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        getGenericGreetingSource({
          extraExports: [`import { foo } from './stable.ts'`, `export { foo }`],
          message: 'Updated from generic boundary',
          runtimeExportNames: ['Greeting', 'foo'],
        }),
      )

      await waitForResponse(
        ready.port,
        `${ready.pid}:Updated from generic boundary`,
        () => server.output,
      )
      assert.equal(server.readyCount, 1)
      assert.match(server.output, /hmr update greeting\.tsx/)
      assert.doesNotMatch(server.output, /restart/)
    } finally {
      await server.stop()
    }
  })

  it('restarts once when an accepted module recreates an object runtime export', async () => {
    await using fixture = await createFixture({
      'server.ts': getPidServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': getGenericGreetingSource({
        extraExports: [`export const foo = {}`],
        message: 'Hello from generic boundary',
        runtimeExportNames: ['Greeting', 'foo'],
      }),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from generic boundary`)

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        getGenericGreetingSource({
          extraExports: [`export const foo = {}`],
          message: 'Updated after restart',
          runtimeExportNames: ['Greeting', 'foo'],
        }),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      assert.equal(await fetchText(restarted.port), `${restarted.pid}:Updated after restart`)
      assert.match(server.output, /restart Updated module changed export "foo"/)
      assert.doesNotMatch(server.output, /Failed to hot update/)
      assert.equal(server.readyCount, 2)
    } finally {
      await server.stop()
    }
  })

  it('sends one readiness-gated server update when accepted module exports change', async () => {
    await using fixture = await createFixture({
      'server.ts': getEventChannelGreetingServerSource(),
      'greeting.tsx': getGenericGreetingSource({ message: 'Hello from generic boundary' }),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let hmrUrl = await server.waitForHmrUrl(0)
      let events = await connectHmrEvents(hmrUrl.url)
      try {
        let ready = await server.waitForReady(0)
        assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from generic boundary`)

        await fs.writeFile(
          path.join(fixture.path, 'greeting.tsx'),
          getGenericGreetingSource({
            extraExports: [`export function addedExport() {`, `  return 'added'`, `}`],
            message: 'Updated after restart',
            runtimeExportNames: ['Greeting', 'addedExport'],
          }),
        )

        let restarted = await server.waitForReady(1)
        assert.notEqual(restarted.pid, ready.pid)
        assert.equal(await fetchText(restarted.port), `${restarted.pid}:Updated after restart`)

        let payload = await events.read()
        assert.deepEqual(payload, { type: 'server:update' })
        await assertNoHmrEvent(events)
      } finally {
        await events.close()
      }
    } finally {
      await server.stop()
    }
  })

  it('waits for file changes after the server throws during startup', async () => {
    await using fixture = await createFixture({
      'server.ts': [`console.log('booting broken server')`, `throw new Error('boom')`].join('\n'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      await waitForOutput(server, /Failed running server\.ts\. Waiting for file changes/)

      await fs.writeFile(fixture.entryPath, getServerSource('./message.ts', 'getMessage()'))
      await fs.writeFile(
        path.join(fixture.path, 'message.ts'),
        [`export function getMessage() {`, `  return 'fixed'`, `}`].join('\n'),
      )

      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'fixed')
      assert.match(server.output, /restart server\.ts, message\.ts|restart message\.ts, server\.ts/)
    } finally {
      await server.stop()
    }
  })

  it('waits for file changes after a syntax error during restart', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./message.ts', 'getMessage()'),
      'message.ts': [`export function getMessage() {`, `  return 'one'`, `}`].join('\n'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      await fs.writeFile(path.join(fixture.path, 'message.ts'), `export function getMessage( {\n`)

      await waitForOutput(server, /Failed running server\.ts\. Waiting for file changes/)

      await fs.writeFile(
        path.join(fixture.path, 'message.ts'),
        [`export function getMessage() {`, `  return 'two'`, `}`].join('\n'),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      assert.equal(await fetchText(restarted.port), 'two')
    } finally {
      await server.stop()
    }
  })

  it('keeps the HMR event endpoint alive while the child process crashes and recovers', async () => {
    await using fixture = await createFixture({
      'server.ts': getEventChannelServerSource('one'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let hmrUrl = await server.waitForHmrUrl(0)
      let events = await connectHmrEvents(hmrUrl.url)
      try {
        let ready = await server.waitForReady(0)
        assert.equal(await fetchText(ready.port), 'one')

        await fs.writeFile(fixture.entryPath, `export function broken( {\n`)
        await waitForOutput(server, /Failed running server\.ts\. Waiting for file changes/)

        await fs.writeFile(fixture.entryPath, getEventChannelServerSource('two'))

        let restarted = await server.waitForReady(1)
        assert.notEqual(restarted.pid, ready.pid)
        assert.equal(await fetchText(restarted.port), 'two')
        let payload = await events.read()
        assert.deepEqual(payload, { type: 'server:update' })
      } finally {
        await events.close()
      }
    } finally {
      await server.stop()
    }
  })

  it('signals server restart recovery after fresh content can be fetched', async () => {
    await using fixture = await createFixture({
      'server.ts': getEventChannelServerSource('one'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let hmrUrl = await server.waitForHmrUrl(0)
      let events = await connectHmrEvents(hmrUrl.url)
      try {
        let ready = await server.waitForReady(0)
        assert.equal(await fetchText(ready.port), 'one')

        await fs.writeFile(fixture.entryPath, `export function broken( {\n`)
        await waitForOutput(server, /Failed running server\.ts\. Waiting for file changes/)

        await fs.writeFile(fixture.entryPath, getEventChannelServerSource('two!!!'))

        let restarted = await server.waitForReady(1)
        assert.notEqual(restarted.pid, ready.pid)
        assert.equal(await fetchText(restarted.port), 'two!!!')

        let payload = await events.read()
        assert.deepEqual(payload, { type: 'server:update' })
      } finally {
        await events.close()
      }
    } finally {
      await server.stop()
    }
  })

  it(
    'waits for child process exit before restarting',
    { skip: isWindows && 'Windows terminates child processes without delivering SIGTERM handlers' },
    async () => {
      await using fixture = await createFixture({
        'server.ts': getSlowShutdownServerSource('one'),
      })
      let server = startFixtureServer(fixture.path)

      try {
        let ready = await server.waitForReady(0)
        assert.equal(await fetchText(ready.port), 'one')

        await fs.writeFile(fixture.entryPath, getSlowShutdownServerSource('two'))

        await waitForOutput(server, /"type":"child-sigterm","count":1/)
        await assertNoReadyEvent(server, 1, 5_250)
      } finally {
        await server.stop()
      }
    },
  )

  it(
    'waits for a force-killed child process before completing shutdown',
    { skip: isWindows && 'Windows terminates child processes without delivering SIGTERM handlers' },
    async () => {
      let fixture = await createFixture({
        'server.ts': [
          `import { createServer } from 'node:http'`,
          ``,
          `let server = createServer((_request, response) => {`,
          `  response.end('ok')`,
          `})`,
          ``,
          `process.on('SIGTERM', () => {`,
          `  console.log(JSON.stringify({ type: 'child-sigterm', pid: process.pid }))`,
          `})`,
          ``,
          `server.listen(0, '127.0.0.1', () => {`,
          `  let address = server.address()`,
          `  if (address && typeof address === 'object') {`,
          `    console.log(JSON.stringify({ type: 'ready', port: address.port, pid: process.pid }))`,
          `  }`,
          `})`,
          ``,
          `setInterval(() => {}, 1_000)`,
        ].join('\n'),
      })
      let server = startFixtureServer(fixture.path)

      try {
        let ready = await server.waitForReady(0)
        assert.equal(await fetchText(ready.port), 'ok')

        let stopped = server.stop()
        await waitForOutput(server, /"type":"child-sigterm"/)
        await stopped

        await fs.rm(fixture.path, { force: true, recursive: true })
      } finally {
        await removeFixture(fixture.path)
      }
    },
  )

  it('removes fixture files after shutdown', async () => {
    let fixture = await createFixture({
      'server.ts': [
        `import { createServer } from 'node:http'`,
        ``,
        `let server = createServer((_request, response) => {`,
        `  response.end('ok')`,
        `})`,
        ``,
        `server.listen(0, '127.0.0.1', () => {`,
        `  let address = server.address()`,
        `  if (address && typeof address === 'object') {`,
        `    console.log(JSON.stringify({ type: 'ready', port: address.port, pid: process.pid }))`,
        `  }`,
        `})`,
        ``,
        `setInterval(() => {}, 1_000)`,
      ].join('\n'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'ok')

      await server.stop()
      await fs.rm(fixture.path, { force: true, recursive: true })
    } finally {
      await removeFixture(fixture.path)
    }
  })
})

function getServerSource(importSpecifier: string, responseExpression: string): string {
  return getFixtureServerSource(importSpecifier, `String(${responseExpression})`)
}

function getPidServerSource(importSpecifier: string, responseExpression: string): string {
  return getFixtureServerSource(
    importSpecifier,
    `String(process.pid) + ':' + String(${responseExpression})`,
  )
}

function getSlowShutdownServerSource(message: string): string {
  return [
    `import { createServer } from 'node:http'`,
    ``,
    `let sigtermCount = 0`,
    `let server = createServer((_request, response) => {`,
    `  response.end(${JSON.stringify(message)})`,
    `})`,
    ``,
    `process.on('SIGTERM', () => {`,
    `  sigtermCount += 1`,
    `  console.log(JSON.stringify({ type: 'child-sigterm', count: sigtermCount, pid: process.pid }))`,
    `  if (sigtermCount > 1) process.exit(0)`,
    `})`,
    ``,
    `server.listen(0, '127.0.0.1', () => {`,
    `  let address = server.address()`,
    `  if (address && typeof address === 'object') {`,
    `    console.log(JSON.stringify({ type: 'ready', port: address.port, pid: process.pid }))`,
    `  }`,
    `})`,
    ``,
    `setInterval(() => {}, 1_000)`,
  ].join('\n')
}

function getDisposeOnlyValueSource(message: string): string {
  return [
    `globalThis.__hmrEvents ??= []`,
    `if (import.meta.hot?.data.disposedMessage) {`,
    `  globalThis.__hmrEvents.push(\`message eval after dispose: \${import.meta.hot.data.disposedMessage}\`)`,
    `}`,
    `globalThis.__hmrEvents.push(${JSON.stringify(`message eval: ${message}`)})`,
    ``,
    `export const message = ${JSON.stringify(message)}`,
    ``,
    `if (import.meta.hot) {`,
    `  import.meta.hot.dispose((data) => {`,
    `    globalThis.__hmrEvents.push(\`message dispose: \${message}\`)`,
    `    data.disposedMessage = message`,
    `  })`,
    `}`,
  ].join('\n')
}

function getFixtureServerSource(importSpecifier: string, responseExpression: string): string {
  let nodeHmrRuntimeUrl = pathToFileURL(path.join(packageRoot, 'src/runtime.node-hmr.ts')).href

  return [
    `import { createServer } from 'node:http'`,
    `import { emitServerReady } from ${JSON.stringify(nodeHmrRuntimeUrl)}`,
    `import { ${importSpecifier.includes('greeting') ? 'Greeting' : 'getMessage'} } from ${JSON.stringify(
      importSpecifier,
    )}`,
    ``,
    `let server = createServer((_request, response) => {`,
    `  response.end(${responseExpression})`,
    `})`,
    ``,
    `server.listen(0, () => {`,
    `  let address = server.address()`,
    `  if (address && typeof address === 'object') {`,
    `    emitServerReady()`,
    `    console.log(JSON.stringify({ type: 'ready', port: address.port, pid: process.pid }))`,
    `  }`,
    `})`,
  ].join('\n')
}

function getEventChannelServerSource(message: string): string {
  let nodeHmrRuntimeUrl = pathToFileURL(path.join(packageRoot, 'src/runtime.node-hmr.ts')).href

  return [
    `import { createServer } from 'node:http'`,
    `import { createBrowserHmrChannel, emitServerReady } from ${JSON.stringify(nodeHmrRuntimeUrl)}`,
    ``,
    `let browserHmrChannel = await createBrowserHmrChannel()`,
    `console.log(JSON.stringify({ type: 'hmr-url', url: browserHmrChannel.url, pid: process.pid }))`,
    ``,
    `let server = createServer((_request, response) => {`,
    `  response.end(${JSON.stringify(message)})`,
    `})`,
    ``,
    `server.listen(0, () => {`,
    `  let address = server.address()`,
    `  if (address && typeof address === 'object') {`,
    `    emitServerReady()`,
    `    console.log(JSON.stringify({ type: 'ready', port: address.port, pid: process.pid }))`,
    `  }`,
    `})`,
  ].join('\n')
}

function getEventChannelGreetingServerSource(): string {
  let nodeHmrRuntimeUrl = pathToFileURL(path.join(packageRoot, 'src/runtime.node-hmr.ts')).href

  return [
    `import { createServer } from 'node:http'`,
    `import { createBrowserHmrChannel, emitServerReady } from ${JSON.stringify(nodeHmrRuntimeUrl)}`,
    `import { Greeting } from './greeting.tsx'`,
    ``,
    `let browserHmrChannel = await createBrowserHmrChannel()`,
    `console.log(JSON.stringify({ type: 'hmr-url', url: browserHmrChannel.url, pid: process.pid }))`,
    ``,
    `let server = createServer((_request, response) => {`,
    `  response.end(String(process.pid) + ':' + Greeting()())`,
    `})`,
    ``,
    `server.listen(0, () => {`,
    `  let address = server.address()`,
    `  if (address && typeof address === 'object') {`,
    `    emitServerReady()`,
    `    console.log(JSON.stringify({ type: 'ready', port: address.port, pid: process.pid }))`,
    `  }`,
    `})`,
  ].join('\n')
}

function getGenericGreetingSource(options: {
  extraExports?: Array<string>
  message: string
  runtimeExportNames?: Array<string>
}): string {
  let { extraExports = [], message, runtimeExportNames = ['Greeting'] } = options
  let runtimeExports = `{ ${runtimeExportNames.join(', ')} }`

  return [
    `export let Greeting = () => () => ${JSON.stringify(message)}`,
    ...extraExports,
    ``,
    `if (import.meta.hot) {`,
    `  let runtimeExports = ${runtimeExports}`,
    ``,
    `  import.meta.hot.accept((module) => {`,
    `    if (!module || typeof module !== 'object') return`,
    ``,
    `    for (let name of Object.keys(module)) {`,
    `      if (!Object.prototype.hasOwnProperty.call(runtimeExports, name)) {`,
    `        import.meta.hot.invalidate('Updated module added export "' + name + '"')`,
    `        return`,
    `      }`,
    `    }`,
    ``,
    `    for (let name of Object.keys(runtimeExports)) {`,
    `      if (!Object.prototype.hasOwnProperty.call(module, name)) {`,
    `        import.meta.hot.invalidate('Updated module removed export "' + name + '"')`,
    `        return`,
    `      }`,
    `      if (name !== 'Greeting' && runtimeExports[name] !== module[name]) {`,
    `        import.meta.hot.invalidate('Updated module changed export "' + name + '"')`,
    `        return`,
    `      }`,
    `    }`,
    ``,
    `    Greeting = module.Greeting`,
    `  })`,
    `}`,
  ].join('\n')
}

function getHmrProxyChildServerSource(message: string): string {
  let nodeHmrRuntimeUrl = pathToFileURL(path.join(packageRoot, 'src/runtime.node-hmr.ts')).href
  let nodeFetchServerImportUrl = pathToFileURL(
    path.join(packageRoot, '../node-fetch-server/src/index.ts'),
  ).href

  return [
    `import * as http from 'node:http'`,
    `import { writeFile } from 'node:fs/promises'`,
    ``,
    `import { emitServerReady } from ${JSON.stringify(nodeHmrRuntimeUrl)}`,
    `import { createRequestListener } from ${JSON.stringify(nodeFetchServerImportUrl)}`,
    ``,
    `const server = http.createServer(`,
    `  createRequestListener(() => new Response(${JSON.stringify(message)})),`,
    `)`,
    ``,
    `const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 0`,
    ``,
    `server.listen(port, '127.0.0.1', async () => {`,
    `  let address = server.address()`,
    `  if (address && typeof address === 'object') {`,
    `    await writeFile(process.env.CHILD_PORT_FILE, String(address.port))`,
    `    emitServerReady()`,
    `    console.log(JSON.stringify({ type: 'child-ready', message: ${JSON.stringify(message)}, port: address.port, pid: process.pid }))`,
    `  }`,
    `})`,
  ].join('\n')
}

function getHmrProxyHotChildServerSource(
  message: string,
  options: { listenDelayMs: number },
): string {
  let nodeHmrRuntimeUrl = pathToFileURL(path.join(packageRoot, 'src/runtime.node-hmr.ts')).href
  let nodeFetchServerImportUrl = pathToFileURL(
    path.join(packageRoot, '../node-fetch-server/src/index.ts'),
  ).href

  return [
    `import * as http from 'node:http'`,
    `import { writeFile } from 'node:fs/promises'`,
    ``,
    `import { emitServerReady } from ${JSON.stringify(nodeHmrRuntimeUrl)}`,
    `import { createRequestListener } from ${JSON.stringify(nodeFetchServerImportUrl)}`,
    ``,
    `const server = http.createServer(`,
    `  createRequestListener(() => new Response(${JSON.stringify(message)})),`,
    `)`,
    ``,
    `const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 0`,
    ``,
    `setTimeout(() => {`,
    `  server.listen(port, '127.0.0.1', async () => {`,
    `    let address = server.address()`,
    `    if (address && typeof address === 'object') {`,
    `      await writeFile(process.env.CHILD_PORT_FILE, String(address.port))`,
    `      emitServerReady()`,
    `      console.log(JSON.stringify({ type: 'child-ready', message: ${JSON.stringify(message)}, port: address.port, pid: process.pid }))`,
    `    }`,
    `  })`,
    `}, ${JSON.stringify(options.listenDelayMs)})`,
    `console.log(JSON.stringify({ type: 'entry-scheduled', message: ${JSON.stringify(message)} }))`,
    ``,
    `if (import.meta.hot) {`,
    `  import.meta.hot.accept()`,
    `  import.meta.hot.dispose(async () => {`,
    `    server.closeAllConnections()`,
    `    await new Promise((resolve) => server.close(resolve))`,
    `    console.log(JSON.stringify({ type: 'child-disposed', message: ${JSON.stringify(message)} }))`,
    `  })`,
    `}`,
  ].join('\n')
}

async function createFixture(
  files: Record<string, string>,
  options: { nodeArgs?: string[] } = {},
): Promise<AsyncDisposable & { entryPath: string; path: string }> {
  let fixtureRoot = path.join(packageRoot, '.tmp')
  await fs.mkdir(fixtureRoot, { recursive: true })

  let fixturePath = await fs.mkdtemp(path.join(fixtureRoot, 'node-hmr-'))
  let nodeHmrImportUrl = pathToFileURL(path.join(packageRoot, 'src/index.ts')).href
  let nodeArgs = options.nodeArgs ?? ['--import', nodeTsxImportUrl]
  await writeFixtureFiles(fixturePath, {
    ...files,
    'dev.ts': [
      `import { run } from ${JSON.stringify(nodeHmrImportUrl)}`,
      ``,
      `run('server.ts', {`,
      `  nodeArgs: ${JSON.stringify(nodeArgs)},`,
      `})`,
    ].join('\n'),
  })

  return {
    entryPath: path.join(fixturePath, 'server.ts'),
    path: fixturePath,
    async [Symbol.asyncDispose]() {
      await removeFixture(fixturePath)
    },
  }
}

async function createHmrProxyFixture(
  files: Record<string, string>,
): Promise<AsyncDisposable & { entryPath: string; path: string }> {
  let fixtureRoot = path.join(packageRoot, '.tmp')
  await fs.mkdir(fixtureRoot, { recursive: true })

  let fixturePath = await fs.mkdtemp(path.join(fixtureRoot, 'node-hmr-'))
  let nodeHmrImportUrl = pathToFileURL(path.join(packageRoot, 'src/index.ts')).href
  let fetchProxyImportUrl = pathToFileURL(
    path.join(packageRoot, '../fetch-proxy/src/index.ts'),
  ).href
  let nodeFetchServerImportUrl = pathToFileURL(
    path.join(packageRoot, '../node-fetch-server/src/index.ts'),
  ).href
  let childPort = await getAvailablePort()
  await writeFixtureFiles(fixturePath, {
    ...files,
    'fetch-proxy.ts': getPatchedFetchProxySource(fetchProxyImportUrl),
    'dev.ts': [
      `import * as http from 'node:http'`,
      `import { fileURLToPath } from 'node:url'`,
      ``,
      `import { createHmrReadyFetch, run } from ${JSON.stringify(nodeHmrImportUrl)}`,
      `import { createRequestListener } from ${JSON.stringify(nodeFetchServerImportUrl)}`,
      ``,
      `import { createFetchProxy } from './fetch-proxy.ts'`,
      ``,
      `const originPort = 0`,
      `const childPort = ${JSON.stringify(childPort)}`,
      ``,
      `let returnedStaleGateway = false`,
      ``,
      `const hmrRunner = run('server.ts', {`,
      `  env: {`,
      `    ...process.env,`,
      `    CHILD_PORT_FILE: fileURLToPath(new URL('./child-port.txt', import.meta.url)),`,
      `    PORT: String(childPort),`,
      `  },`,
      `  nodeArgs: ['--import', ${JSON.stringify(nodeTsxImportUrl)}],`,
      `})`,
      ``,
      `const server = http.createServer(`,
      `  createRequestListener(`,
      `    createHmrReadyFetch(`,
      `      hmrRunner,`,
      `      createFetchProxy(\`http://127.0.0.1:\${childPort}\`, {`,
      `        xForwardedHeaders: true,`,
      `        async fetch(input, init) {`,
      `          let targetUrl = new URL(String(input))`,
      `          if (targetUrl.pathname === '/retry-during-restart' && !returnedStaleGateway) {`,
      `            returnedStaleGateway = true`,
      `            console.log('retry-during-restart')`,
      `            await new Promise((resolve) => setTimeout(resolve, 500))`,
      `            return new Response('stale gateway', { status: 503 })`,
      `          }`,
      `          return await fetch(input, init)`,
      `        },`,
      `      }),`,
      `    ),`,
      `  ),`,
      `)`,
      ``,
      `server.listen(originPort, '127.0.0.1', () => {`,
      `  let address = server.address()`,
      `  if (address && typeof address === 'object') {`,
      `    console.log(JSON.stringify({ type: 'ready', port: address.port, pid: process.pid }))`,
      `  }`,
      `})`,
      ``,
      `let shuttingDown = false`,
      ``,
      `function shutdown() {`,
      `  if (shuttingDown) return`,
      `  shuttingDown = true`,
      `  server.close(() => hmrRunner.close().finally(() => process.exit(0)))`,
      `  server.closeAllConnections()`,
      `}`,
      ``,
      `process.on('SIGINT', shutdown)`,
      `process.on('SIGTERM', shutdown)`,
    ].join('\n'),
  })

  return {
    entryPath: path.join(fixturePath, 'server.ts'),
    path: fixturePath,
    async [Symbol.asyncDispose]() {
      await removeFixture(fixturePath)
    },
  }
}

async function writeFixtureFiles(root: string, files: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([filePath, contents]) => {
      let absolutePath = path.join(root, filePath)
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, contents)
    }),
  )
}

function getPatchedFetchProxySource(fetchProxyImportUrl: string): string {
  return [
    `import { createFetchProxy as createRemixFetchProxy } from ${JSON.stringify(fetchProxyImportUrl)}`,
    ``,
    `export function createFetchProxy(target, options) {`,
    `  let proxyFetch = createRemixFetchProxy(target, options)`,
    ``,
    `  return async (input, init) => {`,
    `    let request = patchProxyRequest(input, init)`,
    `    let response = await proxyFetch(request)`,
    ``,
    `    return patchProxyResponse(request, response)`,
    `  }`,
    `}`,
    ``,
    `function patchProxyRequest(input, init) {`,
    `  let request = isRequestLike(input) ? input : new Request(input, init)`,
    `  let headers = new Headers(request.headers)`,
    ``,
    `  // Temporary workaround until fetch-proxy stops forwarding final-client`,
    `  // Accept-Encoding headers to proxy targets.`,
    `  headers.delete('Accept-Encoding')`,
    ``,
    `  // Temporary workaround until fetch-proxy accepts the lazy Request objects`,
    `  // provided by node-fetch-server.`,
    `  return new Request(request.url, {`,
    `    body: request.body,`,
    `    headers,`,
    `    method: request.method,`,
    `    redirect: request.redirect,`,
    `    signal: request.signal,`,
    `    ...getRequestDuplex(request),`,
    `  })`,
    `}`,
    ``,
    `function patchProxyResponse(request, response) {`,
    `  let headers = new Headers(response.headers)`,
    `  let hasContentEncoding = headers.has('Content-Encoding')`,
    `  let hasTransferEncoding = headers.has('Transfer-Encoding')`,
    `  let hasProxiedResponseBody = request.method !== 'HEAD' && response.body != null`,
    ``,
    `  // Temporary workaround until fetch-proxy strips hop-by-hop/body-specific`,
    `  // response headers that may no longer match the proxied response body.`,
    `  headers.delete('Transfer-Encoding')`,
    `  if (hasTransferEncoding || (hasProxiedResponseBody && hasContentEncoding)) {`,
    `    headers.delete('Content-Length')`,
    `  }`,
    ``,
    `  if (hasProxiedResponseBody && hasContentEncoding) {`,
    `    headers.delete('Content-Encoding')`,
    `  }`,
    ``,
    `  return new Response(response.body, {`,
    `    headers,`,
    `    status: response.status,`,
    `    statusText: response.statusText,`,
    `  })`,
    `}`,
    ``,
    `function getRequestDuplex(request) {`,
    `  if (request.method === 'GET' || request.method === 'HEAD') return undefined`,
    `  return { duplex: 'half' }`,
    `}`,
    ``,
    `function isRequestLike(input) {`,
    `  return typeof input === 'object' && 'url' in input`,
    `}`,
  ].join('\n')
}

async function getAvailablePort(): Promise<number> {
  let server = net.createServer()

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  let address = server.address()
  if (address == null || typeof address === 'string') {
    throw new Error('Expected test server to listen on a TCP port')
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })

  return address.port
}

async function waitForOutput(server: ReturnType<typeof startFixtureServer>, pattern: RegExp) {
  await waitFor(
    () => pattern.test(server.output),
    () => `Timed out waiting for output ${pattern}.\n${server.output}`,
  )
}

async function removeFixture(fixturePath: string): Promise<void> {
  await fs.rm(fixturePath, {
    force: true,
    maxRetries: process.platform === 'win32' ? 5 : 0,
    recursive: true,
    retryDelay: 100,
  })
}

function startFixtureServer(cwd: string) {
  // pnpm's binary shims set NODE_PATH to the workspace virtual store, which lets
  // CJS resolution find workspace packages that the fixture app cannot import via ESM.
  let { NODE_PATH: _nodePath, ...env } = process.env
  let child = spawn(process.execPath, ['dev.ts'], {
    cwd,
    env: {
      ...env,
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let readyEvents: Array<{ pid: number; port: number }> = []
  let hmrUrlEvents: Array<{ pid: number; url: string }> = []
  let readyWaiters: Array<() => void> = []
  let hmrUrlWaiters: Array<() => void> = []
  let lineBuffer = ''
  let processOutput = ''
  let exit: { code: number | null; signal: NodeJS.Signals | null } | null = null

  child.stdout?.setEncoding('utf-8')
  child.stdout?.on('data', (chunk: string) => {
    processOutput += chunk
    lineBuffer += chunk

    let lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''

    for (let line of lines) {
      let event = parseReadyEvent(line)
      if (event !== null) {
        readyEvents.push(event)
        for (let waiter of readyWaiters) {
          waiter()
        }
        readyWaiters = []
        continue
      }

      let hmrUrlEvent = parseHmrUrlEvent(line)
      if (hmrUrlEvent !== null) {
        hmrUrlEvents.push(hmrUrlEvent)
        for (let waiter of hmrUrlWaiters) {
          waiter()
        }
        hmrUrlWaiters = []
      }
    }
  })

  child.stderr?.setEncoding('utf-8')
  child.stderr?.on('data', (chunk: string) => {
    processOutput += chunk
  })

  child.once('exit', (code, signal) => {
    exit = { code, signal }
  })

  return {
    get readyCount() {
      return readyEvents.length
    },

    get output() {
      return processOutput
    },

    async waitForReady(index: number) {
      await waitFor(
        () => readyEvents[index] !== undefined,
        () => {
          let exitText = exit
            ? ` Process exited with code ${exit.code} and signal ${exit.signal}.`
            : ''
          return `Timed out waiting for fixture server.${exitText}\n${processOutput}`
        },
      )
      return readyEvents[index]
    },

    async waitForHmrUrl(index: number) {
      await waitFor(
        () => hmrUrlEvents[index] !== undefined,
        () => {
          let exitText = exit
            ? ` Process exited with code ${exit.code} and signal ${exit.signal}.`
            : ''
          return `Timed out waiting for fixture HMR URL.${exitText}\n${processOutput}`
        },
      )
      return hmrUrlEvents[index]
    },

    async stop() {
      await stopProcess(child)
    },
  }
}

async function waitForResponse(
  port: number,
  expected: string,
  getOutput: () => string = () => '',
): Promise<void> {
  await waitFor(
    async () => {
      try {
        return (await fetchText(port)) === expected
      } catch {
        return false
      }
    },
    () => `Timed out waiting for response ${JSON.stringify(expected)}.\n${getOutput()}`,
  )
}

async function fetchText(port: number, pathname = '/'): Promise<string> {
  let response = await fetch(`http://127.0.0.1:${port}${pathname}`)
  return await response.text()
}

interface HmrEventPayload {
  type: string
  [key: string]: unknown
}

async function connectHmrEvents(url: string): Promise<{
  close(): Promise<void>
  read(): Promise<HmrEventPayload>
}> {
  let response = await fetch(url)
  assert.ok(response.body)

  let reader = response.body.getReader()
  let decoder = new TextDecoder()
  let buffer = ''

  return {
    async close() {
      await reader.cancel()
    },

    async read() {
      while (true) {
        let eventEnd = buffer.indexOf('\n\n')
        if (eventEnd !== -1) {
          let eventText = buffer.slice(0, eventEnd)
          buffer = buffer.slice(eventEnd + 2)
          if (eventText.startsWith(':')) continue
          return parseHmrEventPayload(eventText)
        }

        let { done, value } = await reader.read()
        if (done) {
          throw new Error('HMR event stream closed before the next payload.')
        }

        buffer += decoder.decode(value, { stream: true })
      }
    },
  }
}

async function assertNoHmrEvent(events: { read(): Promise<HmrEventPayload> }): Promise<void> {
  let timeout = Symbol('timeout')
  let result = await Promise.race([
    events.read(),
    new Promise<typeof timeout>((resolve) => setTimeout(() => resolve(timeout), 100)),
  ])
  assert.equal(result, timeout)
}

async function assertNoReadyEvent(
  server: ReturnType<typeof startFixtureServer>,
  index: number,
  timeoutMs = 250,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, timeoutMs))
  assert.equal(server.readyCount <= index, true)
}

function parseHmrEventPayload(eventText: string): HmrEventPayload {
  let dataPrefix = 'data: '
  assert.ok(eventText.startsWith(dataPrefix), eventText)
  let payload: unknown = JSON.parse(eventText.slice(dataPrefix.length))
  assert.ok(isHmrEventPayload(payload), eventText)
  return payload
}

function isHmrEventPayload(value: unknown): value is HmrEventPayload {
  return isRecord(value) && typeof value.type === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function waitFor(
  check: () => boolean | Promise<boolean>,
  getTimeoutMessage: () => string = () => 'Timed out waiting for condition',
): Promise<void> {
  let start = Date.now()

  while (Date.now() - start < 5_000) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  throw new Error(getTimeoutMessage())
}

function parseReadyEvent(line: string): { pid: number; port: number } | null {
  try {
    let event: unknown = JSON.parse(line)
    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'ready' &&
      'port' in event &&
      typeof event.port === 'number' &&
      'pid' in event &&
      typeof event.pid === 'number'
    ) {
      return {
        pid: event.pid,
        port: event.port,
      }
    }
  } catch {
    // Ignore non-JSON process output.
  }

  return null
}

function parseHmrUrlEvent(line: string): { pid: number; url: string } | null {
  try {
    let event: unknown = JSON.parse(line)
    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'hmr-url' &&
      'url' in event &&
      typeof event.url === 'string' &&
      'pid' in event &&
      typeof event.pid === 'number'
    ) {
      return {
        pid: event.pid,
        url: event.url,
      }
    }
  } catch {
    // Ignore non-JSON process output.
  }

  return null
}

async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return

  await new Promise<void>((resolve) => {
    let timeout = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 5_000)

    child.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })

    child.kill('SIGTERM')
  })
}
