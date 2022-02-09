import { MikroORM } from '@mikro-orm/core'

import config from '../mikro-orm.config'

let mikroORMInstance: MikroORM

export default async function ensureORM() {
  if (process.env.NODE_ENV === 'production') {
    mikroORMInstance = await MikroORM.init(config)
  } else {
    const globalWithMikroORM = global as typeof globalThis & {
      mikroORMInstance: MikroORM
    }

    if (!globalWithMikroORM.mikroORMInstance) {
      globalWithMikroORM.mikroORMInstance = await MikroORM.init(config)
    }

    mikroORMInstance = globalWithMikroORM.mikroORMInstance
  }

  return mikroORMInstance
}
