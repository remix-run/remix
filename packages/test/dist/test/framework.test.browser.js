import decamelize from 'decamelize';
import cx from 'clsx';
import * as assert from '@remix-run/assert';
import { describe, it } from '@remix-run/test';
describe('FieldLabel (using decamelize)', () => {
    it('renders a single word unchanged', (t) => {
        let { $, cleanup } = createTextFixture(decamelize('name', { separator: ' ' }));
        t.after(cleanup);
        assert.equal($('[data-testid="result"]')?.textContent, 'name');
    });
    it('converts camelCase to spaced words', (t) => {
        let { $, cleanup } = createTextFixture(decamelize('firstName', { separator: ' ' }));
        t.after(cleanup);
        assert.equal($('[data-testid="result"]')?.textContent, 'first name');
    });
    it('handles multiple humps', (t) => {
        let { $, cleanup } = createTextFixture(decamelize('dateOfBirth', { separator: ' ' }));
        t.after(cleanup);
        assert.equal($('[data-testid="result"]')?.textContent, 'date of birth');
    });
});
describe('MobileMenu (using clsx)', () => {
    it('resolves browser-oriented package exports for default imports', (t) => {
        let nav = document.createElement('nav');
        nav.ariaLabel = 'Mobile navigation';
        nav.className = cx('mobile-menu', {
            'mobile-menu--open': true,
            'mobile-menu--closed': false,
        });
        let { $, cleanup } = createFixture(nav);
        t.after(cleanup);
        assert.equal($('[aria-label="Mobile navigation"]')?.className, 'mobile-menu mobile-menu--open');
    });
});
describe('DOM Tests', () => {
    it('can interact with DOM', async () => {
        let div = document.createElement('div');
        div.textContent = 'Hello';
        assert.equal(div.textContent, 'Hello');
    });
    it('can test fetch API', async () => {
        let response = await fetch('data:text/plain,hello');
        let text = await response.text();
        assert.equal(text, 'hello');
    });
    it.skip('skip: can skip tests', () => {
        assert.equal(true, false);
    });
    it.todo('todo: can mark tests as todo');
});
describe.skip('skip: Skipped Test Suite', () => {
    it('would fail', () => {
        assert.equal(true, false);
    });
});
describe.todo('todo: Test Suite');
function createTextFixture(text) {
    let span = document.createElement('span');
    span.dataset.testid = 'result';
    span.textContent = text;
    return createFixture(span);
}
function createFixture(element) {
    document.body.append(element);
    return {
        $(selector) {
            return element.matches(selector) ? element : element.querySelector(selector);
        },
        cleanup() {
            element.remove();
        },
    };
}
