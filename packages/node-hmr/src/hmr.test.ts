import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const nodeTsxImportUrl = import.meta.resolve('@remix-run/node-tsx')

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
      assert.match(server.output, /hmr update message\.ts/)
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
      assert.equal(await fetchText(restarted.port), 'two')
      assert.match(server.output, /restart message\.ts/)
    } finally {
      await server.stop()
    }
  })

  it('hot updates transformed component modules without restarting the server', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': [
        `export function Greeting() {`,
        `  return () => 'Hello from component'`,
        `}`,
      ].join('\n'),
      ...getRemixUiRefreshFixtureFiles(),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'Hello from component')

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        [`export function Greeting() {`, `  return () => 'Updated from component'`, `}`].join('\n'),
      )

      await waitForResponse(ready.port, 'Updated from component', () => server.output)
      assert.equal(server.readyCount, 1)
      assert.match(server.output, /hmr update greeting\.tsx/)
    } finally {
      await server.stop()
    }
  })

  it('restarts once when transformed component module exports change', async () => {
    await using fixture = await createFixture({
      'server.ts': getPidServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': [
        `export function Greeting() {`,
        `  return () => 'Hello from component'`,
        `}`,
      ].join('\n'),
      ...getRemixUiRefreshFixtureFiles(),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from component`)

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        [
          `export function Greeting() {`,
          `  return () => 'Updated after restart'`,
          `}`,
          `export function AddedComponent() {`,
          `  return () => 'Added component'`,
          `}`,
        ].join('\n'),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      assert.equal(await fetchText(restarted.port), `${restarted.pid}:Updated after restart`)
      assert.match(server.output, /restart Updated component module added export "AddedComponent"/)
      assert.doesNotMatch(server.output, /Failed to hot update/)
      assert.equal(server.readyCount, 2)
    } finally {
      await server.stop()
    }
  })

  it('restarts once when a transformed component module adds a non-component export', async () => {
    await using fixture = await createFixture({
      'server.ts': getPidServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': [
        `export function Greeting() {`,
        `  return () => 'Hello from component'`,
        `}`,
      ].join('\n'),
      ...getRemixUiRefreshFixtureFiles(),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from component`)

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        [
          `export function Greeting() {`,
          `  return () => 'Updated after restart'`,
          `}`,
          `export const foo = true`,
        ].join('\n'),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      assert.equal(await fetchText(restarted.port), `${restarted.pid}:Updated after restart`)
      assert.match(server.output, /restart Updated component module added export "foo"/)
      assert.doesNotMatch(server.output, /Failed to hot update/)
      assert.equal(server.readyCount, 2)
    } finally {
      await server.stop()
    }
  })

  it('restarts once when a transformed component module removes a non-component export', async () => {
    await using fixture = await createFixture({
      'server.ts': getPidServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': [
        `export function Greeting() {`,
        `  return () => 'Hello from component'`,
        `}`,
        `export const foo = true`,
      ].join('\n'),
      ...getRemixUiRefreshFixtureFiles(),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from component`)

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        [`export function Greeting() {`, `  return () => 'Updated after restart'`, `}`].join('\n'),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      assert.equal(await fetchText(restarted.port), `${restarted.pid}:Updated after restart`)
      assert.match(server.output, /restart Updated component module removed export "foo"/)
      assert.doesNotMatch(server.output, /Failed to hot update/)
      assert.equal(server.readyCount, 2)
    } finally {
      await server.stop()
    }
  })

  it('restarts once when a transformed component module changes a non-component export', async () => {
    await using fixture = await createFixture({
      'server.ts': getPidServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': [
        `export function Greeting() {`,
        `  return () => 'Hello from component'`,
        `}`,
        `export const foo = true`,
      ].join('\n'),
      ...getRemixUiRefreshFixtureFiles(),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from component`)

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        [
          `export function Greeting() {`,
          `  return () => 'Updated after restart'`,
          `}`,
          `export const foo = false`,
        ].join('\n'),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      assert.equal(await fetchText(restarted.port), `${restarted.pid}:Updated after restart`)
      assert.match(
        server.output,
        /restart Updated component module changed non-component export "foo"/,
      )
      assert.doesNotMatch(server.output, /Failed to hot update/)
      assert.equal(server.readyCount, 2)
    } finally {
      await server.stop()
    }
  })

  it('hot updates transformed component modules when non-component exports are strictly equal', async () => {
    await using fixture = await createFixture({
      'server.ts': getPidServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': [
        `import { foo } from './stable.ts'`,
        ``,
        `export function Greeting() {`,
        `  return () => 'Hello from component'`,
        `}`,
        `export { foo }`,
      ].join('\n'),
      'stable.ts': `export const foo = {}`,
      ...getRemixUiRefreshFixtureFiles(),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from component`)

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        [
          `import { foo } from './stable.ts'`,
          ``,
          `export function Greeting() {`,
          `  return () => 'Updated from component'`,
          `}`,
          `export { foo }`,
        ].join('\n'),
      )

      await waitForResponse(ready.port, `${ready.pid}:Updated from component`, () => server.output)
      assert.equal(server.readyCount, 1)
      assert.match(server.output, /hmr update greeting\.tsx/)
      assert.doesNotMatch(server.output, /restart/)
    } finally {
      await server.stop()
    }
  })

  it('restarts once when a transformed component module recreates an object non-component export', async () => {
    await using fixture = await createFixture({
      'server.ts': getPidServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': [
        `export function Greeting() {`,
        `  return () => 'Hello from component'`,
        `}`,
        `export const foo = {}`,
      ].join('\n'),
      ...getRemixUiRefreshFixtureFiles(),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from component`)

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        [
          `export function Greeting() {`,
          `  return () => 'Updated after restart'`,
          `}`,
          `export const foo = {}`,
        ].join('\n'),
      )

      let restarted = await server.waitForReady(1)
      assert.notEqual(restarted.pid, ready.pid)
      assert.equal(await fetchText(restarted.port), `${restarted.pid}:Updated after restart`)
      assert.match(
        server.output,
        /restart Updated component module changed non-component export "foo"/,
      )
      assert.doesNotMatch(server.output, /Failed to hot update/)
      assert.equal(server.readyCount, 2)
    } finally {
      await server.stop()
    }
  })

  it('sends one readiness-gated server update when transformed component module exports change', async () => {
    await using fixture = await createFixture({
      'server.ts': getEventChannelComponentServerSource(),
      'greeting.tsx': [
        `export function Greeting() {`,
        `  return () => 'Hello from component'`,
        `}`,
      ].join('\n'),
      ...getRemixUiRefreshFixtureFiles(),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let hmrUrl = await server.waitForHmrUrl(0)
      let events = await connectHmrEvents(hmrUrl.url)
      try {
        let ready = await server.waitForReady(0)
        assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from component`)

        await fs.writeFile(
          path.join(fixture.path, 'greeting.tsx'),
          [
            `export function Greeting() {`,
            `  return () => 'Updated after restart'`,
            `}`,
            `export function AddedComponent() {`,
            `  return () => 'Added component'`,
            `}`,
          ].join('\n'),
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

  it('hot updates transformed component modules with a symlinked remix package', async () => {
    await using fixture = await createFixture({
      'server.ts': getPidServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': [
        `export function Greeting() {`,
        `  return () => 'Hello from component'`,
        `}`,
      ].join('\n'),
    })
    await writeSymlinkedRemixUiRefreshFixture(fixture.path)
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), `${ready.pid}:Hello from component`)

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        [`export function Greeting() {`, `  return () => 'Updated from component'`, `}`].join('\n'),
      )

      await waitForResponse(ready.port, `${ready.pid}:Updated from component`, () => server.output)
      assert.equal(server.readyCount, 1)
      assert.match(server.output, /hmr update greeting\.tsx/)
    } finally {
      await server.stop()
    }
  })

  it('hot updates transformed client entry components without restarting the server', async () => {
    await using fixture = await createFixture({
      'server.ts': getServerSource('./greeting.tsx', 'Greeting()()'),
      'greeting.tsx': [
        `function clientEntry(_id, component) {`,
        `  return component`,
        `}`,
        `export const Greeting = clientEntry(import.meta.url, function Greeting() {`,
        `  return () => 'Hello from client entry'`,
        `})`,
      ].join('\n'),
      ...getScopedUiRefreshFixtureFiles(),
    })
    let server = startFixtureServer(fixture.path)

    try {
      let ready = await server.waitForReady(0)
      assert.equal(await fetchText(ready.port), 'Hello from client entry')

      await fs.writeFile(
        path.join(fixture.path, 'greeting.tsx'),
        [
          `function clientEntry(_id, component) {`,
          `  return component`,
          `}`,
          `export const Greeting = clientEntry(import.meta.url, function Greeting() {`,
          `  return () => 'Updated client entry'`,
          `})`,
        ].join('\n'),
      )

      await waitForResponse(ready.port, 'Updated client entry', () => server.output)
      assert.equal(server.readyCount, 1)
      assert.match(server.output, /hmr update greeting\.tsx/)
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

        let payload = await events.read()
        assert.deepEqual(payload, { type: 'server:update' })

        let restarted = await server.waitForReady(1)
        assert.notEqual(restarted.pid, ready.pid)
        assert.equal(await fetchText(restarted.port), 'two!!!')
      } finally {
        await events.close()
      }
    } finally {
      await server.stop()
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

function getFixtureServerSource(importSpecifier: string, responseExpression: string): string {
  let nodeHmrRuntimeUrl = pathToFileURL(path.join(packageRoot, 'src/runtime.ts')).href

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
  let nodeHmrRuntimeUrl = pathToFileURL(path.join(packageRoot, 'src/runtime.ts')).href

  return [
    `import { createServer } from 'node:http'`,
    `import { browserEventController, emitServerReady } from ${JSON.stringify(nodeHmrRuntimeUrl)}`,
    ``,
    `console.log(JSON.stringify({ type: 'hmr-url', url: browserEventController?.url, pid: process.pid }))`,
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

function getEventChannelComponentServerSource(): string {
  let nodeHmrRuntimeUrl = pathToFileURL(path.join(packageRoot, 'src/runtime.ts')).href

  return [
    `import { createServer } from 'node:http'`,
    `import { browserEventController, emitServerReady } from ${JSON.stringify(nodeHmrRuntimeUrl)}`,
    `import { Greeting } from './greeting.tsx'`,
    ``,
    `console.log(JSON.stringify({ type: 'hmr-url', url: browserEventController?.url, pid: process.pid }))`,
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

function getScopedUiRefreshFixtureFiles(): Record<string, string> {
  return {
    'node_modules/@remix-run/ui/package.json': JSON.stringify({
      exports: {
        './dev/refresh': './src/dev-refresh.ts',
        './package.json': './package.json',
      },
      name: '@remix-run/ui',
      type: 'module',
    }),
    'node_modules/@remix-run/ui/src/dev-refresh.ts': [
      `export function reconcileRoots() {}`,
      `export function setComponentStalenessCheck(_check) {}`,
    ].join('\n'),
  }
}

async function writeSymlinkedRemixUiRefreshFixture(fixturePath: string): Promise<void> {
  let packagePath = path.join(fixturePath, 'linked/remix')
  await writeFixtureFiles(packagePath, getRemixUiRefreshPackageFiles())
  await fs.mkdir(path.join(fixturePath, 'node_modules'), { recursive: true })
  await fs.symlink(
    packagePath,
    path.join(fixturePath, 'node_modules/remix'),
    process.platform === 'win32' ? 'junction' : 'dir',
  )
}

function getRemixUiRefreshFixtureFiles(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(getRemixUiRefreshPackageFiles()).map(([filePath, contents]) => [
      `node_modules/remix/${filePath}`,
      contents,
    ]),
  )
}

function getRemixUiRefreshPackageFiles(): Record<string, string> {
  return {
    'package.json': JSON.stringify({
      exports: {
        './package.json': './package.json',
        './ui/dev/refresh': './ui/dev/refresh.ts',
      },
      name: 'remix',
      type: 'module',
    }),
    'ui/dev/refresh.ts': [
      `export function reconcileRoots() {}`,
      `export function setComponentStalenessCheck(_check) {}`,
    ].join('\n'),
  }
}

async function createFixture(
  files: Record<string, string>,
): Promise<AsyncDisposable & { entryPath: string; path: string }> {
  let fixtureRoot = path.join(packageRoot, '.tmp')
  await fs.mkdir(fixtureRoot, { recursive: true })

  let fixturePath = await fs.mkdtemp(path.join(fixtureRoot, 'node-hmr-'))
  let nodeHmrImportUrl = pathToFileURL(path.join(packageRoot, 'src/index.ts')).href
  await writeFixtureFiles(fixturePath, {
    ...files,
    'dev.ts': [
      `import { run } from ${JSON.stringify(nodeHmrImportUrl)}`,
      ``,
      `run('server.ts', {`,
      `  browserEventController: true,`,
      `  nodeArgs: ['--import', ${JSON.stringify(nodeTsxImportUrl)}],`,
      `})`,
    ].join('\n'),
  })

  return {
    entryPath: path.join(fixturePath, 'server.ts'),
    path: fixturePath,
    async [Symbol.asyncDispose]() {
      await fs.rm(fixturePath, { force: true, recursive: true })
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

async function waitForOutput(server: ReturnType<typeof startFixtureServer>, pattern: RegExp) {
  await waitFor(
    () => pattern.test(server.output),
    () => `Timed out waiting for output ${pattern}.\n${server.output}`,
  )
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

async function fetchText(port: number): Promise<string> {
  let response = await fetch(`http://127.0.0.1:${port}`)
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
