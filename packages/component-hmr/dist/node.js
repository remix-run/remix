import { registerHooks } from 'node:module';
import { createServerComponentHmrModuleHooks } from './lib/loaders.js';
registerHooks(createServerComponentHmrModuleHooks());
