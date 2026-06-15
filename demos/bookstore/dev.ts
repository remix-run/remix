import { run } from 'remix/node-hmr'

run('server.ts', {
  nodeArgs: ['--import', 'remix/node-tsx'],
  browserEventChannel: true,
})
