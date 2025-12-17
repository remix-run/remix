import * as fs from 'node:fs'
import * as path from 'node:path'
import { mock } from 'node:test'

let fixturesDir = path.join(import.meta.dirname, 'fixtures')

interface MockResponse {
  status: number
  body: Uint8Array | string | object
  headers?: Record<string, string>
}

type FetchMockHandler = (url: string, init?: RequestInit) => MockResponse | null

let mockHandlers: FetchMockHandler[] = []

function createMockResponse(mockResponse: MockResponse): Response {
  let body: BodyInit
  let headers = new Headers(mockResponse.headers)

  if (mockResponse.body instanceof Uint8Array) {
    body = mockResponse.body as BodyInit
  } else if (typeof mockResponse.body === 'object') {
    body = JSON.stringify(mockResponse.body)
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
  } else {
    body = mockResponse.body
  }

  return new Response(body, {
    status: mockResponse.status,
    headers,
  })
}

function mockedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

  for (let handler of mockHandlers) {
    let result = handler(url, init)
    if (result) {
      return Promise.resolve(createMockResponse(result))
    }
  }

  // No handler matched - return 404
  return Promise.resolve(new Response('Not Found', { status: 404 }))
}

/**
 * Install the fetch mock. Call this in a before() hook.
 */
export function installFetchMock(): void {
  mock.method(globalThis, 'fetch', mockedFetch)
}

/**
 * Restore the original fetch. Call this in an after() hook.
 */
export function restoreFetchMock(): void {
  mock.reset()
  mockHandlers = []
}

/**
 * Add a mock handler for fetch requests.
 */
export function addFetchHandler(handler: FetchMockHandler): void {
  mockHandlers.push(handler)
}

/**
 * Clear all fetch handlers.
 */
export function clearFetchHandlers(): void {
  mockHandlers = []
}

/**
 * Load a fixture file as a Uint8Array.
 */
export function loadFixture(filename: string): Uint8Array {
  let filePath = path.join(fixturesDir, filename)
  return new Uint8Array(fs.readFileSync(filePath))
}

/**
 * Load a fixture file as JSON.
 */
export function loadFixtureJson<T = unknown>(filename: string): T {
  let filePath = path.join(fixturesDir, filename)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

/**
 * Create a mock handler for npm registry requests using fixture files.
 */
export function createNpmRegistryMock(
  packages: Record<string, { metadata: string; tarballs: Record<string, string> }>,
): FetchMockHandler {
  return (url: string) => {
    // Check for package metadata requests
    for (let [packageName, config] of Object.entries(packages)) {
      let metadataUrl = `https://registry.npmjs.org/${packageName}`
      if (url === metadataUrl) {
        return {
          status: 200,
          body: loadFixtureJson(config.metadata),
        }
      }

      // Check for tarball requests
      for (let [version, tarballFile] of Object.entries(config.tarballs)) {
        let tarballUrl = `https://registry.npmjs.org/${packageName}/-/${packageName.replace(/^@.*\//, '')}-${version}.tgz`
        if (url === tarballUrl) {
          return {
            status: 200,
            body: loadFixture(tarballFile),
            headers: { 'Content-Type': 'application/gzip' },
          }
        }
      }
    }

    // Return 404 for non-existent packages on npm registry
    if (url.startsWith('https://registry.npmjs.org/')) {
      return {
        status: 404,
        body: { error: 'Not found' },
      }
    }

    return null
  }
}
