import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "remix/component/jsx-runtime";
import { css, clientEntry, on } from 'remix/component';
import { routes } from '../routes.js';
let moduleUrl = routes.assets.href({ path: 'cart-items.js#CartItems' });
export let CartItems = clientEntry(moduleUrl, (handle) => {
    let pendingAction = null;
    let submit = async (form, signal, nextAction) => {
        if (pendingAction)
            return;
        pendingAction = nextAction;
        handle.update();
        try {
            let formData = new FormData(form);
            formData.set('redirect', 'none');
            await fetch(form.action, {
                method: 'POST',
                body: formData,
                signal,
            });
            if (signal.aborted)
                return;
            await handle.frame.reload();
        }
        finally {
            pendingAction = null;
            handle.update();
        }
    };
    return ({ items, total, canCheckout }) => {
        let isPending = pendingAction !== null;
        let totalLabel = isPending ? '---' : `$${total.toFixed(2)}`;
        return (_jsxs(_Fragment, { children: [isPending ? (_jsx("p", { mix: [css({ marginBottom: '1rem', fontSize: '0.9rem', color: '#666' })], children: "Updating your cart..." })) : null, _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Book" }), _jsx("th", { children: "Price" }), _jsx("th", { children: "Quantity" }), _jsx("th", { children: "Subtotal" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: items.map((item) => {
                                let isUpdating = pendingAction?.type === 'update' && pendingAction.bookId === item.bookId;
                                let isRemoving = pendingAction?.type === 'remove' && pendingAction.bookId === item.bookId;
                                return (_jsxs("tr", { children: [_jsx("td", { children: _jsx("a", { href: routes.books.show.href({ slug: item.slug }), children: item.title }) }), _jsxs("td", { children: ["$", item.price.toFixed(2)] }), _jsx("td", { children: _jsxs("form", { method: "POST", action: routes.cart.api.update.href(), mix: [
                                                    on('submit', async (event, signal) => {
                                                        event.preventDefault();
                                                        await submit(event.currentTarget, signal, {
                                                            type: 'update',
                                                            bookId: item.bookId,
                                                        });
                                                    }),
                                                    css({ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }),
                                                ], children: [_jsx("input", { type: "hidden", name: "_method", value: "PUT" }), _jsx("input", { type: "hidden", name: "bookId", value: item.bookId }), _jsx("input", { type: "number", name: "quantity", defaultValue: item.quantity, min: "1", disabled: isPending, mix: [css({ width: '70px' })] }), _jsx("button", { type: "submit", disabled: isPending, class: "btn btn-secondary", mix: [
                                                            css({
                                                                fontSize: '0.875rem',
                                                                padding: '0.25rem 0.5rem',
                                                                minWidth: '6.25rem',
                                                                textAlign: 'center',
                                                            }),
                                                        ], children: isUpdating ? 'Saving...' : 'Update' })] }) }), _jsxs("td", { children: ["$", (item.price * item.quantity).toFixed(2)] }), _jsx("td", { children: _jsxs("form", { method: "POST", action: routes.cart.api.remove.href(), mix: [
                                                    on('submit', async (event, signal) => {
                                                        event.preventDefault();
                                                        await submit(event.currentTarget, signal, {
                                                            type: 'remove',
                                                            bookId: item.bookId,
                                                        });
                                                    }),
                                                    css({ display: 'inline' }),
                                                ], children: [_jsx("input", { type: "hidden", name: "_method", value: "DELETE" }), _jsx("input", { type: "hidden", name: "bookId", value: item.bookId }), _jsx("button", { type: "submit", disabled: isPending, class: "btn btn-danger", mix: [
                                                            css({
                                                                fontSize: '0.875rem',
                                                                padding: '0.25rem 0.5rem',
                                                                minWidth: '7rem',
                                                                textAlign: 'center',
                                                            }),
                                                        ], children: isRemoving ? 'Removing...' : 'Remove' })] }) })] }, item.bookId));
                            }) })] }), _jsxs("div", { mix: [css({ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' })], children: [_jsxs("p", { mix: [css({ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', marginRight: 'auto' })], children: ["Total: ", totalLabel] }), _jsx("a", { href: routes.books.index.href(), class: "btn btn-secondary", children: "Continue Shopping" }), canCheckout ? (_jsx("a", { href: routes.checkout.index.href(), class: "btn", children: "Proceed to Checkout" })) : (_jsx("a", { href: routes.auth.login.index.href(), class: "btn", children: "Login to Checkout" }))] })] }));
    };
});
