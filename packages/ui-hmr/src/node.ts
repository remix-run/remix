import { registerHooks } from 'node:module'

import { createServerUiHmrModuleHooks } from './lib/loaders.ts'

registerHooks(createServerUiHmrModuleHooks())
