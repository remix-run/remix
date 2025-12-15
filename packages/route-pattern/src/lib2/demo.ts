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
addRoute('users/:id', 'User Profile')

// ----------------------------------------------------------------------------
// Optional segments (generates multiple variants internally)
// ----------------------------------------------------------------------------
addRoute('api(/v:major(.:minor))/status', 'API Status')

// ----------------------------------------------------------------------------
// Wildcards
// ----------------------------------------------------------------------------
addRoute('*catchall', 'Catch-All')

// ----------------------------------------------------------------------------
// Pathological / Advanced patterns
// ----------------------------------------------------------------------------
addRoute('assets/:name.png', 'PNG Asset')
addRoute('assets/:name.:ext', 'Any Asset')

// ----------------------------------------------------------------------------
// Many overlapping patterns (for ranking demo)
// ----------------------------------------------------------------------------
addRoute('files/report-2024/summary', 'Exact Match')
addRoute('files/report-:year/summary', 'Inline Variable')
addRoute('files/:folder/summary', 'Dynamic Folder')
addRoute('files/:folder/:page', 'Dynamic Folder + Page')
addRoute('files/*path', 'Files Wildcard')

// ============================================================================
// Test URLs
// ============================================================================

let testCases: Array<{ url: string; description: string }> = [
  // Simple examples
  { url: 'https://example.com/about', description: 'Static path' },
  { url: 'https://example.com/users/123', description: 'Dynamic param' },

  // Interesting examples showing ranking (3+ matches each)
  {
    url: 'https://example.com/api/v2.1/status',
    description: 'Optional segments: same pattern matches twice with different params',
  },
  {
    url: 'https://example.com/assets/logo.png',
    description: 'Specificity: static suffix beats dynamic suffix',
  },
  {
    url: 'https://example.com/files/report-2024/summary',
    description: 'Many matches: static > inline var > full var > wildcard',
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

  let results = matcher.matchAll(new URL(url))

  if (results.length === 0) {
    console.log(`   ❌ No match`)
    console.log()
  } else {
    console.log(
      `   Found ${results.length} match${results.length > 1 ? 'es' : ''} (ranked best to worst):`,
    )
    console.log()
    results.forEach((result, i) => {
      let prefix = i === 0 ? '✅' : '  '
      console.log(`   ${prefix} ${i + 1}. "${result.data.name}"`)
      console.log(`         Pattern: ${result.data.pattern}`)
      let paramEntries = Object.entries(result.params).filter(([, v]) => v !== undefined)
      if (paramEntries.length > 0) {
        console.log(`         Params:`, Object.fromEntries(paramEntries))
      }
      console.log()
    })
  }
}

console.log('='.repeat(80))
console.log('Demo complete!')
console.log('='.repeat(80))
