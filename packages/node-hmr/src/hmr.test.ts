import * as fs from 'node:fs/promises'
import * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import * as path from 'node:path'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createHmrSupervisor, getSupervisorChokidarWatcher } from './lib/runner.ts'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const nodeTsxImportUrl = import.meta.resolve('@remix-run/node-tsx')
const isWindows = process.platform === 'win32'
// Failure bounds for awaited signals. Tests resolve as soon as the signal arrives.
const failureTimeout = 5_000
const fixtureServerReadyTimeout = isWindows ? 15_000 : failureTimeout

describe('node-hmr', () => {
  it('stops the fixture child server during cleanup', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./message.ts', 'getMessage()'),
      'message.ts': 'export function getMessage() { return "hello" }',
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'hello')

      await server.stop()

      assert.throws(() => process.kill(ready.pid, 0), { code: 'ESRCH' })
    } finally {
      await server.stop()
    }
  })

  it('hot updates self-accepting modules without restarting the server', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./message.ts', 'getMessage()'),
      'message.ts': getSelfAcceptingMessageSource('one'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      await writeFileAtomically(
        path.join(fixture.path, 'message.ts'),
        getSelfAcceptingMessageSource('two'),
      )

      await waitForHotUpdate(server, /message\.ts/)
      assert.equal(await fetchText(ready.port), 'two')
      assert.equal(server.readyCount, 1)
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

      await writeFileAtomically(
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

  it('resolves pending ready() calls after an accept handler requests a restart', async () => {
    await using fixture = await createFixture({
      'server.ts': [
        `import { getMessage } from './message.ts'`,
        `// The test holds this request open until it releases the replacement child.`,
        `if (getMessage() !== 'one') await fetch(process.env.GATE_URL + '/replacement')`,
        getIdleHmrServerSource(),
      ].join('\n'),
      'message.ts': getSelfAcceptingMessageSource('one', { requestRestart: true }),
    })
    await using gates = await createFixtureGateServer()
    let supervisor = createHmrSupervisor({
      browserHmrChannel: null,
      cwd: fixture.path,
      entry: 'server.ts',
      entryArgs: [],
      env: { ...process.env, GATE_URL: gates.url },
      nodeArgs: ['--import', nodeTsxImportUrl],
      registerPath: path.join(packageRoot, 'src/register.ts'),
      watch: { poll: true, pollInterval: 10 },
    })
    let closed = supervisor.start()

    try {
      await supervisor.ready()

      let replacement = gates.hold('replacement')
      await writeFileAtomically(
        path.join(fixture.path, 'message.ts'),
        getSelfAcceptingMessageSource('two', { requestRestart: true }),
      )
      // The old child accepted the update after requesting the restart, and the replacement is
      // held before it reports ready, so this call must wait for the replacement.
      await replacement.arrived
      let ready = supervisor.ready()

      replacement.release()
      await withFailureBound(ready, () => 'Timed out waiting for runner.ready()')
    } finally {
      await supervisor.stop()
      await closed
    }
  })

  it('coalesces rapid restart-causing file changes', async () => {
    await using fixture = await createFixture({
      'server.ts': [`import './message.ts'`, getIdleHmrServerSource()].join('\n'),
      'message.ts': `export const message = 'one'`,
    })
    let supervisor = createHmrSupervisor({
      browserHmrChannel: null,
      cwd: fixture.path,
      entry: 'server.ts',
      entryArgs: [],
      env: process.env,
      nodeArgs: ['--import', nodeTsxImportUrl],
      registerPath: path.join(packageRoot, 'src/register.ts'),
      watch: { poll: true, pollInterval: 10 },
    })
    let closed = supervisor.start()

    try {
      await supervisor.ready()
      let watcher = getSupervisorChokidarWatcher(supervisor)!
      let entryStats = await fs.stat(path.join(fixture.path, 'server.ts'))
      let messageStats = await fs.stat(path.join(fixture.path, 'message.ts'))
      watcher.emit('all', 'change', 'message.ts', messageStats)
      watcher.emit('all', 'change', 'server.ts', entryStats)

      // ready() waits for every scheduled restart, so a second restart would bump the generation.
      await supervisor.ready()
      assert.equal(supervisor.generation, 1)
    } finally {
      await supervisor.stop()
      await closed
    }
  })

  it('ignores a repeated entry change event after the first restart completes', async () => {
    await using fixture = await createFixture({
      'server.ts': getIdleHmrServerSource(),
    })
    let supervisor = createHmrSupervisor({
      browserHmrChannel: null,
      cwd: fixture.path,
      entry: 'server.ts',
      entryArgs: [],
      env: process.env,
      nodeArgs: ['--import', nodeTsxImportUrl],
      registerPath: path.join(packageRoot, 'src/register.ts'),
    })
    let closed = supervisor.start()

    try {
      await supervisor.ready()
      let watcher = getSupervisorChokidarWatcher(supervisor)
      assert.ok(watcher)

      let entryPath = path.join(fixture.path, 'server.ts')
      let entryStats = await fs.stat(entryPath)
      watcher.emit('all', 'change', 'server.ts', entryStats)

      await supervisor.ready()
      assert.equal(supervisor.generation, 1)

      // A relevant change schedules its flush synchronously, so ready() would wait for a restart.
      watcher.emit('all', 'change', 'server.ts', entryStats)

      await supervisor.ready()
      assert.equal(supervisor.generation, 1)
    } finally {
      await supervisor.stop()
      await closed
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

      await writeFileAtomically(fixture.entryPath, getHmrProxyChildServerSource('two'))
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
      'server.ts': getHmrProxyHotChildServerSource('one'),
    })
    await using gates = await createFixtureGateServer()
    let server = startFixtureServer(fixture.path, { env: { GATE_URL: gates.url } })

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      let listen = gates.hold('listen-two')
      await writeFileAtomically(
        fixture.entryPath,
        getHmrProxyHotChildServerSource('two', { gate: 'listen-two' }),
      )
      await listen.arrived

      // The request reaches the proxy while the updated entry is not listening yet.
      let responsePromise = fetch(`http://127.0.0.1:${ready.port}/during-entry-update`)
      await waitForOutput(server, /"type":"proxy-request","path":"\/during-entry-update"/)
      listen.release()

      let response = await responsePromise
      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'two')
      await waitForOutput(server, /"type":"child-ready","message":"two"/)
    } finally {
      await server.stop()
    }
  })

  it('waits for all overlapping browser HMR file handlers before reporting ready', async () => {
    await using fixture = await createFixture({
      'browser/a.css': 'one',
      'browser/b.css': 'one',
      'server.ts': getOverlappingBrowserHmrServerSource(),
      'signals/.gitkeep': '',
    })
    await using gates = await createFixtureGateServer()
    let watchFileA = path.join(fixture.path, 'browser/a.css')
    let watchFileB = path.join(fixture.path, 'browser/b.css')
    let hmrUrlFile = path.join(fixture.path, 'signals/hmr-url')
    let supervisor = createHmrSupervisor({
      browserHmrChannel: { port: 0 },
      cwd: fixture.path,
      entry: 'server.ts',
      entryArgs: [],
      env: {
        ...process.env,
        GATE_URL: gates.url,
        HMR_URL_FILE: hmrUrlFile,
        WATCH_FILE_A: watchFileA,
        WATCH_FILE_B: watchFileB,
      },
      nodeArgs: ['--import', nodeTsxImportUrl],
      registerPath: path.join(packageRoot, 'src/register.ts'),
      watch: { poll: true, pollInterval: 10 },
    })
    let closed = supervisor.start()
    let events: Awaited<ReturnType<typeof connectHmrEvents>> | undefined

    try {
      await supervisor.ready()
      events = await connectHmrEvents(await fs.readFile(hmrUrlFile, 'utf-8'))

      let handlerA = gates.hold('a')
      let handlerB = gates.hold('b')
      await writeFileAtomically(watchFileA, 'two')
      await handlerA.arrived
      await writeFileAtomically(watchFileB, 'two')
      await handlerB.arrived

      let readyResolved = false
      let ready = supervisor.ready().then(() => {
        readyResolved = true
      })

      handlerA.release()
      assert.deepEqual(await events.read(), {
        data: {
          'test/browser@1': { path: '/a.css', timestamp: 1 },
        },
        type: 'browser:update',
      })
      assert.equal(readyResolved, false)

      handlerB.release()
      await ready
      assert.equal(readyResolved, true)
    } finally {
      await events?.close()
      await supervisor.stop()
      await closed
    }
  })

  it('ignores a repeated browser change event after the first update completes', async () => {
    await using fixture = await createFixture({
      'browser/entry.ts': 'one',
      'browser/other.ts': 'one',
      'server.ts': getBrowserHmrServerSource(),
      'signals/.gitkeep': '',
    })
    let watchFile = path.join(fixture.path, 'browser/entry.ts')
    let otherWatchFile = path.join(fixture.path, 'browser/other.ts')
    let hmrUrlFile = path.join(fixture.path, 'signals/hmr-url')
    let supervisor = createHmrSupervisor({
      browserHmrChannel: { port: 0 },
      cwd: fixture.path,
      entry: 'server.ts',
      entryArgs: [],
      env: {
        ...process.env,
        HMR_URL_FILE: hmrUrlFile,
        OTHER_WATCH_FILE: otherWatchFile,
        WATCH_FILE: watchFile,
      },
      nodeArgs: ['--import', nodeTsxImportUrl],
      registerPath: path.join(packageRoot, 'src/register.ts'),
      watch: { poll: true, pollInterval: 10 },
    })
    let closed = supervisor.start()
    let events: Awaited<ReturnType<typeof connectHmrEvents>> | undefined

    try {
      await supervisor.ready()
      events = await connectHmrEvents(await fs.readFile(hmrUrlFile, 'utf-8'))
      let watcher = getSupervisorChokidarWatcher(supervisor)
      assert.ok(watcher)

      let watchFileStats = await fs.stat(watchFile)
      watcher.emit('all', 'change', 'browser/entry.ts', watchFileStats)

      assert.deepEqual(await events.read(), {
        data: {
          'test/browser@1': {
            details: [null, true, { version: 1 }],
            path: '/entry.ts',
            timestamp: 1,
          },
        },
        type: 'browser:update',
      })

      watcher.emit('all', 'change', 'browser/entry.ts', watchFileStats)
      await supervisor.ready()

      // A later, distinct change must produce the next event if the repeated one was ignored.
      watcher.emit('all', 'change', 'browser/other.ts', await fs.stat(otherWatchFile))
      assert.deepEqual(await events.read(), {
        data: {
          'test/browser@1': {
            details: [null, true, { version: 2 }],
            path: '/other.ts',
            timestamp: 2,
          },
        },
        type: 'browser:update',
      })
    } finally {
      await events?.close()
      await supervisor.stop()
      await closed
    }
  })

  it('retries safe proxy responses during a restart', async () => {
    await using fixture = await createHmrProxyFixture({
      'server.ts': getHmrProxyChildServerSource('one'),
    })
    await using gates = await createFixtureGateServer()
    let server = startFixtureServer(fixture.path, { env: { GATE_URL: gates.url } })

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      let staleResponse = gates.hold('retry-during-restart')
      let responsePromise = fetch(`http://127.0.0.1:${ready.port}/retry-during-restart`)
      await staleResponse.arrived
      await writeFileAtomically(fixture.entryPath, getHmrProxyChildServerSource('two'))
      await waitForOutput(server, /restart server\.ts/)
      staleResponse.release()

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

      await writeFileAtomically(path.join(fixture.path, 'value.ts'), `export const message = 'two'`)

      await waitForHotUpdate(server, /value\.ts/)
      assert.equal(await fetchText(ready.port), 'two')
      assert.equal(server.readyCount, 1)
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

      await writeFileAtomically(
        path.join(fixture.path, 'value.ts'),
        getDisposeOnlyValueSource('two'),
      )

      await waitForHotUpdate(server, /value\.ts/)
      assert.equal(
        await fetchText(ready.port),
        [
          'two',
          'message eval: one',
          'message dispose: one',
          'message eval after dispose: one',
          'message eval: two',
          'parent accept: two',
        ].join('|'),
      )
      assert.equal(server.readyCount, 1)
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

      await writeFileAtomically(
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

      await waitForHotUpdate(server, /message\.ts/)
      assert.equal(await fetchText(ready.port), 'two')
      assert.equal(server.readyCount, 1)
      assert.match(server.output, /message boundary declined update/)
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

      await writeFileAtomically(
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
      await server.waitForRunnerReady()

      await writeFileAtomically(
        path.join(fixture.path, 'packages/fixture-message/index.ts'),
        `export const message = 'two'`,
      )

      await waitForHotUpdate(server, /packages\/fixture-message\/index\.ts/)
      assert.equal(await fetchText(ready.port), 'two')
      assert.equal(server.readyCount, 1)
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

      await writeFileAtomically(
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

      await waitForHotUpdate(server, /message\.ts/)
      assert.equal(await fetchText(ready.port), 'two')
      assert.equal(server.readyCount, 1)

      let outputBeforeStaleChange = server.output.length
      await writeFileAtomically(
        path.join(fixture.path, 'value.ts'),
        `export const message = 'stale'`,
      )
      // A later change to the current dependency proves the watcher has moved past the stale one.
      await writeFileAtomically(
        path.join(fixture.path, 'other.ts'),
        `export const message = 'three'`,
      )

      await waitForHotUpdate(server, /other\.ts/)
      assert.equal(await fetchText(ready.port), 'three')
      assert.equal(server.readyCount, 1)
      assert.doesNotMatch(server.output.slice(outputBeforeStaleChange), /value\.ts/)
    } finally {
      await server.stop()
    }
  })

  it('ignores file changes outside the imported module graph', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./message.ts', 'getMessage()'),
      'message.ts': getSelfAcceptingMessageSource('one'),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'one')

      let sessionPath = path.join(fixture.path, 'tmp/sessions/session-id')
      await fs.mkdir(path.dirname(sessionPath), { recursive: true })
      await fs.writeFile(sessionPath, 'session data')
      // A later change inside the module graph proves the watcher has moved past the session file.
      await writeFileAtomically(
        path.join(fixture.path, 'message.ts'),
        getSelfAcceptingMessageSource('two'),
      )

      await waitForHotUpdate(server, /message\.ts/)
      assert.equal(await fetchText(ready.port), 'two')
      assert.equal(server.readyCount, 1)
      assert.doesNotMatch(server.output, /tmp[\\/]sessions/)
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

      await writeFileAtomically(path.join(fixture.path, 'value.ts'), `export const message = 'two'`)

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      await server.waitForRunnerReady()
      assert.equal(await fetchText(restarted.port), 'two')
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

      await writeFileAtomically(path.join(fixture.path, 'value.ts'), `export const message = 'two'`)

      await waitForHotUpdate(server, /value\.ts/)
      assert.equal(await fetchText(ready.port), 'two')
      assert.equal(server.readyCount, 1)
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

      await writeFileAtomically(
        path.join(fixture.path, 'message.ts'),
        [`export function getMessage() {`, `  return 'two'`, `}`].join('\n'),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      await server.waitForRunnerReady()
      assert.equal(await fetchText(restarted.port), 'two')
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

      await writeFileAtomically(
        path.join(fixture.path, 'greeting.tsx'),
        getGenericGreetingSource({ message: 'Updated from generic boundary' }),
      )

      await waitForHotUpdate(server, /greeting\.tsx/)
      assert.equal(await fetchText(ready.port), 'Updated from generic boundary')
      assert.equal(server.readyCount, 1)
    } finally {
      await server.stop()
    }
  })

  it('keeps active server exports current across repeated updates', async () => {
    let initialSource = getGenericGreetingSource({ message: 'initial' })
    let updatedSource = getGenericGreetingSource({ message: 'updated' })
    await using fixture = await createFixture({
      'server.ts': getEventChannelGreetingServerSource(),
      'greeting.tsx': initialSource,
    })
    let server = startFixtureServer(fixture.path)

    try {
      let hmrUrl = await server.waitForHmrUrl(0)
      let events = await connectHmrEvents(hmrUrl.url)
      try {
        let ready = await server.waitForReady(0)
        assert.equal(await fetchText(ready.port), `${ready.pid}:initial`)

        await writeFileAtomically(path.join(fixture.path, 'greeting.tsx'), updatedSource)
        assert.deepEqual(await events.read(), { type: 'server:update' })
        assert.equal(await fetchText(ready.port), `${ready.pid}:updated`)

        await writeFileAtomically(path.join(fixture.path, 'greeting.tsx'), updatedSource)
        assert.deepEqual(await events.read(), { type: 'server:update' })
        assert.equal(await fetchText(ready.port), `${ready.pid}:updated`)
        assert.equal(server.output.match(/hmr update greeting\.tsx/g)?.length, 2)

        await writeFileAtomically(path.join(fixture.path, 'greeting.tsx'), initialSource)
        assert.deepEqual(await events.read(), { type: 'server:update' })
        assert.equal(await fetchText(ready.port), `${ready.pid}:initial`)
        assert.equal(server.output.match(/hmr update greeting\.tsx/g)?.length, 3)
      } finally {
        await events.close()
      }
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

      await writeFileAtomically(
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
      await server.waitForRunnerReady()
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

      await writeFileAtomically(
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
      await server.waitForRunnerReady()
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

      await writeFileAtomically(
        path.join(fixture.path, 'greeting.tsx'),
        getGenericGreetingSource({ message: 'Updated after restart' }),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      assert.equal(await fetchText(restarted.port), `${restarted.pid}:Updated after restart`)
      assert.match(server.output, /restart Updated module removed export "foo"/)
      assert.doesNotMatch(server.output, /Failed to hot update/)
      await server.waitForRunnerReady()
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

      await writeFileAtomically(
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
      await server.waitForRunnerReady()
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

      await writeFileAtomically(
        path.join(fixture.path, 'greeting.tsx'),
        getGenericGreetingSource({
          extraExports: [`import { foo } from './stable.ts'`, `export { foo }`],
          message: 'Updated from generic boundary',
          runtimeExportNames: ['Greeting', 'foo'],
        }),
      )

      await waitForHotUpdate(server, /greeting\.tsx/)
      assert.equal(await fetchText(ready.port), `${ready.pid}:Updated from generic boundary`)
      assert.equal(server.readyCount, 1)
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

      await writeFileAtomically(
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
      await server.waitForRunnerReady()
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

        await writeFileAtomically(
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

        // The next event must be the marker if only one server update was sent.
        assert.equal(await fetchText(restarted.port, '/marker'), 'marker')
        assert.deepEqual(await events.read(), { type: 'test:marker' })
      } finally {
        await events.close()
      }
    } finally {
      await server.stop()
    }
  })

  it('waits for the replacement child before flushing browser reloads', async () => {
    await using fixture = await createFixture(
      {
        'server.ts': getOverlappingServerUpdateSource(),
        'rejecting.ts': getRejectingServerUpdateSource(),
        'shared.ts': getSharedServerUpdateSource({ addedExport: false }),
      },
      { watch: { poll: true } },
    )
    await using gates = await createFixtureGateServer()
    let server = startFixtureServer(fixture.path, { env: { GATE_URL: gates.url } })

    try {
      let hmrUrl = await server.waitForHmrUrl(0)
      let events = await connectHmrEvents(hmrUrl.url)
      try {
        let ready = await server.waitForReady(0)
        let replacement = gates.hold('replacement')
        let browserEvent: HmrEventPayload | undefined
        let browserEventPromise = events.read().then((event) => {
          browserEvent = event
        })

        await writeFileAtomically(
          path.join(fixture.path, 'shared.ts'),
          getSharedServerUpdateSource({ addedExport: true }),
        )

        let staleReady = await server.waitForReady(1)
        assert.equal(staleReady.pid, ready.pid)
        await replacement.arrived
        assert.equal(browserEvent, undefined)

        replacement.release()
        let restarted = await server.waitForReady(2)
        assert.notEqual(restarted.pid, ready.pid)
        await browserEventPromise
        assert.deepEqual(browserEvent, { type: 'browser:reload' })
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

      await writeFileAtomically(fixture.entryPath, getServerSource('./message.ts', 'getMessage()'))
      await writeFileAtomically(
        path.join(fixture.path, 'message.ts'),
        [`export function getMessage() {`, `  return 'fixed'`, `}`].join('\n'),
      )

      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'fixed')
      assert.match(server.output, /restart .*server\.ts/)
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

      await writeFileAtomically(
        path.join(fixture.path, 'message.ts'),
        `export function getMessage( {\n`,
      )

      await waitForOutput(server, /Failed running server\.ts\. Waiting for file changes/)

      await writeFileAtomically(
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

        await writeFileAtomically(fixture.entryPath, `export function broken( {\n`)
        await waitForOutput(server, /Failed running server\.ts\. Waiting for file changes/)

        await writeFileAtomically(fixture.entryPath, getEventChannelServerSource('two'))

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

        await writeFileAtomically(fixture.entryPath, `export function broken( {\n`)
        await waitForOutput(server, /Failed running server\.ts\. Waiting for file changes/)

        await writeFileAtomically(fixture.entryPath, getEventChannelServerSource('two!!!'))

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
        'server.ts': getSlowShutdownServerSource('one', { ignoredSigterms: 1 }),
      })
      let server = startFixtureServer(fixture.path)

      try {
        let ready = await server.waitForReady(0)
        assert.equal(await fetchText(ready.port), 'one')

        // The replacement exits on its first SIGTERM so cleanup does not wait for a force kill.
        await writeFileAtomically(fixture.entryPath, getSlowShutdownServerSource('two'))

        await waitForOutput(server, /"type":"child-sigterm","count":1/)
        // The old child ignores the first SIGTERM, so the restart must stay blocked on its exit.
        // The runner spawns synchronously after signaling, so a replacement would already exist.
        let { stdout } = await promisify(execFile)('pgrep', ['-P', String(server.pid)])
        assert.deepEqual(stdout.trim().split('\n'), [String(ready.pid)])

        // A second SIGTERM releases the old child. The replacement must only start after it exits.
        process.kill(ready.pid, 'SIGTERM')
        let restarted = await server.waitForReady(1)
        assert.notEqual(restarted.pid, ready.pid)
        assert.equal(await fetchText(restarted.port), 'two')
        assert.throws(() => process.kill(ready.pid, 0), { code: 'ESRCH' })
      } finally {
        await server.stop()
      }
    },
  )

  it(
    'spawns one replacement when files change while the previous child is exiting',
    { skip: isWindows && 'Windows terminates child processes without delivering SIGTERM handlers' },
    async () => {
      await using fixture = await createFixture({
        'server.ts': getSlowShutdownServerSource('one', { ignoredSigterms: 1 }),
      })
      let server = startFixtureServer(fixture.path)

      try {
        let ready = await server.waitForReady(0)
        assert.equal(await fetchText(ready.port), 'one')

        await writeFileAtomically(fixture.entryPath, getSlowShutdownServerSource('two'))
        await waitForOutput(server, /"type":"child-sigterm","count":1/)
        // The old child ignores the first SIGTERM, so this change arrives while it is exiting.
        await writeFileAtomically(fixture.entryPath, getSlowShutdownServerSource('three'))
        await waitForOutput(server, /restart server\.ts[\s\S]*restart server\.ts/)
        process.kill(ready.pid, 'SIGTERM')

        ready = await server.waitForReady(1)
        assert.equal(await fetchText(ready.port), 'three')
        // runner.ready() waits for any scheduled restart, so a second replacement would show here.
        await server.waitForRunnerReady()
        assert.equal(server.readyCount, 2)
      } finally {
        await server.stop()
      }
    },
  )

  it(
    'waits for a force-killed child process before completing shutdown',
    { skip: isWindows && 'Windows terminates child processes without delivering SIGTERM handlers' },
    async () => {
      await using fixture = await createFixture({
        'server.ts': [
          `import { writeFileSync } from 'node:fs'`,
          `process.on('SIGTERM', () => {})`,
          `writeFileSync('child.pid', String(process.pid))`,
          getIdleHmrServerSource(),
        ].join('\n'),
      })
      let supervisor = createHmrSupervisor({
        browserHmrChannel: null,
        cwd: fixture.path,
        entry: 'server.ts',
        entryArgs: [],
        env: process.env,
        nodeArgs: ['--import', nodeTsxImportUrl],
        registerPath: path.join(packageRoot, 'src/register.ts'),
        shutdownTimeoutMs: 0,
        watch: { poll: true, pollInterval: 10 },
      })
      let closed = supervisor.start()
      await supervisor.ready()
      let pid = Number(await fs.readFile(path.join(fixture.path, 'child.pid'), 'utf-8'))

      await supervisor.stop()
      await closed
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' })
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
    } finally {
      await server.stop()
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

function getSelfAcceptingMessageSource(
  message: string,
  options: { requestRestart?: boolean } = {},
): string {
  return [
    `export let message = ${JSON.stringify(message)}`,
    `export function getMessage() {`,
    `  return message`,
    `}`,
    `if (import.meta.hot) {`,
    `  import.meta.hot.accept((module) => {`,
    // Spoofs the runtime's internal restart request from a handler that then finishes accepting.
    ...(options.requestRestart
      ? [`    process.send?.({ type: 'node-hmr:child:restart-requested' })`]
      : []),
    `    if (module && typeof module === 'object' && 'message' in module) {`,
    `      message = String(module.message)`,
    `    }`,
    `  })`,
    `}`,
  ].join('\n')
}

function getSlowShutdownServerSource(message: string, options = { ignoredSigterms: 0 }): string {
  let nodeHmrRuntimeUrl = pathToFileURL(path.join(packageRoot, 'src/runtime.node-hmr.ts')).href

  return [
    `import { createServer } from 'node:http'`,
    `import { emitServerReady } from ${JSON.stringify(nodeHmrRuntimeUrl)}`,
    ``,
    `let sigtermCount = 0`,
    `let server = createServer((_request, response) => {`,
    `  response.end(${JSON.stringify(message)})`,
    `})`,
    ``,
    `process.on('SIGTERM', () => {`,
    `  sigtermCount += 1`,
    `  console.log(JSON.stringify({ type: 'child-sigterm', count: sigtermCount, pid: process.pid }))`,
    `  if (sigtermCount > ${options.ignoredSigterms}) process.exit(0)`,
    `})`,
    ``,
    `server.listen(0, '127.0.0.1', () => {`,
    `  let address = server.address()`,
    `  if (address && typeof address === 'object') {`,
    `    console.log(JSON.stringify({ type: 'ready', port: address.port, pid: process.pid }))`,
    `  }`,
    `  emitServerReady()`,
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
    `server.listen(0, '127.0.0.1', () => {`,
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
    `server.listen(0, '127.0.0.1', () => {`,
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
    `let server = createServer((request, response) => {`,
    `  if (request.url === '/marker') {`,
    `    // Spoofs the runtime's internal browser-event IPC message so the test can append a known`,
    `    // event to the parent's HMR stream and prove no other event was sent before it.`,
    `    process.send?.({ type: 'node-hmr:child:browser-event-emitted', payload: { type: 'test:marker' } })`,
    `    response.end('marker')`,
    `    return`,
    `  }`,
    `  response.end(String(process.pid) + ':' + Greeting()())`,
    `})`,
    ``,
    `server.listen(0, '127.0.0.1', () => {`,
    `  let address = server.address()`,
    `  if (address && typeof address === 'object') {`,
    `    emitServerReady()`,
    `    console.log(JSON.stringify({ type: 'ready', port: address.port, pid: process.pid }))`,
    `  }`,
    `})`,
  ].join('\n')
}

function getOverlappingServerUpdateSource(): string {
  let nodeHmrRuntimeUrl = pathToFileURL(path.join(packageRoot, 'src/runtime.node-hmr.ts')).href

  return [
    `import { createServer } from 'node:http'`,
    `import { access, writeFile } from 'node:fs/promises'`,
    `import { fileURLToPath } from 'node:url'`,
    `import { createBrowserHmrChannel, emitServerReady } from ${JSON.stringify(nodeHmrRuntimeUrl)}`,
    `import './rejecting.ts'`,
    `import * as shared from './shared.ts'`,
    ``,
    `let initialStartedFile = fileURLToPath(new URL('./initial-started', import.meta.url))`,
    `let watchFile = fileURLToPath(new URL('./shared.ts', import.meta.url))`,
    ``,
    `let isReplacement = await exists(initialStartedFile)`,
    `if (isReplacement) {`,
    `  // The test holds this request open until it releases the replacement child.`,
    `  await fetch(process.env.GATE_URL + '/replacement')`,
    `} else {`,
    `  await writeFile(initialStartedFile, '')`,
    `}`,
    ``,
    `let browserHmrChannel = await createBrowserHmrChannel()`,
    `browserHmrChannel.updateWatchedFiles({ add: [watchFile], remove: [] })`,
    `browserHmrChannel.onFileEvents(() => [{ type: 'reload' }])`,
    `console.log(JSON.stringify({ type: 'hmr-url', url: browserHmrChannel.url, pid: process.pid }))`,
    ``,
    `let currentMessage = shared.message`,
    `let server`,
    `await listen()`,
    ``,
    `if (import.meta.hot) {`,
    `  import.meta.hot.accept('./shared.ts', async (updatedModule) => {`,
    `    // Keep this update in flight until rejecting.ts has started invalidating the same change.`,
    `    await globalThis.__invalidationStarted.promise`,
    `    if (updatedModule && typeof updatedModule.message === 'string') {`,
    `      currentMessage = updatedModule.message`,
    `    }`,
    `    server.closeAllConnections()`,
    `    await new Promise((resolve) => server.close(resolve))`,
    `    await listen()`,
    `  })`,
    `}`,
    ``,
    `async function listen() {`,
    `  server = createServer((_request, response) => {`,
    `    response.end(currentMessage)`,
    `  })`,
    `  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))`,
    `  let address = server.address()`,
    `  if (address && typeof address === 'object') {`,
    `    emitServerReady()`,
    `    console.log(JSON.stringify({ type: 'ready', port: address.port, pid: process.pid }))`,
    `  }`,
    `}`,
    ``,
    `async function exists(filePath) {`,
    `  try {`,
    `    await access(filePath)`,
    `    return true`,
    `  } catch {`,
    `    return false`,
    `  }`,
    `}`,
  ].join('\n')
}

function getRejectingServerUpdateSource(): string {
  return [
    `import './shared.ts'`,
    ``,
    `globalThis.__invalidationStarted = Promise.withResolvers()`,
    ``,
    `if (import.meta.hot) {`,
    `  import.meta.hot.accept('./shared.ts', async () => {`,
    `    globalThis.__invalidationStarted.resolve()`,
    `    import.meta.hot.invalidate('Rejected shared server update')`,
    `  })`,
    `}`,
  ].join('\n')
}

function getSharedServerUpdateSource(options: { addedExport: boolean }): string {
  return [
    `export const message = 'hello'`,
    ...(options.addedExport ? [`export const added = true`] : []),
  ].join('\n')
}

function getOverlappingBrowserHmrServerSource(): string {
  let nodeHmrRuntimeUrl = pathToFileURL(path.join(packageRoot, 'src/runtime.node-hmr.ts')).href

  return [
    `import * as fs from 'node:fs/promises'`,
    `import { createBrowserHmrChannel, emitServerReady } from ${JSON.stringify(nodeHmrRuntimeUrl)}`,
    ``,
    `let channel = await createBrowserHmrChannel()`,
    `channel.updateWatchedFiles({`,
    `  add: [process.env.WATCH_FILE_A, process.env.WATCH_FILE_B],`,
    `  remove: [],`,
    `})`,
    `channel.onFileEvents(async (events) => {`,
    `  let filePath = events[0]?.filePath`,
    `  let isFileA = filePath === process.env.WATCH_FILE_A`,
    `  // The test holds this request open until it releases the handler.`,
    `  await fetch(process.env.GATE_URL + (isFileA ? '/a' : '/b'))`,
    `  return [{`,
    `    data: {`,
    `      'test/browser@1': {`,
    `        path: isFileA ? '/a.css' : '/b.css',`,
    `        timestamp: isFileA ? 1 : 2,`,
    `      },`,
    `    },`,
    `    type: 'update',`,
    `  }]`,
    `})`,
    `await fs.writeFile(process.env.HMR_URL_FILE, channel.url)`,
    `emitServerReady()`,
    `setInterval(() => {}, 1_000)`,
  ].join('\n')
}

function getBrowserHmrServerSource(): string {
  let nodeHmrRuntimeUrl = pathToFileURL(path.join(packageRoot, 'src/runtime.node-hmr.ts')).href

  return [
    `import * as fs from 'node:fs/promises'`,
    `import { createBrowserHmrChannel, emitServerReady } from ${JSON.stringify(nodeHmrRuntimeUrl)}`,
    ``,
    `let channel = await createBrowserHmrChannel()`,
    `channel.updateWatchedFiles({`,
    `  add: [process.env.WATCH_FILE, process.env.OTHER_WATCH_FILE],`,
    `  remove: [],`,
    `})`,
    `let version = 0`,
    `channel.onFileEvents((events) => {`,
    `  version += 1`,
    `  let fileName = events[0].filePath.split(/[\\\\/]/).pop()`,
    `  return [{`,
    `    data: {`,
    `      'test/browser@1': {`,
    `        details: [null, true, { version }],`,
    `        path: '/' + fileName,`,
    `        timestamp: version,`,
    `      },`,
    `    },`,
    `    type: 'update',`,
    `  }]`,
    `})`,
    `await fs.writeFile(process.env.HMR_URL_FILE, channel.url)`,
    `emitServerReady()`,
    `setInterval(() => {}, 1_000)`,
  ].join('\n')
}

function getIdleHmrServerSource(): string {
  let nodeHmrRuntimeUrl = pathToFileURL(path.join(packageRoot, 'src/runtime.node-hmr.ts')).href

  return [
    `import { emitServerReady } from ${JSON.stringify(nodeHmrRuntimeUrl)}`,
    `emitServerReady()`,
    `setInterval(() => {}, 1_000)`,
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
    `    await fetch(process.env.CHILD_PORT_URL, { method: 'POST', body: String(address.port) })`,
    `    emitServerReady()`,
    `    console.log(JSON.stringify({ type: 'child-ready', message: ${JSON.stringify(message)}, port: address.port, pid: process.pid }))`,
    `  }`,
    `})`,
  ].join('\n')
}

function getHmrProxyHotChildServerSource(message: string, options: { gate?: string } = {}): string {
  let listenGate =
    options.gate === undefined
      ? 'Promise.resolve()'
      : `fetch(process.env.GATE_URL + ${JSON.stringify(`/${options.gate}`)})`
  let nodeHmrRuntimeUrl = pathToFileURL(path.join(packageRoot, 'src/runtime.node-hmr.ts')).href
  let nodeFetchServerImportUrl = pathToFileURL(
    path.join(packageRoot, '../node-fetch-server/src/index.ts'),
  ).href

  return [
    `import * as http from 'node:http'`,
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
    `// The test can hold the gate request open to keep an entry update from listening yet.`,
    `${listenGate}.then(() => {`,
    `  server.listen(port, '127.0.0.1', async () => {`,
    `    let address = server.address()`,
    `    if (address && typeof address === 'object') {`,
    `      await fetch(process.env.CHILD_PORT_URL, { method: 'POST', body: String(address.port) })`,
    `      emitServerReady()`,
    `      console.log(JSON.stringify({ type: 'child-ready', message: ${JSON.stringify(message)}, port: address.port, pid: process.pid }))`,
    `    }`,
    `  })`,
    `})`,
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
  options: { nodeArgs?: string[]; watch?: { poll: boolean } } = {},
): Promise<AsyncDisposable & { entryPath: string; path: string }> {
  let fixtureRoot = path.join(packageRoot, '.tmp')
  await fs.mkdir(fixtureRoot, { recursive: true })

  let fixturePath = await fs.mkdtemp(path.join(fixtureRoot, 'node-hmr-'))
  let nodeHmrImportUrl = pathToFileURL(path.join(packageRoot, 'src/index.ts')).href
  let nodeArgs = options.nodeArgs ?? ['--import', nodeTsxImportUrl]
  await writeFixtureFiles(fixturePath, {
    ...files,
    'dev.ts': [
      `import { createServer } from 'node:http'`,
      `import { run } from ${JSON.stringify(nodeHmrImportUrl)}`,
      ``,
      `let runner = run('server.ts', {`,
      `  nodeArgs: ${JSON.stringify(nodeArgs)},`,
      ...(options.watch === undefined ? [] : [`  watch: ${JSON.stringify(options.watch)},`]),
      `})`,
      ``,
      `// Each request waits for the runner to settle before responding. This uses HTTP rather`,
      `// than stdin because the runner's child inherits stdin, and on Windows a pending read on`,
      `// an inherited pipe blocks the child from starting.`,
      `let readyServer = createServer(async (_request, response) => {`,
      `  await runner.ready()`,
      `  response.end('ready')`,
      `})`,
      `readyServer.unref()`,
      `readyServer.listen(0, '127.0.0.1', () => {`,
      `  let address = readyServer.address()`,
      `  console.log(JSON.stringify({ type: 'runner-ready-url', url: \`http://127.0.0.1:\${address.port}/\`, pid: process.pid }))`,
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
  await writeFixtureFiles(fixturePath, {
    ...files,
    'dev.ts': [
      `import * as http from 'node:http'`,
      ``,
      `import { createFetchProxy } from ${JSON.stringify(fetchProxyImportUrl)}`,
      `import { createHmrReadyFetch, run } from ${JSON.stringify(nodeHmrImportUrl)}`,
      `import { createRequestListener } from ${JSON.stringify(nodeFetchServerImportUrl)}`,
      ``,
      `const originPort = 0`,
      `let childPort = 0`,
      ``,
      `let returnedStaleGateway = false`,
      ``,
      `// Child servers POST their port here before emitServerReady(), so the port is current`,
      `// whenever createHmrReadyFetch() lets a request through.`,
      `const portRegistry = http.createServer(async (request, response) => {`,
      `  let body = ''`,
      `  for await (let chunk of request) body += chunk`,
      `  childPort = Number(body)`,
      `  response.end()`,
      `})`,
      `await new Promise((resolve) => portRegistry.listen(0, '127.0.0.1', resolve))`,
      ``,
      `const hmrRunner = run('server.ts', {`,
      `  env: {`,
      `    ...process.env,`,
      `    CHILD_PORT_URL: 'http://127.0.0.1:' + portRegistry.address().port,`,
      `    PORT: String(childPort),`,
      `  },`,
      `  nodeArgs: ['--import', ${JSON.stringify(nodeTsxImportUrl)}],`,
      `})`,
      ``,
      `const readyFetch = createHmrReadyFetch(`,
      `  hmrRunner,`,
      `  createFetchProxy('http://127.0.0.1:0', {`,
      `    xForwardedHeaders: true,`,
      `    async fetch(input, init) {`,
      `      let targetUrl = new URL(String(input))`,
      `      if (targetUrl.pathname === '/retry-during-restart' && !returnedStaleGateway) {`,
      `        returnedStaleGateway = true`,
      `        // The test releases this stale response once its entry change has started a restart.`,
      `        await fetch(process.env.GATE_URL + '/retry-during-restart')`,
      `        return new Response('stale gateway', { status: 503 })`,
      `      }`,
      `      targetUrl.port = String(childPort)`,
      `      return await fetch(targetUrl, init)`,
      `    },`,
      `  }),`,
      `)`,
      ``,
      `const server = http.createServer(`,
      `  createRequestListener((request) => {`,
      `    console.log(JSON.stringify({ type: 'proxy-request', path: new URL(request.url).pathname }))`,
      `    return readyFetch(request)`,
      `  }),`,
      `)`,
      ``,
      `server.listen(originPort, '127.0.0.1', () => {`,
      `  let address = server.address()`,
      `  if (address && typeof address === 'object') {`,
      `    console.log(JSON.stringify({ type: 'proxy-ready', port: address.port, pid: process.pid }))`,
      `  }`,
      `})`,
      ``,
      `let shuttingDown = false`,
      ``,
      `function shutdown() {`,
      `  if (shuttingDown) return`,
      `  shuttingDown = true`,
      `  portRegistry.close()`,
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

async function writeFileAtomically(filePath: string, contents: string): Promise<void> {
  let temporaryPath = `${filePath}.tmp`
  await fs.writeFile(temporaryPath, contents)
  await fs.rename(temporaryPath, filePath)
}

async function waitForOutput(server: ReturnType<typeof startFixtureServer>, pattern: RegExp) {
  await server.waitUntil(
    () => pattern.test(server.output),
    () => `Timed out waiting for output ${pattern}.\n${server.output}`,
  )
}

// Waits for the runner's hot update log for a file, then for the runner to report that every
// pending update was accepted. Callers can then fetch once and assert the exact response.
async function waitForHotUpdate(server: ReturnType<typeof startFixtureServer>, file: RegExp) {
  await waitForOutput(server, new RegExp(`hmr update ${file.source}`))
  await server.waitForRunnerReady()
}

// Fixture processes fetch `${url}/<name>` to report that they reached a point. The request is
// held open until the test calls `release()`, so the fixture can await it as an explicit gate.
async function createFixtureGateServer() {
  let gates = new Map<
    string,
    { arrived: PromiseWithResolvers<void>; released: PromiseWithResolvers<void> }
  >()
  let getGate = (name: string) => {
    let gate = gates.get(name) ?? {
      arrived: Promise.withResolvers(),
      released: Promise.withResolvers(),
    }
    gates.set(name, gate)
    return gate
  }

  let server = http.createServer(async (request, response) => {
    let gate = getGate(request.url!.slice(1))
    gate.arrived.resolve()
    await gate.released.promise
    response.writeHead(204, { Connection: 'close' })
    response.end()
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  let { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}`,
    hold(name: string) {
      let gate = getGate(name)
      let arrived = withFailureBound(
        gate.arrived.promise,
        () => `Timed out waiting for gate ${name}`,
      )
      // A test that fails before awaiting a gate must not crash the worker with this rejection.
      arrived.catch(() => {})
      return { arrived, release: gate.released.resolve }
    },
    async [Symbol.asyncDispose]() {
      // Destroys requests that are still held, so fixtures do not wait on them during cleanup.
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}

async function withFailureBound<value>(
  promise: Promise<value>,
  getMessage: () => string,
  timeoutMs = failureTimeout,
): Promise<value> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(getMessage())), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}

async function removeFixture(fixturePath: string): Promise<void> {
  await fs.rm(fixturePath, {
    force: true,
    maxRetries: process.platform === 'win32' ? 5 : 0,
    recursive: true,
    retryDelay: 100,
  })
}

function startFixtureServer(cwd: string, options: { env?: Record<string, string> } = {}) {
  // pnpm's binary shims set NODE_PATH to the workspace virtual store, which lets
  // CJS resolution find workspace packages that the fixture app cannot import via ESM.
  let { NODE_PATH: _nodePath, ...env } = process.env
  let child = spawn(process.execPath, ['dev.ts'], {
    cwd,
    env: {
      ...env,
      ...options.env,
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let readyEvents: Array<{ pid: number; port: number }> = []
  let runnerReadyUrl: string | undefined
  let hmrUrlEvents: Array<{ pid: number; url: string }> = []
  let outputListeners = new Set<() => void>()
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
        continue
      }

      let hmrUrlEvent = parseUrlEvent(line, 'hmr-url')
      if (hmrUrlEvent !== null) {
        hmrUrlEvents.push(hmrUrlEvent)
        continue
      }

      runnerReadyUrl ??= parseUrlEvent(line, 'runner-ready-url')?.url
    }

    notifyOutputListeners()
  })

  child.stderr?.setEncoding('utf-8')
  child.stderr?.on('data', (chunk: string) => {
    processOutput += chunk
    notifyOutputListeners()
  })

  child.once('exit', (code, signal) => {
    exit = { code, signal }
    notifyOutputListeners()
  })

  function notifyOutputListeners() {
    for (let listener of outputListeners) listener()
  }

  // Resolves as soon as the fixture's output satisfies `check`.
  function waitUntil(check: () => boolean, getTimeoutMessage: () => string, timeoutMs?: number) {
    let { promise, resolve } = Promise.withResolvers<void>()
    let listener = () => check() && resolve()
    outputListeners.add(listener)
    listener()
    return withFailureBound(promise, getTimeoutMessage, timeoutMs).finally(() =>
      outputListeners.delete(listener),
    )
  }

  return {
    pid: child.pid,
    waitUntil,

    get readyCount() {
      return readyEvents.length
    },

    get output() {
      return processOutput
    },

    async waitForReady(index: number) {
      await waitUntil(
        () => readyEvents[index] !== undefined,
        () => {
          let exitText = exit
            ? ` Process exited with code ${exit.code} and signal ${exit.signal}.`
            : ''
          return `Timed out waiting for fixture server.${exitText}\n${processOutput}`
        },
        fixtureServerReadyTimeout,
      )
      return readyEvents[index]
    },

    async waitForHmrUrl(index: number) {
      await waitUntil(
        () => hmrUrlEvents[index] !== undefined,
        () => {
          let exitText = exit
            ? ` Process exited with code ${exit.code} and signal ${exit.signal}.`
            : ''
          return `Timed out waiting for fixture HMR URL.${exitText}\n${processOutput}`
        },
        fixtureServerReadyTimeout,
      )
      return hmrUrlEvents[index]
    },

    // Asks the fixture's dev process to await `runner.ready()`, which it does before responding.
    async waitForRunnerReady() {
      await waitUntil(
        () => runnerReadyUrl !== undefined,
        () => `Timed out waiting for the runner readiness URL.\n${processOutput}`,
      )
      let response = await withFailureBound(
        fetch(runnerReadyUrl!, { headers: { Connection: 'close' } }),
        () => `Timed out waiting for runner.ready().\n${processOutput}`,
      )
      assert.equal(await response.text(), 'ready')
    },

    async stop() {
      await stopProcess(child)
    },
  }
}

async function fetchText(port: number, pathname = '/'): Promise<string> {
  // Fixture processes may exit between requests; do not reuse their sockets.
  let response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    headers: { Connection: 'close' },
  })
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

function parseReadyEvent(line: string): { pid: number; port: number } | null {
  try {
    let event: unknown = JSON.parse(line)
    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      (event.type === 'ready' || event.type === 'proxy-ready') &&
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

function parseUrlEvent(
  line: string,
  type: 'hmr-url' | 'runner-ready-url',
): { pid: number; url: string } | null {
  try {
    let event: unknown = JSON.parse(line)
    if (
      isRecord(event) &&
      event.type === type &&
      typeof event.url === 'string' &&
      typeof event.pid === 'number'
    ) {
      return { pid: event.pid, url: event.url }
    }
  } catch {
    // Ignore non-JSON process output.
  }

  return null
}

async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return

  if (isWindows && child.pid !== undefined) {
    // Windows does not run SIGTERM handlers, so stop the child server as well as its parent.
    await Promise.all([
      once(child, 'exit'),
      promisify(execFile)('taskkill', ['/pid', String(child.pid), '/T', '/F']),
    ])
    return
  }

  await new Promise<void>((resolve) => {
    // The HMR runner gives its child five seconds to exit before force-killing it.
    // Keep the fixture parent alive long enough to reap that child first.
    let timeout = setTimeout(() => {
      child.kill('SIGKILL')
    }, 10_000)

    let complete = () => {
      clearTimeout(timeout)
      resolve()
    }

    child.once('exit', complete)

    if (child.exitCode !== null || child.signalCode !== null) {
      complete()
      return
    }

    child.kill('SIGTERM')
  })
}
