import { pageSummaries } from '../data/pages.ts'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'

export function SitemapPage() {
  return () => (
    <Document title="Sitemap" description="Browse the pages in the Shopify demo.">
      <section class="section-space sitemap-section container">
        <p class="eyebrow">Find your next stop</p>
        <h1>
          All the ways
          <br />
          to build.
        </h1>
        <ul class="sitemap-links">
          <li>
            <a href={routes.home.href()}>Home →</a>
          </li>
          {Object.values(pageSummaries).map((page) => (
            <li key={page.path}>
              <a href={page.path}>{page.label} →</a>
            </li>
          ))}
        </ul>
      </section>
    </Document>
  )
}
