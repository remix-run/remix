import { createHandlers } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { apiMiddleware } from './middleware/api.ts'

export const apiBooksHandlers = createHandlers(routes.api.books, [apiMiddleware], {
  index({ url }) {
    let limit = parseInt(url.searchParams.get('limit') || '10')
    let offset = parseInt(url.searchParams.get('offset') || '0')

    return new Response(
      JSON.stringify({
        books: getAllBooks(limit, offset),
        total: getTotalBooks(),
        limit,
        offset,
      }),
    )
  },
  new() {
    return new Response(JSON.stringify({ form: 'new book form' }))
  },
  async create({ request }) {
    let book = await request.json()
    let createdBook = createBook(book)
    return new Response(JSON.stringify(createdBook), { status: 201 })
  },
  show({ params }) {
    let book = getBook(params.id)
    if (!book) {
      return new Response(JSON.stringify({ error: 'Book not found' }), { status: 404 })
    }
    return new Response(JSON.stringify(book))
  },
  edit({ params }) {
    let book = getBook(params.id)
    return new Response(JSON.stringify({ form: 'edit book form', book }))
  },
  async update({ params, request }) {
    let updates = await request.json()
    let updatedBook = updateBook(params.id, updates)
    return new Response(JSON.stringify(updatedBook))
  },
  destroy({ params }) {
    deleteBook(params.id)
    return new Response('', { status: 204 })
  },

  author: {
    show({ params }) {
      return new Response(JSON.stringify(getBook(params.id)))
    },
    new({ params }) {
      return new Response(JSON.stringify({ form: 'New author form' }))
    },
    create({ params }) {
      return new Response(JSON.stringify({ author: 'New author' }))
    },
    edit({ params }) {
      return new Response(JSON.stringify({ form: 'Edit author form' }))
    },
    update({ params }) {
      return new Response(JSON.stringify({ author: 'Updated author' }))
    },
    destroy({ params }) {
      return new Response(JSON.stringify({ author: 'Deleted author' }))
    },
  },
})

function getAllBooks(limit: number, offset: number) {
  return Array.from({ length: limit }, (_, i) => ({
    id: (offset + i + 1).toString(),
    title: `Book ${offset + i + 1}`,
    author: `Author ${Math.floor((offset + i) / 3) + 1}`,
    isbn: `978-0-${String(offset + i + 1).padStart(6, '0')}-1`,
    price: 19.99 + (i % 3) * 5,
    category: ['fiction', 'non-fiction', 'science'][i % 3],
  }))
}

function getTotalBooks() {
  return 1247
}

function getBook(id: string) {
  return {
    id,
    title: `Book ${id}`,
    author: `Author ${Math.floor(parseInt(id) / 3) + 1}`,
    isbn: `978-0-${id.padStart(6, '0')}-1`,
    price: 19.99 + (parseInt(id) % 3) * 5,
    category: ['fiction', 'non-fiction', 'science'][parseInt(id) % 3],
    description: `This is the description for book ${id}. A fascinating read!`,
  }
}

function createBook(book: any) {
  return {
    id: Date.now().toString(),
    ...book,
    createdAt: new Date().toISOString(),
  }
}

function updateBook(id: string, updates: any) {
  return {
    ...getBook(id),
    ...updates,
    updatedAt: new Date().toISOString(),
  }
}

function deleteBook(id: string) {
  return { deleted: id, deletedAt: new Date().toISOString() }
}
