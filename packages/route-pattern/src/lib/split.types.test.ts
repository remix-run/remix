import type { Split } from './split.ts'
import type { Assert, IsEqual } from './type-utils.d.ts'

// prettier-ignore
export type Tests = [
  // should parse pathname only patterns
  Assert<IsEqual<
    Split<'path/:id'>,
    { pathname: 'path/:id' }
  >>,

  // should parse pathname with search
  Assert<IsEqual<
    Split<'path/:id?q=1'>,
    { pathname: 'path/:id'; search: 'q=1' }
  >>,

  // should parse protocol + hostname
  Assert<IsEqual<
    Split<'http(s)://remix.run'>,
    { protocol: 'http(s)'; hostname: 'remix.run' }
  >>,

  // should not treat trailing ":tld" in hostname as a port
  Assert<IsEqual<
    Split<'http://remix.run.:tld/path/:id'>,
    { protocol: 'http'; hostname: 'remix.run.:tld'; pathname: 'path/:id' }
  >>,

  // should detect numeric port at end of host
  Assert<IsEqual<
    Split<'http://remix.run:8080/path/:id'>,
    { protocol: 'http'; hostname: 'remix.run'; port: '8080'; pathname: 'path/:id' }
  >>,

  // should detect numeric port without pathname
  Assert<IsEqual<
    Split<'http://remix.run:3000'>,
    { protocol: 'http'; hostname: 'remix.run'; port: '3000' }
  >>,

  // should allow host to contain other variables
  Assert<IsEqual<
    Split<'http://:sub.remix.run:8080/path/:id'>,
    { protocol: 'http'; hostname: ':sub.remix.run'; port: '8080'; pathname: 'path/:id' }
  >>,
]
