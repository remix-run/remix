import { registerHooks } from 'node:module'
import * as process from 'node:process'

import { load } from './lib/loader.ts'

process.setSourceMapsEnabled(true)
registerHooks({ load })

export {}
