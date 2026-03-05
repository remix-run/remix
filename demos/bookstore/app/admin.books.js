import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { redirect } from 'remix/response/redirect';
import { css } from 'remix/component';
import { routes } from './routes.js';
import { books } from './data/schema.js';
import { Layout } from './layout.js';
import { parseId } from './utils/ids.js';
import { render } from './utils/render.js';
import { RestfulForm } from './components/restful-form.js';
export default {
    actions: {
        async index({ db }) {
            let allBooks = await db.findMany(books, { orderBy: ['id', 'asc'] });
            return render(_jsxs(Layout, { children: [_jsx("h1", { children: "Manage Books" }), _jsxs("p", { mix: [css({ marginBottom: '1rem' })], children: [_jsx("a", { href: routes.admin.books.new.href(), class: "btn", children: "Add New Book" }), _jsx("a", { href: routes.admin.index.href(), class: "btn btn-secondary", mix: [css({ marginLeft: '0.5rem' })], children: "Back to Dashboard" })] }), _jsx("div", { class: "card", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Title" }), _jsx("th", { children: "Author" }), _jsx("th", { children: "Genre" }), _jsx("th", { children: "Price" }), _jsx("th", { children: "Stock" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: allBooks.map((book) => (_jsxs("tr", { children: [_jsx("td", { children: book.title }), _jsx("td", { children: book.author }), _jsx("td", { children: book.genre }), _jsxs("td", { children: ["$", book.price.toFixed(2)] }), _jsx("td", { children: _jsx("span", { class: `badge ${book.in_stock ? 'badge-success' : 'badge-warning'}`, children: book.in_stock ? 'Yes' : 'No' }) }), _jsxs("td", { class: "actions", children: [_jsx("a", { href: routes.admin.books.edit.href({ bookId: book.id }), class: "btn btn-secondary", mix: [css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })], children: "Edit" }), _jsx(RestfulForm, { method: "DELETE", action: routes.admin.books.destroy.href({ bookId: book.id }), mix: [css({ display: 'inline' })], children: _jsx("button", { type: "submit", class: "btn btn-danger", mix: [css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })], children: "Delete" }) })] })] }))) })] }) })] }));
        },
        async show({ db, params }) {
            let bookId = parseId(params.bookId);
            let book = bookId === undefined ? undefined : await db.find(books, bookId);
            if (!book) {
                return render(_jsx(Layout, { children: _jsx("div", { class: "card", children: _jsx("h1", { children: "Book Not Found" }) }) }), { status: 404 });
            }
            return render(_jsxs(Layout, { children: [_jsx("h1", { children: "Book Details" }), _jsxs("div", { class: "card", children: [_jsxs("p", { children: [_jsx("strong", { children: "Title:" }), " ", book.title] }), _jsxs("p", { children: [_jsx("strong", { children: "Author:" }), " ", book.author] }), _jsxs("p", { children: [_jsx("strong", { children: "Slug:" }), " ", book.slug] }), _jsxs("p", { children: [_jsx("strong", { children: "Description:" }), " ", book.description] }), _jsxs("p", { children: [_jsx("strong", { children: "Price:" }), " $", book.price.toFixed(2)] }), _jsxs("p", { children: [_jsx("strong", { children: "Genre:" }), " ", book.genre] }), _jsxs("p", { children: [_jsx("strong", { children: "ISBN:" }), " ", book.isbn] }), _jsxs("p", { children: [_jsx("strong", { children: "Published:" }), " ", book.published_year] }), _jsxs("p", { children: [_jsx("strong", { children: "In Stock:" }), ' ', _jsx("span", { class: `badge ${book.in_stock ? 'badge-success' : 'badge-warning'}`, children: book.in_stock ? 'Yes' : 'No' })] }), _jsxs("div", { mix: [css({ marginTop: '2rem' })], children: [_jsx("a", { href: routes.admin.books.edit.href({ bookId: book.id }), class: "btn", children: "Edit" }), _jsx("a", { href: routes.admin.books.index.href(), class: "btn btn-secondary", mix: [css({ marginLeft: '0.5rem' })], children: "Back to List" })] })] })] }));
        },
        new() {
            return render(_jsxs(Layout, { children: [_jsx("h1", { children: "Add New Book" }), _jsx("div", { class: "card", children: _jsxs("form", { method: "POST", action: routes.admin.books.create.href(), encType: "multipart/form-data", children: [_jsxs("div", { class: "form-group", children: [_jsx("label", { for: "title", children: "Title" }), _jsx("input", { type: "text", id: "title", name: "title", required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "author", children: "Author" }), _jsx("input", { type: "text", id: "author", name: "author", required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "slug", children: "Slug (URL-friendly name)" }), _jsx("input", { type: "text", id: "slug", name: "slug", required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "description", children: "Description" }), _jsx("textarea", { id: "description", name: "description", required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "price", children: "Price" }), _jsx("input", { type: "number", id: "price", name: "price", step: "0.01", required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "genre", children: "Genre" }), _jsx("input", { type: "text", id: "genre", name: "genre", required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "isbn", children: "ISBN" }), _jsx("input", { type: "text", id: "isbn", name: "isbn", required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "publishedYear", children: "Published Year" }), _jsx("input", { type: "number", id: "publishedYear", name: "publishedYear", required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "inStock", children: "In Stock" }), _jsxs("select", { id: "inStock", name: "inStock", children: [_jsx("option", { value: "true", children: "Yes" }), _jsx("option", { value: "false", children: "No" })] })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "cover", children: "Book Cover Image" }), _jsx("input", { type: "file", id: "cover", name: "cover", accept: "image/*" }), _jsx("small", { mix: [css({ color: '#666' })], children: "Optional. Upload a cover image for this book." })] }), _jsx("button", { type: "submit", class: "btn", children: "Create Book" }), _jsx("a", { href: routes.admin.books.index.href(), class: "btn btn-secondary", mix: [css({ marginLeft: '0.5rem' })], children: "Cancel" })] }) })] }));
        },
        async create({ db, get }) {
            let formData = get(FormData);
            await db.create(books, {
                slug: formData.get('slug')?.toString() ?? '',
                title: formData.get('title')?.toString() ?? '',
                author: formData.get('author')?.toString() ?? '',
                description: formData.get('description')?.toString() ?? '',
                price: parseFloat(formData.get('price')?.toString() ?? '0'),
                genre: formData.get('genre')?.toString() ?? '',
                cover_url: formData.get('cover')?.toString() ?? '/images/placeholder.jpg',
                image_urls: JSON.stringify([]),
                isbn: formData.get('isbn')?.toString() ?? '',
                published_year: parseInt(formData.get('publishedYear')?.toString() ?? '2024', 10),
                in_stock: formData.get('inStock')?.toString() === 'true',
            });
            return redirect(routes.admin.books.index.href());
        },
        async edit({ db, params }) {
            let bookId = parseId(params.bookId);
            let book = bookId === undefined ? undefined : await db.find(books, bookId);
            if (!book) {
                return render(_jsx(Layout, { children: _jsx("div", { class: "card", children: _jsx("h1", { children: "Book Not Found" }) }) }), { status: 404 });
            }
            return render(_jsxs(Layout, { children: [_jsx("h1", { children: "Edit Book" }), _jsx("div", { class: "card", children: _jsxs(RestfulForm, { method: "PUT", action: routes.admin.books.update.href({ bookId: book.id }), encType: "multipart/form-data", children: [_jsxs("div", { class: "form-group", children: [_jsx("label", { for: "title", children: "Title" }), _jsx("input", { type: "text", id: "title", name: "title", value: book.title, required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "author", children: "Author" }), _jsx("input", { type: "text", id: "author", name: "author", value: book.author, required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "slug", children: "Slug (URL-friendly name)" }), _jsx("input", { type: "text", id: "slug", name: "slug", value: book.slug, required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "description", children: "Description" }), _jsx("textarea", { id: "description", name: "description", required: true, children: book.description })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "price", children: "Price" }), _jsx("input", { type: "number", id: "price", name: "price", step: "0.01", value: book.price, required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "genre", children: "Genre" }), _jsx("input", { type: "text", id: "genre", name: "genre", value: book.genre, required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "isbn", children: "ISBN" }), _jsx("input", { type: "text", id: "isbn", name: "isbn", value: book.isbn, required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "publishedYear", children: "Published Year" }), _jsx("input", { type: "number", id: "publishedYear", name: "publishedYear", value: book.published_year, required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "inStock", children: "In Stock" }), _jsxs("select", { id: "inStock", name: "inStock", children: [_jsx("option", { value: "true", selected: book.in_stock, children: "Yes" }), _jsx("option", { value: "false", selected: !book.in_stock, children: "No" })] })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "cover", children: "Book Cover Image" }), book.cover_url !== '/images/placeholder.jpg' && (_jsxs("div", { mix: [css({ marginBottom: '0.5rem' })], children: [_jsx("img", { src: book.cover_url, alt: book.title, mix: [css({ maxWidth: '200px', height: 'auto', borderRadius: '4px' })] }), _jsx("p", { mix: [css({ fontSize: '0.875rem', color: '#666' })], children: "Current cover image" })] })), _jsx("input", { type: "file", id: "cover", name: "cover", accept: "image/*" }), _jsx("small", { mix: [css({ color: '#666' })], children: "Optional. Upload a new cover image to replace the current one." })] }), _jsx("button", { type: "submit", class: "btn", children: "Update Book" }), _jsx("a", { href: routes.admin.books.index.href(), class: "btn btn-secondary", mix: [css({ marginLeft: '0.5rem' })], children: "Cancel" })] }) })] }));
        },
        async update({ db, get, params }) {
            let formData = get(FormData);
            let bookId = parseId(params.bookId);
            let book = bookId === undefined ? undefined : await db.find(books, bookId);
            if (!book) {
                return new Response('Book not found', { status: 404 });
            }
            // The uploadHandler automatically saves the file and returns the URL path
            // If no file was uploaded, keep the existing cover_url
            let cover_url = formData.get('cover')?.toString() || book.cover_url;
            await db.update(books, book.id, {
                slug: formData.get('slug')?.toString() ?? '',
                title: formData.get('title')?.toString() ?? '',
                author: formData.get('author')?.toString() ?? '',
                description: formData.get('description')?.toString() ?? '',
                price: parseFloat(formData.get('price')?.toString() ?? '0'),
                genre: formData.get('genre')?.toString() ?? '',
                cover_url,
                isbn: formData.get('isbn')?.toString() ?? '',
                published_year: parseInt(formData.get('publishedYear')?.toString() ?? '2024', 10),
                in_stock: formData.get('inStock')?.toString() === 'true',
            });
            return redirect(routes.admin.books.index.href());
        },
        async destroy({ db, params }) {
            let bookId = parseId(params.bookId);
            let book = bookId === undefined ? undefined : await db.find(books, bookId);
            if (book) {
                await db.delete(books, book.id);
            }
            return redirect(routes.admin.books.index.href());
        },
    },
};
