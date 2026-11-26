import * as assert from 'remix/assert'
import { createElement } from 'remix/component'
import { renderToString } from 'remix/component/server'
import { describe, it } from 'remix/test'

import { albumCoverTransition, transitionAlbumPage } from './album-transitions.ts'

describe('album transitions', () => {
  it('selects the incoming cover for push and replace navigations', async () => {
    let fixture = setup()
    await transitionAlbumPage(fixture.commit, {
      ...fixture.options,
      faceoutAlbumId: '1',
      cardAlbumId: '11',
    })
    await transitionAlbumPage(fixture.commit, {
      ...fixture.options,
      navigationType: 'replace',
      faceoutAlbumId: '11',
      cardAlbumId: '13',
    })
    assert.deepEqual(
      fixture.transitions.map((transition) => [...transition.types]),
      [['album-cover-11'], ['album-cover-13']],
    )
    assert.ok(fixture.updates.every((update) => update === fixture.commit))
    assert.equal(fixture.commits, 2)
  })

  it('returns the outgoing faceout on Back even when the destination has another cover', async () => {
    let fixture = setup()
    await transitionAlbumPage(fixture.commit, {
      ...fixture.options,
      navigationType: 'traverse',
      fromIndex: 1,
      currentIndex: 0,
      faceoutAlbumId: '11',
      cardAlbumId: '1',
    })
    assert.deepEqual([...fixture.transitions[0].types], ['album-cover-11'])
  })

  it('opens the incoming cover on Forward and treats missing history indices as ordinary navigation', async () => {
    let fixture = setup()
    await transitionAlbumPage(fixture.commit, {
      ...fixture.options,
      navigationType: 'traverse',
      fromIndex: 0,
      currentIndex: 1,
      faceoutAlbumId: '1',
      cardAlbumId: '11',
    })
    await transitionAlbumPage(fixture.commit, {
      ...fixture.options,
      navigationType: 'traverse',
      faceoutAlbumId: '1',
      cardAlbumId: '11',
    })
    assert.ok(fixture.transitions.every((transition) => transition.types.has('album-cover-11')))
  })

  it('uses the available cover when the preferred side is missing and cross-fades without covers', async () => {
    let fixture = setup()
    await transitionAlbumPage(fixture.commit, { ...fixture.options, faceoutAlbumId: '11' })
    await transitionAlbumPage(fixture.commit, {
      ...fixture.options,
      navigationType: 'traverse',
      fromIndex: 1,
      currentIndex: 0,
      cardAlbumId: '11',
    })
    await transitionAlbumPage(fixture.commit, fixture.options)
    assert.deepEqual(
      fixture.transitions.map((transition) => [...transition.types]),
      [['album-cover-11'], ['album-cover-11'], []],
    )
  })

  it('commits frame loads, mutations, and reloads without starting page transitions', async () => {
    let fixture = setup()
    await transitionAlbumPage(fixture.commit, { ...fixture.options, target: 'cart-button-1' })
    await transitionAlbumPage(fixture.commit, { ...fixture.options, navigationType: undefined })
    await transitionAlbumPage(fixture.commit, { ...fixture.options, navigationType: 'reload' })
    assert.equal(fixture.commits, 3)
    assert.equal(fixture.transitions.length, 0)
  })

  it('commits directly for reduced motion, unsupported browsers, and aborted navigations', async () => {
    let fixture = setup()
    await transitionAlbumPage(fixture.commit, { ...fixture.options, reducedMotion: true })
    await transitionAlbumPage(fixture.commit, {
      ...fixture.options,
      startViewTransition: undefined,
    })
    fixture.controller.abort()
    await transitionAlbumPage(fixture.commit, fixture.options)
    assert.equal(fixture.commits, 3)
    assert.equal(fixture.transitions.length, 0)
  })

  it('skips an active transition on abort and removes its listener after completion', async () => {
    let fixture = setup()
    let rendered = Promise.withResolvers<void>()
    let finished = Promise.withResolvers<void>()
    let startViewTransition = (update: () => Promise<void>) => {
      let transition = fixture.options.startViewTransition(update)
      rendered.resolve(transition.updateCallbackDone)
      return { ...transition, finished: finished.promise }
    }
    let pending = transitionAlbumPage(fixture.commit, { ...fixture.options, startViewTransition })
    await rendered.promise
    fixture.controller.abort()
    assert.equal(fixture.skips, 1)
    finished.resolve()
    await pending

    let completed = setup()
    await transitionAlbumPage(completed.commit, completed.options)
    completed.controller.abort()
    assert.equal(completed.skips, 0)
  })

  it('scopes cover names to the selected transition type', async () => {
    let html = await renderToString(createElement('img', { mix: albumCoverTransition(11) }))
    assert.match(html, /:root:active-view-transition-type\(album-cover-11\)/)
    assert.match(html, /view-transition-name:\s*album-cover-11/)
    assert.match(html, /view-transition-class:\s*album-cover/)
  })
})

function setup() {
  let controller = new AbortController()
  let commits = 0
  let skips = 0
  let transitions: ViewTransition[] = []
  let updates: Array<() => Promise<void>> = []
  async function commit() {
    commits++
  }
  return {
    controller,
    commit,
    transitions,
    updates,
    get commits() {
      return commits
    },
    get skips() {
      return skips
    },
    options: {
      navigationType: 'push' as const,
      reducedMotion: false,
      signal: controller.signal,
      startViewTransition(update: () => Promise<void>): ViewTransition {
        updates.push(update)
        let committed = Promise.resolve().then(update)
        let transition = {
          types: new Set<string>(),
          ready: committed,
          updateCallbackDone: committed,
          finished: committed,
          skipTransition() {
            skips++
          },
        }
        transitions.push(transition)
        return transition
      },
    },
  }
}
