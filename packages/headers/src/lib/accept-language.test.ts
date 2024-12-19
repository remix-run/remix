import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AcceptLanguage } from './accept-language.ts';

describe('Accept-Language', () => {
  it('initializes with an empty string', () => {
    let header = new AcceptLanguage('');
    assert.equal(header.size, 0);
  });

  it('initializes with a string', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9');
    assert.equal(header.get('en-US'), 1);
    assert.equal(header.get('en'), 0.9);
  });

  it('initializes with an array', () => {
    let header = new AcceptLanguage(['en-US', ['en', 0.9]]);
    assert.equal(header.get('en-US'), 1);
    assert.equal(header.get('en'), 0.9);
  });

  it('initializes with an object', () => {
    let header = new AcceptLanguage({ 'en-US': 1, en: 0.9 });
    assert.equal(header.get('en-US'), 1);
    assert.equal(header.get('en'), 0.9);
  });

  it('initializes with another Accept-Language', () => {
    let header = new AcceptLanguage(new AcceptLanguage('en-US,en;q=0.9'));
    assert.equal(header.get('en-US'), 1);
    assert.equal(header.get('en'), 0.9);
  });

  it('handles whitespace in initial value', () => {
    let header = new AcceptLanguage(' en-US ,  en;q=  0.9  ');
    assert.equal(header.get('en-US'), 1);
    assert.equal(header.get('en'), 0.9);
  });

  it('sets and gets languages', () => {
    let header = new AcceptLanguage('');
    header.set('en', 0.9);
    assert.equal(header.get('en'), 0.9);
  });

  it('deletes languages', () => {
    let header = new AcceptLanguage('en-US');
    assert.equal(header.delete('en-US'), true);
    assert.equal(header.delete('en'), false);
    assert.equal(header.get('en-US'), undefined);
  });

  it('checks if language exists', () => {
    let header = new AcceptLanguage('en-US');
    assert.equal(header.has('en-US'), true);
    assert.equal(header.has('fs'), false);
  });

  it('clears all languages', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9');
    header.clear();
    assert.equal(header.size, 0);
  });

  it('iterates over entries', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9');
    let entries = Array.from(header.entries());
    assert.deepEqual(entries, [
      ['en-US', 1],
      ['en', 0.9],
    ]);
  });

  it('gets all languages', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9');
    assert.deepEqual(header.languages, ['en-US', 'en']);
  });

  it('gets all qualities', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9');
    assert.deepEqual(header.qualities, [1, 0.9]);
  });

  it('uses forEach correctly', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9');
    let result: [string, number][] = [];
    header.forEach((language, quality) => {
      result.push([language, quality]);
    });
    assert.deepEqual(result, [
      ['en-US', 1],
      ['en', 0.9],
    ]);
  });

  it('returns correct size', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9');
    assert.equal(header.size, 2);
  });

  it('converts to string correctly', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9');
    assert.equal(header.toString(), 'en-US,en;q=0.9');
  });

  it('is directly iterable', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9');
    let entries = Array.from(header);
    assert.deepEqual(entries, [
      ['en-US', 1],
      ['en', 0.9],
    ]);
  });

  it('handles setting empty quality values', () => {
    let header = new AcceptLanguage('');
    header.set('en-US');
    assert.equal(header.get('en-US'), 1);
    assert.equal(header.toString(), 'en-US');
  });

  it('overwrites existing quality values', () => {
    let header = new AcceptLanguage('en;q=0.9');
    header.set('en', 1);
    assert.equal(header.get('en'), 1);
  });

  it('handles setting wildcard value', () => {
    let header = new AcceptLanguage('');
    header.set('*');
    assert.equal(header.get('*'), 1);
    assert.equal(header.toString(), '*');
  });

  it('sorts initial value', () => {
    let header = new AcceptLanguage('en;q=0.9,en-US');
    assert.equal(header.toString(), 'en-US,en;q=0.9');
    assert.deepEqual(header.languages, ['en-US', 'en']);
  });

  it('sorts updated value', () => {
    let header = new AcceptLanguage('en-US,en;q=0.9');
    header.set('fi');
    assert.equal(header.toString(), 'en-US,fi,en;q=0.9');
    assert.deepEqual(header.languages, ['en-US', 'fi', 'en']);
    header.set('en-US', 0.8);
    assert.equal(header.toString(), 'fi,en;q=0.9,en-US;q=0.8');
    assert.deepEqual(header.languages, ['fi', 'en', 'en-US']);
  });
});
