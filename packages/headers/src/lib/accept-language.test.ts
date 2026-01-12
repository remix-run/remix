import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { AcceptLanguage } from './accept-language.ts'

describe('Accept-Language', () => {
  it('initializes with an empty string', () => {
    let header = new AcceptLanguage('')
    assert.equal(header.size, 0)
  })

  it('initializes with a string', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9')
    assert.equal(header.size, 2)
  })

  it('initializes with an array', () => {
    let header = new AcceptLanguage(['en-US', ['en', 0.9]])
    assert.equal(header.size, 2)
  })

  it('initializes with an object', () => {
    let header = new AcceptLanguage({ 'en-US': 1, en: 0.9 })
    assert.equal(header.size, 2)
  })

  it('initializes with another AcceptLanguage', () => {
    let header = new AcceptLanguage(new AcceptLanguage('en-US,en;q=0.9'))
    assert.equal(header.size, 2)
  })

  it('handles whitespace in initial value', () => {
    let header = new AcceptLanguage(' en-US ,  en;q=  0.9  ')
    assert.equal(header.size, 2)
  })

  it('gets all languages', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9')
    assert.deepEqual(header.languages, ['en-us', 'en'])
  })

  it('gets all weights', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9')
    assert.deepEqual(header.weights, [1, 0.9])
  })

  it('checks if a language is acceptable', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9,fr;q=0.8')
    assert.equal(header.accepts('en-US'), true)
    assert.equal(header.accepts('en'), true)
    assert.equal(header.accepts('en-GB'), true)
    assert.equal(header.accepts('fr'), true)
    assert.equal(header.accepts('fi'), false)
  })

  it('gets the correct weight values', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9,fr;q=0.8')
    assert.equal(header.getWeight('en-US'), 1)
    assert.equal(header.getWeight('*'), 1)
    assert.equal(header.getWeight('en'), 1)
    assert.equal(header.getWeight('en-GB'), 0.9)
    assert.equal(header.getWeight('fr'), 0.8)
    assert.equal(header.getWeight('fi'), 0)
  })

  it('gets the preferred language', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9')
    assert.equal(header.getPreferred(['en-GB', 'en-US']), 'en-US')
    assert.equal(header.getPreferred(['en-GB', 'en']), 'en')
    assert.equal(header.getPreferred(['fr', 'en-GB']), 'en-GB')
    assert.equal(header.getPreferred(['fi', 'ja']), null)
  })

  it('sets and gets languages', () => {
    let header = new AcceptLanguage()
    header.set('en', 0.9)
    assert.equal(header.get('en'), 0.9)
  })

  it('deletes languages', () => {
    let header = new AcceptLanguage('en-US')
    assert.equal(header.has('en-US'), true)
    header.delete('en-US')
    assert.equal(header.has('en-US'), false)
  })

  it('clears all languages', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9')
    assert.equal(header.size, 2)
    header.clear()
    assert.equal(header.size, 0)
  })

  it('iterates over entries', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9')
    let entries = Array.from(header.entries())
    assert.deepEqual(entries, [
      ['en-us', 1],
      ['en', 0.9],
    ])
  })

  it('is directly iterable', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9')
    let entries = Array.from(header)
    assert.deepEqual(entries, [
      ['en-us', 1],
      ['en', 0.9],
    ])
  })

  it('uses forEach correctly', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9')
    let result: [string, number][] = []
    header.forEach((language, weight) => {
      result.push([language, weight])
    })
    assert.deepEqual(result, [
      ['en-us', 1],
      ['en', 0.9],
    ])
  })

  it('returns correct size', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9')
    assert.equal(header.size, 2)
  })

  it('converts to string', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9')
    assert.equal(header.toString(), 'en-us,en;q=0.9')
  })

  it('handles setting empty weight values', () => {
    let header = new AcceptLanguage()
    header.set('en-US')
    assert.equal(header.get('en-US'), 1)
  })

  it('overwrites existing weight values', () => {
    let header = new AcceptLanguage('en;q=0.9')
    header.set('en', 1)
    assert.equal(header.get('en'), 1)
  })

  it('handles setting wildcard value', () => {
    let header = new AcceptLanguage()
    header.set('*')
    assert.equal(header.get('*'), 1)
  })

  it('sorts initial value', () => {
    let header = new AcceptLanguage('en;q=0.9,en-US')
    assert.equal(header.toString(), 'en-us,en;q=0.9')
  })

  it('sorts updated value', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9')
    header.set('fi')
    assert.equal(header.toString(), 'en-us,fi,en;q=0.9')
    header.set('en-US', 0.8)
    assert.equal(header.toString(), 'fi,en;q=0.9,en-us;q=0.8')
  })
})

describe('AcceptLanguage.from', () => {
  it('parses a string value', () => {
    let result = AcceptLanguage.from('en-US, en;q=0.9')
    assert.ok(result instanceof AcceptLanguage)
    assert.equal(result.size, 2)
  })
})
