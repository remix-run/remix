import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { pluralize } from './pluralize.ts'

describe('pluralize', () => {
  it('handles invariant plurals (uncountables)', () => {
    assert.equal(pluralize('sheep'), 'sheep')
    assert.equal(pluralize('fish'), 'fish')
    assert.equal(pluralize('series'), 'series')
    assert.equal(pluralize('species'), 'species')
    assert.equal(pluralize('equipment'), 'equipment')
    assert.equal(pluralize('information'), 'information')
    assert.equal(pluralize('money'), 'money')
    assert.equal(pluralize('news'), 'news')
  })

  it('handles irregular plurals', () => {
    assert.equal(pluralize('person'), 'people')
    assert.equal(pluralize('man'), 'men')
    assert.equal(pluralize('woman'), 'women')
    assert.equal(pluralize('child'), 'children')
    assert.equal(pluralize('mouse'), 'mice')
    assert.equal(pluralize('goose'), 'geese')
    assert.equal(pluralize('foot'), 'feet')
    assert.equal(pluralize('tooth'), 'teeth')
    assert.equal(pluralize('ox'), 'oxen')
    assert.equal(pluralize('analysis'), 'analyses')
    assert.equal(pluralize('axis'), 'axes')
    assert.equal(pluralize('crisis'), 'crises')
    assert.equal(pluralize('thesis'), 'theses')
    assert.equal(pluralize('phenomenon'), 'phenomena')
    assert.equal(pluralize('criterion'), 'criteria')
    assert.equal(pluralize('datum'), 'data')
    assert.equal(pluralize('medium'), 'media')
    assert.equal(pluralize('index'), 'indexes')
    assert.equal(pluralize('matrix'), 'matrices')
    assert.equal(pluralize('quiz'), 'quizzes')
  })

  it('adds es for words ending with s/x/z/ch/sh', () => {
    assert.equal(pluralize('class'), 'classes')
    assert.equal(pluralize('box'), 'boxes')
    assert.equal(pluralize('buzz'), 'buzzes')
    assert.equal(pluralize('match'), 'matches')
    assert.equal(pluralize('bush'), 'bushes')
  })

  it('handles words ending with f/fe → ves', () => {
    assert.equal(pluralize('leaf'), 'leaves')
    assert.equal(pluralize('knife'), 'knives')
  })

  it('adds es for selected -o words', () => {
    assert.equal(pluralize('hero'), 'heroes')
    assert.equal(pluralize('potato'), 'potatoes')
    assert.equal(pluralize('tomato'), 'tomatoes')
    assert.equal(pluralize('echo'), 'echoes')
    assert.equal(pluralize('mosquito'), 'mosquitoes')
    assert.equal(pluralize('veto'), 'vetoes')
    assert.equal(pluralize('torpedo'), 'torpedoes')
  })

  it('handles consonant + y → ies', () => {
    assert.equal(pluralize('category'), 'categories')
    assert.equal(pluralize('city'), 'cities')
    assert.equal(pluralize('baby'), 'babies')
  })

  it('handles vowel + y → s', () => {
    assert.equal(pluralize('toy'), 'toys')
    assert.equal(pluralize('key'), 'keys')
    assert.equal(pluralize('day'), 'days')
  })

  it('pluralizes words that end with s when singular requires es', () => {
    assert.equal(pluralize('class'), 'classes')
    assert.equal(pluralize('bus'), 'buses')
  })

  it('preserves original casing in simple cases', () => {
    assert.equal(pluralize('User'), 'Users')
    assert.equal(pluralize('Category'), 'Categories')
    assert.equal(pluralize('BOX'), 'BOXes')
    assert.equal(pluralize('Hero'), 'Heroes')
  })
})
