import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import decamelize from 'decamelize';
import * as assert from '@remix-run/assert';
import { describe, it } from '@remix-run/test';
import { on } from '@remix-run/ui';
import { render } from '@remix-run/ui/test';
describe('Counter', () => {
    function Counter(handle) {
        let count = handle.props.count ?? 0;
        return () => (_jsxs("div", { children: [
                _jsx("h3", { children: "Counter" }), _jsxs("div", { children: [
                        _jsx("button", { "data-action": "decrement", mix: [
                                on('click', () => {
                                    count--;
                                    handle.update();
                                }),
                            ], children: "-" }), _jsx("span", { "data-testid": "count", style: { fontSize: '24px', minWidth: '2ch', textAlign: 'center' }, children: count }), _jsx("button", { "data-action": "increment", mix: [
                                on('click', () => {
                                    count++;
                                    handle.update();
                                }),
                            ], children: "+" })
                    ] })
            ] }));
    }
    it('renders with initial count of 0 when not specified', (t) => {
        let { $, cleanup } = render(_jsx(Counter, {}));
        t.after(cleanup);
        assert.equal(Number($('[data-testid="count"]').textContent), 0);
    });
    it('renders with a provided initial count', (t) => {
        let { $, cleanup } = render(_jsx(Counter, { count: 5 }));
        t.after(cleanup);
        assert.equal(Number($('[data-testid="count"]').textContent), 5);
    });
    it('increments the count', async (t) => {
        let { $, act, cleanup } = render(_jsx(Counter, {}));
        t.after(cleanup);
        await act(() => $('[data-action="increment"]')?.click());
        assert.equal(Number($('[data-testid="count"]').textContent), 1);
        await act(() => $('[data-action="increment"]')?.click());
        assert.equal(Number($('[data-testid="count"]').textContent), 2);
        await act(() => $('[data-action="increment"]')?.click());
        assert.equal(Number($('[data-testid="count"]').textContent), 3);
    });
    it('decrements the count', async (t) => {
        let { $, act, cleanup } = render(_jsx(Counter, { count: 3 }));
        t.after(cleanup);
        await act(() => $('[data-action="decrement"]')?.click());
        assert.equal(Number($('[data-testid="count"]').textContent), 2);
        await act(() => $('[data-action="decrement"]')?.click());
        assert.equal(Number($('[data-testid="count"]').textContent), 1);
        await act(() => $('[data-action="decrement"]')?.click());
        assert.equal(Number($('[data-testid="count"]').textContent), 0);
    });
});
describe('FieldLabel (using decamelize)', () => {
    // Demonstrates that ESM third-party libraries are importable from test modules
    function FieldLabel(_handle) {
        return (props) => (_jsx("span", { "data-testid": "label", children: decamelize(props.name, { separator: ' ' }) }));
    }
    it('renders a single word unchanged', (t) => {
        let { $, cleanup } = render(_jsx(FieldLabel, { name: "name" }));
        t.after(cleanup);
        assert.equal($('[data-testid="label"]')?.textContent, 'name');
    });
    it('converts camelCase to spaced words', (t) => {
        let { $, cleanup } = render(_jsx(FieldLabel, { name: "firstName" }));
        t.after(cleanup);
        assert.equal($('[data-testid="label"]')?.textContent, 'first name');
    });
    it('handles multiple humps', (t) => {
        let { $, cleanup } = render(_jsx(FieldLabel, { name: "dateOfBirth" }));
        t.after(cleanup);
        assert.equal($('[data-testid="label"]')?.textContent, 'date of birth');
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
describe('render/cleanup', () => {
    it('cleanup removes the container from the DOM', () => {
        let { container, cleanup } = render(_jsx("div", { "data-testid": "manual", children: "hello" }));
        assert.equal(document.body.contains(container), true);
        cleanup();
        assert.equal(document.body.contains(container), false);
    });
});
describe.skip('skip: Skipped Test Suite', () => {
    it('would fail', () => {
        assert.equal(true, false);
    });
});
describe.todo('todo: Test Suite');
