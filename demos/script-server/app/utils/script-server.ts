import * as path from 'node:path'
import { createScriptServer } from 'remix/script-server'

let isDevelopment = process.env.NODE_ENV === 'development'

export let scriptServer = createScriptServer({
  allow: ['app/client/**'],
  root: path.resolve(import.meta.dirname, '../..'),
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/client/*path' }],
  watch: isDevelopment,
})
