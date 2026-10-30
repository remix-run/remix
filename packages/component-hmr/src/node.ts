import { registerHooks } from 'node:module'

import { createServerComponentHmrModuleHooks } from './lib/loaders.ts'

registerHooks(createServerComponentHmrModuleHooks())
