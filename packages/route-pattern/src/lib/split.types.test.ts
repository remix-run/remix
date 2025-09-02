import type { Split } from './split.types.ts'
import type { Assert, IsEqual } from './type-utils'

// prettier-ignore
export type Tests = [
  // should not treat trailing ":tld" in hostname as a port
  Assert<IsEqual<
    Split<'http://host.com.:tld/path/:id'>,
    { protocol: 'http'; hostname: 'host.com.:tld'; pathname: 'path/:id' }
  >>,

  // should detect numeric port at end of host
  Assert<IsEqual<
    Split<'http://host.com:8080/path/:id'>,
    { protocol: 'http'; hostname: 'host.com'; port: '8080'; pathname: 'path/:id' }
  >>,

  // should detect numeric port without pathname
  Assert<IsEqual<
    Split<'http://host.com:3000'>,
    { protocol: 'http'; hostname: 'host.com'; port: '3000' }
  >>,

  // should allow host to contain other variables
  Assert<IsEqual<
    Split<'http://:sub.host.com:8080/path/:id'>,
    { protocol: 'http'; hostname: ':sub.host.com'; port: '8080'; pathname: 'path/:id' }
  >>,
]
