import type { db as dbType } from './driver.ts'
import { guestBook } from './schema.ts'

export async function seedDatabase(db: typeof dbType) {
  let guestBookCount = await db.count(guestBook)
  if (guestBookCount === 0) {
    await db.createMany(guestBook, [
      { name: 'Alice' },
      {
        name: 'Bob',
      },
    ])
  }
}
