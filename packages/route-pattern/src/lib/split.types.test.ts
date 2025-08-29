import type { Split } from './split.types.ts'
import type { Assert, IsEqual } from './test.d.ts'

// should not treat trailing ":tld" in hostname as a port
type Case1 = Split<'http://host.com.:tld/path/:id'>
type _assert1 = Assert<
  IsEqual<Case1, { protocol: 'http'; hostname: 'host.com.:tld'; pathname: 'path/:id' }>
>

// should detect numeric port at end of host
type Case2 = Split<'http://host.com:8080/path/:id'>
type _assert2 = Assert<
  IsEqual<Case2, { protocol: 'http'; hostname: 'host.com'; port: '8080'; pathname: 'path/:id' }>
>

// should detect numeric port without pathname
type Case3 = Split<'http://host.com:3000'>
type _assert3 = Assert<IsEqual<Case3, { protocol: 'http'; hostname: 'host.com'; port: '3000' }>>

// should allow host to contain other variables
type Case4 = Split<'http://:sub.host.com:8080/path/:id'>
type _assert4 = Assert<
  IsEqual<
    Case4,
    { protocol: 'http'; hostname: ':sub.host.com'; port: '8080'; pathname: 'path/:id' }
  >
>

export {}
