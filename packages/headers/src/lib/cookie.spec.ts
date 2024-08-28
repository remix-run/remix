import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Cookie } from './cookie.js';

describe('Cookie', () => {
  it('initializes with an empty string', () => {
    let header = new Cookie('');
    assert.equal(header.size, 0);
  });

  it('initializes with a string', () => {
    let header = new Cookie('name1=value1; name2=value2');
    assert.equal(header.get('name1'), 'value1');
    assert.equal(header.get('name2'), 'value2');
  });

  it('initializes with an array', () => {
    let header = new Cookie([
      ['name1', 'value1'],
      ['name2', 'value2'],
    ]);
    assert.equal(header.get('name1'), 'value1');
    assert.equal(header.get('name2'), 'value2');
  });

  it('initializes with an object', () => {
    let header = new Cookie({ name1: 'value1', name2: 'value2' });
    assert.equal(header.get('name1'), 'value1');
    assert.equal(header.get('name2'), 'value2');
  });

  it('initializes with another Cookie', () => {
    let header = new Cookie(new Cookie('name1=value1; name2=value2'));
    assert.equal(header.get('name1'), 'value1');
    assert.equal(header.get('name2'), 'value2');
  });

  it('handles whitespace in initial value', () => {
    let header = new Cookie(' name1 = value1 ;  name2  =  value2 ');
    assert.equal(header.get('name1'), 'value1');
    assert.equal(header.get('name2'), 'value2');
  });

  it('sets and gets values', () => {
    let header = new Cookie('');
    header.set('name', 'value');
    assert.equal(header.get('name'), 'value');
  });

  it('deletes values', () => {
    let header = new Cookie('name=value');
    assert.equal(header.delete('name'), true);
    assert.equal(header.delete('nonexistent'), false);
    assert.equal(header.get('name'), undefined);
  });

  it('checks if value exists', () => {
    let header = new Cookie('name=value');
    assert.equal(header.has('name'), true);
    assert.equal(header.has('nonexistent'), false);
  });

  it('clears all values', () => {
    let header = new Cookie('name1=value1; name2=value2');
    header.clear();
    assert.equal(header.size, 0);
  });

  it('iterates over entries', () => {
    let header = new Cookie('name1=value1; name2=value2');
    let entries = Array.from(header.entries());
    assert.deepEqual(entries, [
      ['name1', 'value1'],
      ['name2', 'value2'],
    ]);
  });

  it('iterates over names', () => {
    let header = new Cookie('name1=value1; name2=value2');
    let names = Array.from(header.names());
    assert.deepEqual(names, ['name1', 'name2']);
  });

  it('iterates over values', () => {
    let header = new Cookie('name1=value1; name2=value2');
    let values = Array.from(header.values());
    assert.deepEqual(values, ['value1', 'value2']);
  });

  it('uses forEach correctly', () => {
    let header = new Cookie('name1=value1; name2=value2');
    let result: [string, string][] = [];
    header.forEach((value, name) => {
      result.push([name, value]);
    });
    assert.deepEqual(result, [
      ['name1', 'value1'],
      ['name2', 'value2'],
    ]);
  });

  it('returns correct size', () => {
    let header = new Cookie('name1=value1; name2=value2');
    assert.equal(header.size, 2);
  });

  it('converts to string correctly', () => {
    let header = new Cookie('name1=value1; name2=value2');
    assert.equal(header.toString(), 'name1=value1; name2=value2');
  });

  it('is directly iterable', () => {
    let header = new Cookie('name1=value1; name2=value2');
    let entries = Array.from(header);
    assert.deepEqual(entries, [
      ['name1', 'value1'],
      ['name2', 'value2'],
    ]);
  });

  it('handles cookies without values', () => {
    let header = new Cookie('name1=value1; name2');
    assert.equal(header.get('name1'), 'value1');
    assert.equal(header.get('name2'), '');
  });

  it('handles setting empty values', () => {
    let header = new Cookie('');
    header.set('name', '');
    assert.equal(header.get('name'), '');
    assert.equal(header.toString(), 'name=');
  });

  it('overwrites existing values', () => {
    let header = new Cookie('name=value1');
    header.set('name', 'value2');
    assert.equal(header.get('name'), 'value2');
  });
});
