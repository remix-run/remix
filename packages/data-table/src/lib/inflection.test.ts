import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { inferForeignKey, inferTableName, pluralize, singularize } from './inflection.ts'

describe('pluralize', () => {
  it('handles irregular forms', () => {
    assert.equal(pluralize('person'), 'people')
    assert.equal(pluralize('child'), 'children')
    assert.equal(pluralize('analysis'), 'analyses')
  })

  it('applies suffix rules', () => {
    assert.equal(pluralize('category'), 'categories')
    assert.equal(pluralize('box'), 'boxes')
    assert.equal(pluralize('status'), 'statuses')
    assert.equal(pluralize('project'), 'projects')
  })

  it('preserves leading capitalization', () => {
    assert.equal(pluralize('Person'), 'People')
    assert.equal(pluralize('Category'), 'Categories')
  })
})

describe('singularize', () => {
  it('handles irregular forms', () => {
    assert.equal(singularize('people'), 'person')
    assert.equal(singularize('children'), 'child')
    assert.equal(singularize('indices'), 'index')
  })

  it('applies suffix rules', () => {
    assert.equal(singularize('categories'), 'category')
    assert.equal(singularize('addresses'), 'address')
    assert.equal(singularize('boxes'), 'box')
    assert.equal(singularize('statuses'), 'status')
    assert.equal(singularize('projects'), 'project')
    assert.equal(singularize('class'), 'class')
  })

  it('preserves leading capitalization', () => {
    assert.equal(singularize('People'), 'Person')
    assert.equal(singularize('Categories'), 'Category')
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

  it('normalizes camelCase and PascalCase inputs to snake_case', () => {
    assert.equal(inferForeignKey('orderItems'), 'order_item_id')
    assert.equal(inferForeignKey('OrderItems'), 'order_item_id')
    assert.equal(inferForeignKey('PasswordResetTokens'), 'password_reset_token_id')
  })

  it('normalizes spaced and kebab-case inputs', () => {
    assert.equal(inferForeignKey('order items'), 'order_item_id')
    assert.equal(inferForeignKey('order-items'), 'order_item_id')
  })
})

describe('inferTableName', () => {
  it('infers plural table names from singular names', () => {
    assert.equal(inferTableName('user'), 'users')
    assert.equal(inferTableName('category'), 'categories')
    assert.equal(inferTableName('person'), 'people')
  })

  it('normalizes camelCase and PascalCase inputs to snake_case', () => {
    assert.equal(inferTableName('orderItem'), 'order_items')
    assert.equal(inferTableName('OrderItem'), 'order_items')
    assert.equal(inferTableName('PasswordResetToken'), 'password_reset_tokens')
  })

  it('normalizes spaced and kebab-case inputs', () => {
    assert.equal(inferTableName('order item'), 'order_items')
    assert.equal(inferTableName('order-item'), 'order_items')
  })
})
