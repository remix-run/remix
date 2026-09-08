import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it } from '@remix-run/test'
import type { Handle } from '../runtime/component.ts'
import { Frame } from '../runtime/component.ts'
import { clientEntry } from '../runtime/client-entries.ts'
import { getNamedFrame, run } from '../runtime/run.ts'
import { invariant } from '../runtime/invariant.ts'
import { renderToStream } from '../server/stream.ts'
import { css } from '../index.ts'
import { drain } from './utils.ts'

describe('frame css style ownership', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    for (let node of Array.from(document.head.childNodes)) {
      document.head.removeChild(node)
    }
  })

  it('keeps a sibling frame styled after the first frame reloads away from a shared style', async () => {
    // Two sibling frames render content that uses the same css() style. Each
    // frame owns its style rules independently on the client (per-frame
    // refcounted adoption), so the server response for each frame must carry
    // the full set of style tags that frame's content needs — deduping a tag
    // because a sibling already emitted it hands ownership of the rule to the
    // sibling, and the rule disappears for everyone when that sibling reloads
    // away from it.
    let sharedStyle = css({ color: 'rgb(11, 22, 33)' })

    let reloadFrameA: undefined | ((src: string) => Promise<unknown>)
    let ATrigger = clientEntry('/js/a-trigger.js#ATrigger', function ATrigger(handle: Handle) {
      reloadFrameA = (src: string) => {
        handle.frame.src = src
        return handle.frame.reload()
      }
      return () => <button id="a-trigger">A</button>
    })

    async function renderFrameA() {
      return await drain(
        renderToStream(
          <div>
            <div id="a-shared" mix={[sharedStyle]}>
              A
            </div>
            <ATrigger />
          </div>,
        ),
      )
    }

    async function renderFrameA2() {
      return await drain(renderToStream(<div id="a-plain">A2</div>))
    }

    async function renderFrameB() {
      return await drain(
        renderToStream(
          <div id="b-shared" mix={[sharedStyle]}>
            B
          </div>,
        ),
      )
    }

    // Frame A resolves first so its template claims the shared style tag if
    // the server dedupes; frame B resolves on a later tick.
    let serverResolveFrame = async (src: string) => {
      if (src === '/a') return await renderFrameA()
      if (src === '/b') {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return await renderFrameB()
      }
      throw new Error(`Unexpected frame src: ${src}`)
    }

    let html = await drain(
      renderToStream(
        <main>
          <Frame name="a" src="/a" fallback={<div>Loading a…</div>} />
          <Frame name="b" src="/b" fallback={<div>Loading b…</div>} />
        </main>,
        { resolveFrame: serverResolveFrame },
      ),
    )

    document.body.innerHTML = html

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/a-trigger.js' && exportName === 'ATrigger') return ATrigger
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === '/a2') return await renderFrameA2()
        if (src === '/a') return await renderFrameA()
        if (src === '/b') return await renderFrameB()
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()
    await new Promise((resolve) => setTimeout(resolve, 20))

    let aDiv = document.getElementById('a-shared')
    let bDiv = document.getElementById('b-shared')
    invariant(aDiv, 'expected frame a content')
    invariant(bDiv, 'expected frame b content')

    expect('initial-a:' + getComputedStyle(aDiv).color).toBe('initial-a:rgb(11, 22, 33)')
    expect('initial-b:' + getComputedStyle(bDiv).color).toBe('initial-b:rgb(11, 22, 33)')

    // Reload frame A to content that no longer uses the shared style.
    invariant(reloadFrameA, 'expected ATrigger to hydrate')
    await reloadFrameA('/a2')
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(document.getElementById('a-plain')).not.toBeNull()
    expect(document.getElementById('a-shared')).toBeNull()

    // Frame B never reloaded — its DOM still carries the shared class, so the
    // rule must survive frame A dropping it.
    let bDivAfter = document.getElementById('b-shared')
    invariant(bDivAfter, 'expected frame b content to be preserved')
    expect('after-reload-b:' + getComputedStyle(bDivAfter).color).toBe(
      'after-reload-b:rgb(11, 22, 33)',
    )

    app.dispose()
  })

  it('does not accumulate rules when a frame reloads with unchanged styles', async () => {
    // Adoption is idempotent: the registry is keyed by content hash, so
    // reloading a frame whose styles have not changed re-adopts the same
    // selectors as no-ops instead of growing the stylesheet.
    let style = css({ color: 'rgb(44, 55, 66)' })

    async function renderFrame() {
      return await drain(
        renderToStream(
          <div id="stable" mix={[style]}>
            Stable
          </div>,
        ),
      )
    }

    let html = await drain(
      renderToStream(
        <main>
          <Frame name="stable" src="/stable" fallback={<div>Loading…</div>} />
        </main>,
        { resolveFrame: renderFrame },
      ),
    )
    document.body.innerHTML = html

    let app = run({
      loadModule() {
        throw new Error('Unexpected module load')
      },
      resolveFrame: renderFrame,
    })

    await app.ready()
    await new Promise((resolve) => setTimeout(resolve, 10))

    function countTotalRules(): number {
      return Array.from(document.adoptedStyleSheets).reduce(
        (count, sheet) => count + sheet.cssRules.length,
        0,
      )
    }

    let stableFrame = getNamedFrame('stable')
    expect(stableFrame.src).toBe('/stable')
    let reload = () => stableFrame.reload()
    await reload()
    await new Promise((resolve) => setTimeout(resolve, 10))
    let rulesAfterFirstReload = countTotalRules()

    await reload()
    await new Promise((resolve) => setTimeout(resolve, 10))
    await reload()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(countTotalRules()).toBe(rulesAfterFirstReload)

    let stable = document.getElementById('stable')
    invariant(stable, 'expected frame content')
    expect(getComputedStyle(stable).color).toBe('rgb(44, 55, 66)')

    app.dispose()
  })
})
