import { column as c, table } from 'remix/data-table'
import type { TableRow } from 'remix/data-table'

export const users = table({
  name: 'users',
  columns: {
    // A random UUID. It doubles as the WebAuthn user handle that authenticators store with each
    // passkey, so it must never contain personal data such as an email address.
    id: c.text().primaryKey(),
    username: c.text().notNull().unique(),
    created_at: c.integer().notNull(),
  },
})

export const passkeys = table({
  name: 'passkeys',
  columns: {
    // The base64url credential id the browser sends back on every sign-in.
    id: c.text().primaryKey(),
    user_id: c
      .text()
      .notNull()
      .references('users', 'id', 'passkeys_user_id_fk')
      .onDelete('cascade'),
    public_key: c.text().notNull(),
    algorithm: c.integer().notNull(),
    sign_count: c.integer().notNull(),
    transports: c.json().nullable(),
    backup_eligible: c.boolean().notNull(),
    backed_up: c.boolean().notNull(),
    aaguid: c.text().notNull(),
    created_at: c.integer().notNull(),
    last_used_at: c.integer().nullable(),
  },
})

export type User = TableRow<typeof users>
export type Passkey = TableRow<typeof passkeys>
