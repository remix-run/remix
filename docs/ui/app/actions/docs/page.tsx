import { unsafeHTML } from 'remix/component'
import type { Handle } from 'remix/component'
import type { UiDocs } from '../../../../../packages/ui/src/docs/types.ts'
import type { LoadedExample, LoadedSection } from '../../data/examples.tsx'
import { Example } from './example.tsx'

export function FeaturePage(
  handle: Handle<{ page: UiDocs; examples: LoadedExample[]; sections: LoadedSection[] }>,
) {
  return () => {
    let { page, examples, sections } = handle.props
    return (
      <>
        <header class="ui-page-header">
          <p class="ui-eyebrow">{page.category === 'primitives' ? 'Primitives' : 'Animation'}</p>
          <h1 class="rmx-page-title">{page.title}</h1>
          <p class="ui-description">{page.description}</p>
          <code class="ui-import">{page.importPath}</code>
        </header>
        {examples
          .filter((example) => !example.definition.section)
          .map((example) => (
            <Example key={example.definition.id} example={example} />
          ))}
        {sections.map(({ definition: section, codeHtml }) => {
          let sectionExamples = examples.filter(
            (example) => example.definition.section === section.id,
          )
          return (
            <section key={section.id} id={section.id} class="ui-doc-section">
              <h2>{section.title}</h2>
              {section.content()}
              {codeHtml.map((html, index) => (
                <div key={index} data-code-block innerHTML={unsafeHTML(html)} />
              ))}
              {sectionExamples.map((example) => (
                <Example
                  key={example.definition.id}
                  example={example}
                  showHeading={sectionExamples.length > 1}
                />
              ))}
            </section>
          )
        })}
        <aside class="ui-reference-link">
          <p>
            <a href={`https://api.remix.run/${page.importPath.replace(/^@/, '')}`}>
              Generated API documentation
            </a>
          </p>
        </aside>
      </>
    )
  }
}
