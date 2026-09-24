import { registerHooks } from 'node:module';
import { createServerUiHmrModuleHooks } from './lib/loaders.js';
registerHooks(createServerUiHmrModuleHooks());
