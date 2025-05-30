import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CacheControl } from './cache-control.ts';

describe('CacheControl', () => {
  it('initializes with an empty string', () => {
    let header = new CacheControl('');
    assert.equal(header.maxAge, undefined);
    assert.equal(header.public, undefined);
    assert.equal(`${header}`, '');
  });

  it('initializes with a string', () => {
    let header = new CacheControl('public, max-age=3600, s-maxage=3600');
    assert.equal(header.maxAge, 3600);
    assert.equal(header.sMaxage, 3600);
    assert.equal(header.public, true);
  });

  it('initializes with an object', () => {
    let header = new CacheControl({ public: true, maxAge: 3600, sMaxage: 3600 });
    assert.equal(header.maxAge, 3600);
    assert.equal(header.sMaxage, 3600);
    assert.equal(header.public, true);
  });

  it('initializes with another CacheControl', () => {
    let header = new CacheControl(new CacheControl('public, max-age=3600, s-maxage=3600'));
    assert.equal(header.maxAge, 3600);
    assert.equal(header.sMaxage, 3600);
    assert.equal(header.public, true);
  });

  it('handles whitespace in initial value', () => {
    let header = new CacheControl(' public , max-age = 3600, s-maxage=3600 ');
    assert.equal(header.maxAge, 3600);
    assert.equal(header.sMaxage, 3600);
    assert.equal(header.public, true);
  });

  it('sets and gets attributes', () => {
    let header = new CacheControl('');
    header.maxAge = 3600;
    header.sMaxage = 3600;
    header.public = true;
    assert.equal(header.maxAge, 3600);
    assert.equal(header.sMaxage, 3600);
    assert.equal(header.public, true);
  });

  it('converts to a string properly', () => {
    let header = new CacheControl('public, max-age=3600, s-maxage=3600');
    assert.equal(header.toString(), 'public, max-age=3600, s-maxage=3600');
  });

  it('sets numerical values to 0 instead of omitting them', () => {
    let header = new CacheControl();
    header.maxAge = 0;
    assert.equal(header.toString(), 'max-age=0');
  });
});
