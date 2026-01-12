import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Accept } from './accept.ts'

describe('Accept', () => {
  it('initializes with an empty string', () => {
    let header = new Accept('')
    assert.equal(header.size, 0)
  })

  it('initializes with a string', () => {
    let header = new Accept('text/html,application/json;q=0.9')
    assert.equal(header.size, 2)
  })

  it('initializes with an array', () => {
    let header = new Accept(['text/html', ['application/json', 0.9]])
    assert.equal(header.size, 2)
  })

  it('initializes with an object', () => {
    let header = new Accept({ 'text/html': 1, 'application/json': 0.9 })
    assert.equal(header.size, 2)
  })

  it('initializes with another Accept', () => {
    let header = new Accept(new Accept('text/html,application/json;q=0.9'))
    assert.equal(header.size, 2)
  })

  it('handles whitespace in initial value', () => {
    let header = new Accept(' text/html ,  application/json;q=  0.9  ')
    assert.equal(header.size, 2)
  })

  it('gets all media types', () => {
    let header = new Accept('text/html,application/json;q=0.9')
    assert.deepEqual(header.mediaTypes, ['text/html', 'application/json'])
  })

  it('gets all weights', () => {
    let header = new Accept('text/html,application/json;q=0.9')
    assert.deepEqual(header.weights, [1, 0.9])
  })

  it('checks if a media type is acceptable', () => {
    let header = new Accept('text/html,text/*;q=0.9,application/json;q=0.8')
    assert.equal(header.accepts('text/html'), true)
    assert.equal(header.accepts('text/*'), true)
    assert.equal(header.accepts('text/plain'), true)
    assert.equal(header.accepts('application/json'), true)
    assert.equal(header.accepts('image/jpeg'), false)
  })

  it('gets the correct weight values', () => {
    let header = new Accept('text/html,text/*;q=0.9,application/json;q=0.8')
    assert.equal(header.getWeight('text/html'), 1)
    assert.equal(header.getWeight('*/*'), 1)
    assert.equal(header.getWeight('text/*'), 1)
    assert.equal(header.getWeight('text/plain'), 0.9)
    assert.equal(header.getWeight('application/json'), 0.8)
    assert.equal(header.getWeight('image/jpeg'), 0)
  })

  it('gets the preferred media type', () => {
    let header = new Accept('text/html,text/*;q=0.9,application/json;q=0.8')
    assert.equal(header.getPreferred(['text/html', 'application/json']), 'text/html')
    assert.equal(header.getPreferred(['text/plain', 'text/html']), 'text/html')
    assert.equal(header.getPreferred(['image/jpeg']), null)
  })

  it('sets and gets media types', () => {
    let header = new Accept()
    header.set('application/json', 0.9)
    assert.equal(header.get('application/json'), 0.9)
  })

  it('deletes media types', () => {
    let header = new Accept('text/html')
    assert.equal(header.has('text/html'), true)
    header.delete('text/html')
    assert.equal(header.has('text/html'), false)
  })

  it('clears all media types', () => {
    let header = new Accept('text/html,application/json;q=0.9')
    header.clear()
    assert.equal(header.size, 0)
  })

  it('iterates over entries', () => {
    let header = new Accept('text/html,application/json;q=0.9')
    let entries = Array.from(header.entries())
    assert.deepEqual(entries, [
      ['text/html', 1],
      ['application/json', 0.9],
    ])
  })

  it('is directly iterable', () => {
    let header = new Accept('text/html,application/json;q=0.9')
    let mediaTypes = Array.from(header)
    assert.deepEqual(mediaTypes, [
      ['text/html', 1],
      ['application/json', 0.9],
    ])
  })

  it('uses forEach correctly', () => {
    let header = new Accept('text/html,application/json;q=0.9')
    let result: [string, number][] = []
    header.forEach((mediaType, weight) => {
      result.push([mediaType, weight])
    })
    assert.deepEqual(result, [
      ['text/html', 1],
      ['application/json', 0.9],
    ])
  })

  it('returns correct size', () => {
    let header = new Accept('text/html,application/json;q=0.9')
    assert.equal(header.size, 2)
  })

  it('converts to string correctly', () => {
    let header = new Accept('text/html,application/json;q=0.9')
    assert.equal(header.toString(), 'text/html,application/json;q=0.9')
  })

  it('handles setting empty weight values', () => {
    let header = new Accept()
    header.set('text/html')
    assert.equal(header.get('text/html'), 1)
  })

  it('overwrites existing weight values', () => {
    let header = new Accept('text/html,application/json;q=0.9')
    header.set('application/json', 0.8)
    assert.equal(header.get('application/json'), 0.8)
  })

  it('handles setting wildcard media types', () => {
    let header = new Accept()
    header.set('*/*')
    assert.equal(header.get('*/*'), 1)
  })

  it('sorts initial value', () => {
    let header = new Accept('application/json;q=0.9,text/html')
    assert.equal(header.toString(), 'text/html,application/json;q=0.9')
    assert.deepEqual(header.mediaTypes, ['text/html', 'application/json'])
  })

  it('sorts updated value', () => {
    let header = new Accept('text/html,application/json;q=0.9')
    header.set('application/json', 0.8)
    assert.equal(header.toString(), 'text/html,application/json;q=0.8')
    assert.deepEqual(header.mediaTypes, ['text/html', 'application/json'])
  })
})

describe('Accept.from', () => {
  it('parses a string value', () => {
    let result = Accept.from('text/html, application/json;q=0.9')
    assert.ok(result instanceof Accept)
    assert.equal(result.size, 2)
    assert.equal(result.getWeight('text/html'), 1)
    assert.equal(result.getWeight('application/json'), 0.9)
  })

  it('returns empty instance for null', () => {
    let result = Accept.from(null)
    assert.ok(result instanceof Accept)
    assert.equal(result.size, 0)
  })

  it('accepts init object', () => {
    let result = Accept.from({ 'text/html': 1 })
    assert.ok(result instanceof Accept)
    assert.equal(result.size, 1)
  })
})
