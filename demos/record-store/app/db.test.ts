import * as assert from 'remix/assert'
import { beforeEach, describe, it } from 'remix/test'
import { sql } from 'remix/data-table'

import { db, loadAppMigrations, loadAppSeed } from './db.ts'
import { albums, albumTracks, users } from './data/schema.ts'
import { albumGenres } from './data/album-genres.ts'
import { verifyPassword } from './utils/password-hash.ts'

beforeEach(async () => {
  await db.reset({ migrations: await loadAppMigrations(), seed: await loadAppSeed() })
})

describe('record store database seed', () => {
  it('seeds 50 records across the supported categories', async () => {
    let catalog = await db.findMany(albums)
    assert.equal(catalog.length, 50)
    assert.deepEqual(
      [...new Set(catalog.map((album) => album.genre))].sort(),
      [...albumGenres].sort(),
    )
  })

  it('ties seeded order snapshots to the catalog and matches the order totals', async () => {
    let mismatches = await db.exec(sql`
      select orders.id from orders
      join order_items on order_items.order_id = orders.id
      join albums on albums.id = order_items.album_id
      group by orders.id
      having round(sum(order_items.quantity * order_items.unit_price), 2) != orders.total
        or sum(order_items.title != albums.title or order_items.unit_price != albums.price) > 0
    `)

    assert.deepEqual(mismatches.rows, [])
    assert.deepEqual((await db.exec(sql`pragma foreign_key_check`)).rows, [])
  })

  it('seeds two sides of three to six ordered tracks for every album', async () => {
    let catalog = await db.findMany(albums)
    let tracks = await db.findMany(albumTracks, {
      orderBy: [
        ['side', 'asc'],
        ['position', 'asc'],
      ],
    })
    let tracklists = Map.groupBy(tracks, (track) => track.album_id)
    let sideLengths = new Set<number>()

    for (let album of catalog) {
      let tracklist = tracklists.get(album.id)
      assert.ok(tracklist, `Missing tracklist for ${album.slug}`)
      let sides = Map.groupBy(tracklist, (track) => track.side)
      assert.deepEqual([...sides.keys()], ['A', 'B'])
      for (let side of sides.values()) {
        assert.ok(side.length >= 3 && side.length <= 6)
        assert.deepEqual(
          side.map((track) => track.position),
          side.map((_, index) => index + 1),
        )
        sideLengths.add(side.length)
      }
    }

    assert.deepEqual([...sideLengths].sort(), [3, 4, 5, 6])
  })

  it('stores verifiable password hashes for seeded users', async () => {
    let admin = await db.find(users, 1)
    let customer = await db.find(users, 2)

    assert.ok(admin)
    assert.ok(customer)
    assert.equal(admin.email, 'admin@recordstore.com')
    assert.equal(customer.email, 'customer@example.com')
    assert.notEqual(admin.password_hash, 'admin123')
    assert.notEqual(customer.password_hash, 'password123')
    assert.equal(await verifyPassword('admin123', admin.password_hash), true)
    assert.equal(await verifyPassword('password123', customer.password_hash), true)
  })

  it('does not duplicate journal entries or seed data when migrated again', async () => {
    let journalBefore = await db.exec(sql`select count(*) as count from data_table_migrations`)
    let tracksBefore = await db.count(albumTracks)

    await db.migrate(await loadAppMigrations())
    let seed = await loadAppSeed()
    await seed(db)

    let journalAfter = await db.exec(sql`select count(*) as count from data_table_migrations`)
    let seededUsers = await db.exec(sql`select count(*) as count from users`)
    let seededAlbums = await db.count(albums)

    assert.deepEqual(journalAfter.rows, journalBefore.rows)
    assert.equal(Number(seededUsers.rows?.[0]?.count), 2)
    assert.equal(seededAlbums, 50)
    assert.equal(await db.count(albumTracks), tracksBefore)
  })
})
