import * as assert from '@remix-run/assert';
import { describe, it } from '@remix-run/test';
import { value } from './fixtures/import-value.js';
describe('browser module imports', () => {
    it('loads static imports', () => {
        assert.equal(value, 'loaded');
    });
    it('loads relative dynamic imports', async () => {
        let module = await import('./fixtures/import-value.js');
        assert.equal(module.value, 'loaded');
    });
    it('loads bare dynamic imports', async () => {
        let { default: decamelize } = await import('decamelize');
        assert.equal(decamelize('firstName'), 'first_name');
    });
});
