import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { routes } from '../routes.js';
import { Frame, css } from 'remix/component';
export function BookCard() {
    return ({ book }) => (_jsxs("div", { class: "book-card", children: [_jsx("img", { src: book.cover_url, alt: book.title }), _jsxs("div", { class: "book-card-body", children: [_jsx("h3", { children: book.title }), _jsxs("p", { class: "author", children: ["by ", book.author] }), _jsxs("p", { class: "price", children: ["$", book.price.toFixed(2)] }), _jsxs("div", { mix: [css({ display: 'flex', gap: '0.5rem', alignItems: 'center' })], children: [_jsx("a", { href: routes.books.show.href({ slug: book.slug }), class: "btn", children: "View Details" }), _jsx(Frame, { src: routes.fragments.cartButton.href({ bookId: book.id }) })] })] })] }));
}
