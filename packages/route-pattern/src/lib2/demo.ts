import { TrieMatcher } from './matchers/trie.ts'
import { parse } from './route-pattern/index.ts'

// ============================================================================
// Demo: TrieMatcher Pattern Matching with Ranking
// ============================================================================
// This demo shows how the TrieMatcher handles multiple patterns, including
// cases where several patterns could match the same URL. The matcher uses
// a ranking system to pick the "best" match:
//   - Static segments beat dynamic segments
//   - Dynamic segments beat wildcards
//   - More specific patterns beat less specific ones
// ============================================================================

type RouteData = { name: string; pattern: string }

let matcher = new TrieMatcher<RouteData>()

function addRoute(pattern: string, name: string) {
  matcher.add(parse(pattern), { name, pattern })
}

// ----------------------------------------------------------------------------
// Simple patterns
// ----------------------------------------------------------------------------
addRoute('about', 'About')
addRoute('users', 'User List')
addRoute('users/:id', 'User Profile')
addRoute('users/:id/posts', 'User Posts')
addRoute('users/:id/posts/:postId', 'Single Post')

// ----------------------------------------------------------------------------
// Optional segments (generates multiple variants internally)
// ----------------------------------------------------------------------------
addRoute('docs(/:lang)(/:version)', 'Docs')
addRoute('api(/v:major(.:minor))/status', 'API Status')

// ----------------------------------------------------------------------------
// Wildcards
// ----------------------------------------------------------------------------
addRoute('files/*path', 'File Browser')
addRoute('assets/images/*rest', 'Image Assets')
addRoute('*catchall', 'Catch-All')

// ----------------------------------------------------------------------------
// Full URL patterns (protocol + hostname)
// ----------------------------------------------------------------------------
addRoute('https://api.example.com/*path', 'API Subdomain')
addRoute('://admin.example.com/dashboard', 'Admin Dashboard')
addRoute('://:tenant.myapp.com/settings', 'Tenant Settings')

// ----------------------------------------------------------------------------
// Pathological / Advanced patterns
// ----------------------------------------------------------------------------
addRoute('blog/:year-:month-:day/:slug', 'Blog Post by Date')
addRoute('org/:orgId/*path/settings', 'Org Settings Deep')
addRoute('assets/:name.png', 'PNG Asset')
addRoute('assets/:name.:ext', 'Any Asset')

// ============================================================================
// Test URLs
// ============================================================================

let testCases: Array<{ url: string; description: string }> = [
  // Simple static and dynamic
  { url: 'https://example.com/about', description: 'Static path' },
  { url: 'https://example.com/users/123', description: 'Dynamic param' },
  { url: 'https://example.com/users/123/posts/456', description: 'Nested dynamic params' },

  // Optional segments (demonstrating variant matching)
  { url: 'https://example.com/docs', description: 'Docs without optionals' },
  { url: 'https://example.com/docs/en', description: 'Docs with lang' },
  { url: 'https://example.com/docs/en/v2', description: 'Docs with lang and version' },
  { url: 'https://example.com/api/status', description: 'API status without version' },
  { url: 'https://example.com/api/v2/status', description: 'API status with major version' },
  { url: 'https://example.com/api/v2.1/status', description: 'API status with major.minor' },

  // Wildcards
  { url: 'https://example.com/files/documents/report.pdf', description: 'Wildcard path' },
  { url: 'https://example.com/unknown/deeply/nested/path', description: 'Catch-all fallback' },

  // Full URL patterns
  { url: 'https://api.example.com/v1/users', description: 'API subdomain match' },
  { url: 'https://admin.example.com/dashboard', description: 'Admin dashboard (any protocol)' },
  { url: 'https://acme.myapp.com/settings', description: 'Tenant settings with dynamic subdomain' },

  // Pathological patterns - demonstrating ranking
  { url: 'https://example.com/blog/2024-12-15/hello-world', description: 'Blog date pattern' },
  { url: 'https://example.com/org/acme/projects/web/settings', description: 'Deep org settings' },

  // Ranking demonstration: static vs dynamic in same segment
  { url: 'https://example.com/assets/logo.png', description: 'PNG vs generic asset (PNG wins)' },
  { url: 'https://example.com/assets/photo.jpg', description: 'JPG matches generic asset pattern' },

  // Ranking: more specific wildcards beat less specific
  {
    url: 'https://example.com/assets/images/photo/gallery',
    description: 'Image wildcard vs catch-all',
  },
]

// ============================================================================
// Run the demo
// ============================================================================

console.log('='.repeat(80))
console.log('TrieMatcher Demo')
console.log('='.repeat(80))
console.log()
console.log(`Loaded ${matcher.size} patterns`)
console.log()

for (let { url, description } of testCases) {
  console.log('-'.repeat(80))
  console.log(`📍 ${description}`)
  console.log(`   URL: ${url}`)

  let result = matcher.match(new URL(url))

  if (result) {
    console.log(`   ✅ Matched: "${result.data.name}"`)
    console.log(`   🔗 Pattern: ${result.data.pattern}`)
    if (Object.keys(result.params).length > 0) {
      console.log(`   📦 Params:`, result.params)
    }
  } else {
    console.log(`   ❌ No match`)
  }
  console.log()
}

console.log('='.repeat(80))
console.log('Demo complete!')
console.log('='.repeat(80))
