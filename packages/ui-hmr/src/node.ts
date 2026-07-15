import { registerHooks } from 'node:module'

import { createServerUiHmrModuleHooks } from './lib/module-hooks.ts'

registerHooks(createServerUiHmrModuleHooks())
