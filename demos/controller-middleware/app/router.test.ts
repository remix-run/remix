import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { router } from './router.ts'
import { routes } from './routes.ts'

describe('controller middleware', () => {
  it('runs root controller middleware for a root action', async () => {
    let response = await router.fetch(`http://localhost${routes.home.href()}`)

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      route: 'home',
      params: {},
      trace: ['router middleware', 'root controller middleware', 'home action'],
    })
  })

  it('runs project controller middleware for the project index', async () => {
    let response = await router.fetch(`http://localhost${routes.projects.index.href()}`)

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      route: 'projects.index',
      params: {},
      trace: [
        'router middleware',
        'projects mount middleware',
        'projects controller middleware',
        'projects.index action',
      ],
    })
  })

  it('runs project mount middleware for an action in a nested controller', async () => {
    let response = await router.fetch(
      `http://localhost${routes.projects.activity.index.href({ projectId: 'alpha' })}`,
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      route: 'projects.activity.index',
      params: { projectId: 'alpha' },
      trace: [
        'router middleware',
        'projects mount middleware',
        'activity controller middleware',
        'projects.activity.index action',
      ],
    })
  })
})
