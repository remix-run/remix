import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Accept } from './accept.ts';

describe('Accept', () => {
  it('initializes with an empty string', () => {
    let header = new Accept('');
    assert.equal(header.size, 0);
  });

  it('initializes with a string', () => {
    let header = new Accept('text/html,application/json;q=0.9');
    assert.equal(header.get('text/html'), 1);
    assert.equal(header.get('application/json'), 0.9);
  });

  it('initializes with an array', () => {
    let header = new Accept(['text/html', ['application/json', 0.9]]);
    assert.equal(header.get('text/html'), 1);
    assert.equal(header.get('application/json'), 0.9);
  });

  it('initializes with an object', () => {
    let header = new Accept({ 'text/html': 1, 'application/json': 0.9 });
    assert.equal(header.get('text/html'), 1);
    assert.equal(header.get('application/json'), 0.9);
  });

  it('initializes with another Accept', () => {
    let header = new Accept(new Accept('text/html,application/json;q=0.9'));
    assert.equal(header.get('text/html'), 1);
    assert.equal(header.get('application/json'), 0.9);
  });

  it('handles whitespace in initial value', () => {
    let header = new Accept(' text/html ,  application/json;q=  0.9  ');
    assert.equal(header.get('text/html'), 1);
    assert.equal(header.get('application/json'), 0.9);
  });

  it('sets and gets media types', () => {
    let header = new Accept();
    header.set('application/json', 0.9);
    assert.equal(header.get('application/json'), 0.9);
  });

  it('deletes media types', () => {
    let header = new Accept('text/html');
    assert.equal(header.delete('text/html'), true);
    assert.equal(header.delete('application/json'), false);
    assert.equal(header.get('text/html'), undefined);
  });

  it('checks if media type exists', () => {
    let header = new Accept('text/html');
    assert.equal(header.has('text/html'), true);
    assert.equal(header.has('application/json'), false);
  });

  it('clears all media types', () => {
    let header = new Accept('text/html,application/json;q=0.9');
    header.clear();
    assert.equal(header.size, 0);
  });

  it('gets all media types', () => {
    let header = new Accept('text/html,application/json;q=0.9');
    assert.deepEqual(header.mediaTypes, ['text/html', 'application/json']);
  });

  it('gets all qualities', () => {
    let header = new Accept('text/html,application/json;q=0.9');
    assert.deepEqual(header.qualities, [1, 0.9]);
  });

  it('iterates over entries', () => {
    let header = new Accept('text/html,application/json;q=0.9');
    let entries = Array.from(header.entries());
    assert.deepEqual(entries, [
      ['text/html', 1],
      ['application/json', 0.9],
    ]);
  });

  it('is directly iterable', () => {
    let header = new Accept('text/html,application/json;q=0.9');
    let mediaTypes = Array.from(header);
    assert.deepEqual(mediaTypes, [
      ['text/html', 1],
      ['application/json', 0.9],
    ]);
  });

  it('uses forEach correctly', () => {
    let header = new Accept('text/html,application/json;q=0.9');
    let result: [string, number][] = [];
    header.forEach((mediaType, quality) => {
      result.push([mediaType, quality]);
    });
    assert.deepEqual(result, [
      ['text/html', 1],
      ['application/json', 0.9],
    ]);
  });

  it('returns correct size', () => {
    let header = new Accept('text/html,application/json;q=0.9');
    assert.equal(header.size, 2);
  });

  it('converts to string correctly', () => {
    let header = new Accept('text/html,application/json;q=0.9');
    assert.equal(header.toString(), 'text/html,application/json;q=0.9');
  });

  it('handles setting empty quality values', () => {
    let header = new Accept();
    header.set('text/html');
    assert.equal(header.get('text/html'), 1);
  });

  it('overwrites existing quality values', () => {
    let header = new Accept('text/html,application/json;q=0.9');
    header.set('application/json', 0.8);
    assert.equal(header.get('application/json'), 0.8);
  });

  it('handles setting wildcard media types', () => {
    let header = new Accept();
    header.set('*/*');
    assert.equal(header.get('*/*'), 1);
  });

  it('sorts initial value', () => {
    let header = new Accept('application/json;q=0.9,text/html');
    assert.equal(header.toString(), 'text/html,application/json;q=0.9');
    assert.deepEqual(header.mediaTypes, ['text/html', 'application/json']);
  });

  it('sorts updated value', () => {
    let header = new Accept('text/html,application/json;q=0.9');
    header.set('application/json', 0.8);
    assert.equal(header.toString(), 'text/html,application/json;q=0.8');
    assert.deepEqual(header.mediaTypes, ['text/html', 'application/json']);
  });
});
