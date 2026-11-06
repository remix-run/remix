import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createTestRouter } from '../../test/helpers.ts'
import { catalog, type FamilyDefinition } from './catalog.ts'
import { db } from './db.ts'
import { families, parts, presentations, sections } from './schema.ts'
import { generateParts } from './setup.ts'
import { toParam } from './specs.ts'

const family: FamilyDefinition = {
  slug: 'test-screws',
  name: 'Test Screws',
  description: 'Screws for tests.',
  photo: 'test screws',
  presentationLabel: 'Material',
  presentations: [
    { name: 'Steel', description: 'Steel screws.', photo: 'steel screws' },
    { name: 'Brass', description: 'Brass screws.', photo: 'brass screws' },
  ],
  specs: [
    { name: 'Thread Size', values: ['#4-40', '#6-32'] },
    { name: 'Length', values: ['1/4"', '1/2"', '1"'] },
  ],
  packQuantities: [1, 10],
  basePrice: 1,
}

describe('generateParts', () => {
  it('creates a part for every presentation, spec combination, and pack size', () => {
    let generated = generateParts(family)

    assert.equal(generated.length, 2 * 2 * 3 * 2)
    assert.deepEqual(generated[0].specValues, ['#4-40', '1/4"', 'Each'])
    assert.deepEqual(generated[1].specValues, ['#4-40', '1/4"', 'Pack of 10'])
    assert.equal(generated[12].presentationIndex, 1)
  })

  it('gives each presentation its own part number series', () => {
    let generated = generateParts(family)

    assert.equal(generated[0].partNumber, '1000A001')
    assert.equal(generated[11].partNumber, '1000A012')
    assert.equal(generated[12].partNumber, '1389A001')
  })

  it('prices packs and larger sizes higher', () => {
    let generated = generateParts(family)

    assert.equal(generated[0].price, 1)
    assert.ok(generated[1].price > generated[0].price)
    assert.ok(generated[10].price > generated[0].price)
  })
})

describe('catalog', () => {
  it('uses distinct filter params within each family', () => {
    let collisions = catalog
      .flatMap((section) => section.categories)
      .flatMap((category) => category.families)
      .filter((definition) => {
        let params = [definition.presentationLabel, ...definition.specs.map((spec) => spec.name)]
        return new Set(params.map(toParam)).size !== params.length
      })
      .map((definition) => definition.slug)

    assert.deepEqual(collisions, [])
  })
})

describe('seedCatalog', () => {
  it('fills the catalog with about as many parts as McMaster-Carr', async () => {
    await createTestRouter()

    assert.equal(await db.count(sections), 6)
    assert.equal(await db.count(families), 22)
    assert.equal(await db.count(presentations), 193)
    assert.equal(await db.count(parts), 594_502)
  })

  it('stores each family’s part count and lowest price', async () => {
    await createTestRouter()
    let screws = await db.findOne(families, { where: { slug: 'socket-head-screws' } })

    assert.equal(screws?.part_count, 83_520)
    assert.equal(
      screws?.spec_names,
      JSON.stringify(['Thread Size', 'Length', 'Threading', 'Sold As']),
    )
    assert.equal(screws?.lowest_price, 1.08)
  })
})
