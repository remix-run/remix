import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function dataAndValidationHandler({ render, request }: AppContext) {
  return render(<DataAndValidationPage requestUrl={request.url} />, docsResponseInit)
}

function DataAndValidationPage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 7"
      title="Data and Validation"
      description="How Remix validates trust boundaries and carries typed values into persistence."
      previous={{ href: routes.docs.animation.href(), title: 'Animation' }}
      next={{
        href: routes.docs.formsAndMutations.href(),
        title: 'Forms and Mutations',
      }}
    >
      <DocsSection id="validating-trust-boundaries" title="Validating trust boundaries">
        <p>Placeholder for Validating trust boundaries.</p>
      </DocsSection>

      <DocsSection id="remix-data-schema" title="remix/data-schema">
        <p>Placeholder for remix/data-schema.</p>
      </DocsSection>

      <DocsSection
        id="form-parsing-with-remix-data-schema-form-data"
        title="Form parsing with remix/data-schema/form-data"
      >
        <p>Placeholder for Form parsing with remix/data-schema/form-data.</p>
      </DocsSection>

      <DocsSection id="coercion-and-checks" title="Coercion and checks">
        <p>Placeholder for Coercion and checks.</p>
      </DocsSection>

      <DocsSection id="tables-with-remix-data-table" title="Tables with remix/data-table">
        <p>Placeholder for Tables with remix/data-table.</p>
      </DocsSection>

      <DocsSection id="queries-and-crud-helpers" title="Queries and CRUD helpers">
        <p>Placeholder for Queries and CRUD helpers.</p>
      </DocsSection>

      <DocsSection id="transactions" title="Transactions">
        <p>Placeholder for Transactions.</p>
      </DocsSection>

      <DocsSection id="migrations" title="Migrations">
        <p>Placeholder for Migrations.</p>
      </DocsSection>

      <DocsSection
        id="sqlite-postgres-and-mysql-adapters"
        title="SQLite, Postgres, and MySQL adapters"
      >
        <p>Placeholder for SQLite, Postgres, and MySQL adapters.</p>
      </DocsSection>

      <DocsSection id="request-scoped-database-access" title="Request-scoped database access">
        <p>Placeholder for Request-scoped database access.</p>
      </DocsSection>
    </DocsChapter>
  )
}
