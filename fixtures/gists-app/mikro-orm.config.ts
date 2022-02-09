import type { Connection, IDatabaseDriver, Options } from '@mikro-orm/core'
import invariant from 'tiny-invariant'

import { Post } from '~/entities/Post'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const clientUrl = process.env.DATABASE_URL
invariant(clientUrl, 'Environment variable DATABASE_URL is not set')

const config: Options<IDatabaseDriver<Connection>> = {
  type: 'postgresql',
  entities: [Post],
  clientUrl: process.env.DATABASE_URL,
  debug: process.env.NODE_ENV !== 'production',
  driverOptions: {
    wrap: false,
    rejectUnauthorized: false,
    connection: {
      ssl: true,
    },
  },
  migrations: {
    allOrNothing: true,
    disableForeignKeys: false,
    emit: 'ts',
    transactional: true,
  },
}

export default config
