import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { inferForeignKey, singularize } from './inflection.ts'

describe('singularize', () => {
  it('handles irregular forms', () => {
    assert.equal(singularize('people'), 'person')
    assert.equal(singularize('children'), 'child')
    assert.equal(singularize('indices'), 'index')
  })

  it('applies suffix rules', () => {
    assert.equal(singularize('categories'), 'category')
    assert.equal(singularize('parties'), 'party')
    assert.equal(singularize('addresses'), 'address')
    assert.equal(singularize('brushes'), 'brush')
    assert.equal(singularize('matches'), 'match')
    assert.equal(singularize('boxes'), 'box')
    assert.equal(singularize('statuses'), 'status')
    assert.equal(singularize('projects'), 'project')
    assert.equal(singularize('class'), 'class')
  })

  it('preserves leading capitalization', () => {
    assert.equal(singularize('People'), 'Person')
    assert.equal(singularize('Categories'), 'Category')
  })

  it('preserves empty words', () => {
    assert.equal(singularize(''), '')
  })
})

describe('inferForeignKey', () => {
  it('infers single-segment table names', () => {
    assert.equal(inferForeignKey('accounts'), 'account_id')
    assert.equal(inferForeignKey('people'), 'person_id')
  })

  it('infers snake_case table names by singularizing the final segment', () => {
    assert.equal(inferForeignKey('company_accounts'), 'company_account_id')
    assert.equal(inferForeignKey('admin_people'), 'admin_person_id')
  })
})
