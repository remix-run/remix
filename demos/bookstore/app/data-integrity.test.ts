import * as assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { createBook, deleteBook } from './models/books.ts'
import { db, initializeBookstoreDatabase, orderItems, orders } from './models/database.ts'
import { createOrder } from './models/orders.ts'
import { router } from './router.ts'
import { deleteUser } from './models/users.ts'

describe('bookstore data integrity', () => {
  before(async () => {
    await initializeBookstoreDatabase()
  })

  it('book ids continue increasing after deletions', async () => {
    await router.run('https://remix.run/data-integrity', async () => {
      let stamp = Date.now()

      let first = await createBook({
        slug: `id-test-a-${stamp}`,
        title: 'ID Test A',
        author: 'Integration Test',
        description: 'Ensures IDs are not reused after delete.',
        price: 19.99,
        genre: 'test',
        image_urls: JSON.stringify([]),
        cover_url: '/images/placeholder.jpg',
        isbn: '978-0000000001',
        published_year: 2026,
        in_stock: true,
      })

      let deleted = await deleteBook(String(first.id))
      assert.equal(deleted, true)

      let second = await createBook({
        slug: `id-test-b-${stamp}`,
        title: 'ID Test B',
        author: 'Integration Test',
        description: 'Ensures IDs are not reused after delete.',
        price: 21.99,
        genre: 'test',
        image_urls: JSON.stringify([]),
        cover_url: '/images/placeholder.jpg',
        isbn: '978-0000000002',
        published_year: 2026,
        in_stock: true,
      })

      assert.ok(second.id > first.id)
    })
  })

  it('rejects creating orders with missing users', async () => {
    await router.run('https://remix.run/data-integrity', async () => {
      await assert.rejects(async () => {
        await createOrder(
          999999,
          [{ bookId: 1, title: 'Ash & Smoke', price: 16.99, quantity: 1 }],
          JSON.stringify({
            street: '404 Missing User Ln',
            city: 'Nowhere',
            state: 'NA',
            zip: '00000',
          }),
        )
      })
    })
  })

  it('cascades order item deletion when an order is deleted', async () => {
    await router.run('https://remix.run/data-integrity', async () => {
      let order = await createOrder(
        2,
        [{ bookId: 1, title: 'Ash & Smoke', price: 16.99, quantity: 1 }],
        JSON.stringify({
          street: '1 Cascade Way',
          city: 'Boston',
          state: 'MA',
          zip: '02101',
        }),
      )

      let beforeDelete = await db.query(orderItems).where({ order_id: order.id }).count()
      assert.equal(beforeDelete, 1)

      let deleted = await db.delete(orders, order.id)
      assert.equal(deleted, true)

      let afterDelete = await db.query(orderItems).where({ order_id: order.id }).count()
      assert.equal(afterDelete, 0)
    })
  })

  it('rejects deleting a user with existing orders', async () => {
    await router.run('https://remix.run/data-integrity', async () => {
      await assert.rejects(async () => {
        await deleteUser(2)
      })
    })
  })
})
