import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createTestRouter } from '../../../test/helpers.ts'
import { db } from '../../data/db.ts'
import { families, presentationsByFamily } from '../../data/schema.ts'
import { getSpecColumns } from '../../data/specs.ts'
import { getFilterHref, loadFamilyFilters } from './family-filters.ts'

await createTestRouter()

async function loadSpurGearFilters(search: string) {
  let family = await db.findOne(families, {
    where: { slug: 'spur-gears' },
    with: { presentations: presentationsByFamily },
  })
  assert.ok(family)

  return loadFamilyFilters(
    db,
    family,
    family.presentations,
    getSpecColumns(family),
    new URLSearchParams(search),
  )
}

describe('loadFamilyFilters', () => {
  it('lists every option in catalog order with its part count', async () => {
    let { filters, selection } = await loadSpurGearFilters('')

    assert.deepEqual(
      filters.map((filter) => filter.param),
      ['material-and-style', 'pitch', 'number-of-teeth', 'pressure-angle', 'sold-as'],
    )
    assert.deepEqual(filters[1].options[0], {
      value: '64',
      label: '64',
      count: 1920,
      selected: false,
    })
    assert.equal(filters[1].options[11].value, '4')
    assert.deepEqual(selection, { presentationId: null, specs: {} })
  })

  it('counts each option against the other active filters', async () => {
    let { filters, matchCounts } = await loadSpurGearFilters('material-and-style=brass&pitch=32')

    let brass = filters[0].options.find((option) => option.value === 'brass')
    let pitch32 = filters[1].options.find((option) => option.value === '32')

    assert.deepEqual(brass, { value: 'brass', label: 'Brass', count: 240, selected: true })
    assert.equal(pitch32?.count, 240)
    assert.equal(filters[1].options[0].count, 240)
    assert.equal(filters[2].options[0].count, 4)
    assert.equal(
      [...matchCounts.values()].every((count) => count === 240),
      true,
    )
  })

  it('ignores values the family does not offer', async () => {
    let { selection, filters } = await loadSpurGearFilters(
      'material-and-style=gold&pitch=7&pressure-angle=20%C2%B0',
    )

    assert.deepEqual(selection, { presentationId: null, specs: { spec_3: '20°' } })
    assert.equal(filters[1].options[0].count, 960)
  })
})

describe('getFilterHref', () => {
  it('adds a filter while keeping the others', () => {
    let url = new URL('https://supply.example/products/gears/spur-gears?pitch=32')

    assert.equal(
      getFilterHref(url, 'material-and-style', 'brass'),
      '/products/gears/spur-gears?pitch=32&material-and-style=brass',
    )
  })

  it('removes a filter', () => {
    let url = new URL('https://supply.example/products/gears/spur-gears?pitch=32')

    assert.equal(getFilterHref(url, 'pitch', null), '/products/gears/spur-gears')
  })
})
