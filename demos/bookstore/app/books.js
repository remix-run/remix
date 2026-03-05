import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { Frame, css } from 'remix/component';
import { routes } from './routes.js';
import { ilike } from 'remix/data-table';
import { books } from './data/schema.js';
import { BookCard } from './components/book-card.js';
import { Layout } from './layout.js';
import { loadAuth } from './middleware/auth.js';
import { render } from './utils/render.js';
import { getCurrentCart } from './utils/context.js';
import { ImageCarousel } from './assets/image-carousel.js';
export default {
    middleware: [loadAuth()],
    actions: {
        async index({ db }) {
            let allBooks = await db.findMany(books, { orderBy: ['id', 'asc'] });
            let genres = await db.query(books).select('genre').distinct().orderBy('genre', 'asc').all();
            let cart = getCurrentCart();
            return render(_jsxs(Layout, { children: [_jsx("h1", { children: "Browse Books" }), _jsx("div", { class: "card", mix: [css({ marginBottom: '2rem' })], children: _jsxs("form", { action: routes.search.href(), method: "GET", mix: [css({ display: 'flex', gap: '0.5rem' })], children: [_jsx("input", { type: "search", name: "q", placeholder: "Search books by title, author, or description...", mix: [css({ flex: 1, padding: '0.5rem' })] }), _jsx("button", { type: "submit", class: "btn", children: "Search" })] }) }), _jsxs("div", { class: "card", mix: [css({ marginBottom: '2rem' })], children: [_jsx("h3", { children: "Browse by Genre" }), _jsx("div", { mix: [css({ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' })], children: genres.map((genreRow) => (_jsx("a", { href: routes.books.genre.href({ genre: genreRow.genre }), class: "btn btn-secondary", children: genreRow.genre }))) })] }), _jsx("div", { class: "grid", children: allBooks.map((book) => {
                            let inCart = cart.items.some((item) => item.slug === book.slug);
                            return _jsx(BookCard, { book: book, inCart: inCart });
                        }) })] }));
        },
        async genre({ params, db }) {
            let genre = params.genre;
            let matchingBooks = await db.findMany(books, {
                where: ilike('genre', genre),
                orderBy: ['id', 'asc'],
            });
            if (matchingBooks.length === 0) {
                return render(_jsx(Layout, { children: _jsxs("div", { class: "card", children: [_jsx("h1", { children: "Genre Not Found" }), _jsxs("p", { children: ["No books found in the \"", genre, "\" genre."] }), _jsx("p", { mix: [css({ marginTop: '1rem' })], children: _jsx("a", { href: routes.books.index.href(), class: "btn", children: "Browse All Books" }) })] }) }), { status: 404 });
            }
            let cart = getCurrentCart();
            return render(_jsxs(Layout, { children: [_jsxs("h1", { children: [genre.charAt(0).toUpperCase() + genre.slice(1), " Books"] }), _jsx("p", { mix: [css({ margin: '1rem 0' })], children: _jsx("a", { href: routes.books.index.href(), class: "btn btn-secondary", children: "View All Books" }) }), _jsx("div", { class: "grid", mix: [css({ marginTop: '2rem' })], children: matchingBooks.map((book) => {
                            let inCart = cart.items.some((item) => item.slug === book.slug);
                            return _jsx(BookCard, { book: book, inCart: inCart });
                        }) })] }));
        },
        async show({ params, db }) {
            let book = await db.findOne(books, { where: { slug: params.slug } });
            if (!book) {
                return render(_jsx(Layout, { children: _jsx("div", { class: "card", children: _jsx("h1", { children: "Book Not Found" }) }) }), { status: 404 });
            }
            let imageUrls = JSON.parse(book.image_urls);
            return render(_jsx(Layout, { children: _jsxs("div", { mix: [css({ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' })], children: [_jsx("div", { mix: [
                                css({
                                    height: '400px',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                                    overflow: 'hidden',
                                }),
                            ], children: _jsx(ImageCarousel, { images: imageUrls }) }), _jsxs("div", { class: "card", children: [_jsx("h1", { children: book.title }), _jsxs("p", { class: "author", mix: [css({ fontSize: '1.2rem', margin: '0.5rem 0' })], children: ["by ", book.author] }), _jsxs("p", { mix: [css({ margin: '1rem 0' })], children: [_jsx("span", { class: "badge badge-info", children: book.genre }), _jsx("span", { class: `badge ${book.in_stock ? 'badge-success' : 'badge-warning'}`, mix: [css({ marginLeft: '0.5rem' })], children: book.in_stock ? 'In Stock' : 'Out of Stock' })] }), _jsxs("p", { class: "price", mix: [css({ fontSize: '2rem', margin: '1rem 0' })], children: ["$", book.price.toFixed(2)] }), _jsx("p", { mix: [css({ margin: '1.5rem 0', lineHeight: 1.8 })], children: book.description }), _jsxs("div", { mix: [
                                        css({
                                            margin: '1.5rem 0',
                                            padding: '1rem',
                                            background: '#f8f9fa',
                                            borderRadius: '4px',
                                        }),
                                    ], children: [_jsxs("p", { children: [_jsx("strong", { children: "ISBN:" }), " ", book.isbn] }), _jsxs("p", { children: [_jsx("strong", { children: "Published:" }), " ", book.published_year] })] }), book.in_stock ? (_jsx("div", { mix: [css({ marginTop: '2rem' })], children: _jsx(Frame, { src: routes.fragments.cartButton.href({ bookId: book.id }) }) })) : (_jsx("p", { mix: [css({ color: '#e74c3c', fontWeight: 500 })], children: "This book is currently out of stock." })), _jsx("p", { mix: [css({ marginTop: '1.5rem' })], children: _jsx("a", { href: routes.books.index.href(), class: "btn btn-secondary", children: "Back to Books" }) })] })] }) }), { headers: { 'Cache-Control': 'no-store' } });
        },
    },
};
