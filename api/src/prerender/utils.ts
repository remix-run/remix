import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { parse } from './html-parser.ts'

const SCRIPT_FILE_EXT = /\.(?:tsx?|jsx|mts)$/
const SCRIPT_EXT_IN_PATH = /\.(?:tsx?|jsx|mts)(?=[?#]|$)/
const SCRIPT_EXT_IN_JS_IMPORT = /\.(?:tsx?|jsx|mts)(?=["'?#])/g

export async function writeResult(
  outputDir: string,
  pathname: string,
  filepath: string,
  response: Response,
) {
  if (response.status === 204) {
    console.warn(`Skipped ${pathname}: 204 No Content`)
    return
  }

  let outputFilepath = SCRIPT_FILE_EXT.test(filepath)
    ? filepath.replace(SCRIPT_FILE_EXT, '.js')
    : filepath
  let outputPath = path.join(outputDir, outputFilepath)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  let contentType = response.headers.get('Content-Type')

  if (contentType?.includes('text/html')) {
    let html = await response.text()
    // Update script references for static HTML hosting.
    let updated = rewriteExtensionsToJs(html)
    await fs.writeFile(outputPath, updated, 'utf-8')
  } else if (SCRIPT_FILE_EXT.test(filepath)) {
    let content = await response.text()
    // Write all script files to disk as JS files
    await fs.writeFile(outputPath, content.replace(SCRIPT_EXT_IN_JS_IMPORT, '.js'), 'utf-8')
  } else {
    await fs.writeFile(outputPath, new Uint8Array(await response.arrayBuffer()))
  }

  console.log(`Crawled ${pathname} -> ./${path.relative(process.cwd(), outputPath)}`)
}

export function rewriteExtensionsToJs(html: string): string {
  // Parse and rewrite *only* link/script asset attributes, plus inline
  // <script> bodies (clientEntry's hydration JSON carries module URLs as
  // `"moduleUrl":"/assets/.../foo.tsx"` strings). A regex over the whole
  // document would also hit the `View Source` <a href> on
  // github.com/.../basic.demo.tsx and code examples inside <pre>/<code>
  // blocks.
  //
  // Preserve comments so Remix UI's hydration markers (`<!-- rmx:h:* -->`,
  // `<!-- /rmx:h -->`, `<!-- rmx:flush document -->`) survive the
  // parse/serialize round-trip. Without them, frame navigation fails with
  // a "Can't insert an element before a doctype" HierarchyRequestError.
  let dom = parse(html, { comment: true })
  let changed = false

  for (let el of dom.elements) {
    if (el.name === 'script') {
      let src = el.getAttribute('src')
      if (src) {
        let next = src.replace(SCRIPT_EXT_IN_PATH, '.js')
        if (next !== src) {
          el.setAttribute('src', next)
          changed = true
        }
        continue
      }

      let body = el.innerHTML
      let next = body.replace(SCRIPT_EXT_IN_JS_IMPORT, '.js')
      if (next !== body) {
        el.innerHTML = next
        changed = true
      }
      continue
    }

    if (el.name === 'link') {
      let href = el.getAttribute('href')
      if (!href) continue

      let next = href.replace(SCRIPT_EXT_IN_PATH, '.js')
      if (next === href) continue

      el.setAttribute('href', next)
      changed = true
    }
  }

  return changed ? dom.toString() : html
}
