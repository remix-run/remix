import { get, route } from 'remix'

export let routes = route({
  // Home page with instructions
  home: get('/'),

  // Package browser - handles all package paths
  // Examples:
  //   /lodash
  //   /lodash@4.17.21
  //   /lodash@4.17.21/package.json
  //   /@remix-run/cookie
  //   /@remix-run/cookie@1.0.0/src/index.ts
  browse: get('/*path'),
})
