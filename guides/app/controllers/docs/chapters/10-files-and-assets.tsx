import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function filesAndAssetsHandler({ render, request }: AppContext) {
  return render(<FilesAndAssetsPage requestUrl={request.url} />, docsResponseInit)
}

function FilesAndAssetsPage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 10"
      title="Files and Assets"
      description="How Remix serves static files, browser modules, uploads, downloads, and source assets."
      previous={{
        href: routes.docs.authSessionsSecurity.href(),
        title: 'Auth, Sessions, and Security',
      }}
      next={{ href: routes.docs.testing.href(), title: 'Testing' }}
    >
      <DocsSection
        id="static-files-vs-source-served-assets"
        title="Static files vs source-served assets"
      >
        <p>Placeholder for Static files vs source-served assets.</p>
      </DocsSection>

      <DocsSection id="remix-s-unbundled-asset-server" title="Remix's unbundled asset server">
        <p>Placeholder for Remix's unbundled asset server.</p>
      </DocsSection>

      <DocsSection
        id="file-maps-allow-and-deny-rules-and-browser-only-modules"
        title="File maps, allow and deny rules, and browser-only modules"
      >
        <p>Placeholder for File maps, allow and deny rules, and browser-only modules.</p>
      </DocsSection>

      <DocsSection
        id="client-entry-hrefs-and-module-preloads"
        title="Client entry hrefs and module preloads"
      >
        <p>Placeholder for Client entry hrefs and module preloads.</p>
      </DocsSection>

      <DocsSection
        id="fingerprinting-source-maps-minification"
        title="Fingerprinting, source maps, minification"
      >
        <p>Placeholder for Fingerprinting, source maps, minification.</p>
      </DocsSection>

      <DocsSection id="file-uploads" title="File uploads">
        <p>Placeholder for File uploads.</p>
      </DocsSection>

      <DocsSection id="multipart-parsing" title="Multipart parsing">
        <p>Placeholder for Multipart parsing.</p>
      </DocsSection>

      <DocsSection
        id="file-storage-memory-filesystem-s3"
        title="File storage: memory, filesystem, S3"
      >
        <p>Placeholder for File storage: memory, filesystem, S3.</p>
      </DocsSection>

      <DocsSection
        id="file-downloads-lazy-files-mime-types-and-range-responses"
        title="File downloads, lazy files, MIME types, and range responses"
      >
        <p>Placeholder for File downloads, lazy files, MIME types, and range responses.</p>
      </DocsSection>
    </DocsChapter>
  )
}
