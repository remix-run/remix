import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Form',
  slug: 'form',
  category: 'patterns',
  description: 'Schema-backed native form validation with application-owned markup.',
  importPath: '@remix-run/ui/form',
} satisfies PageMeta

const basic = await loadExample('form/basic')

const handlerCode = await highlightSource(
  'let submission = fd.parseSafe(Contact, await request.formData())\nif (!submission.success) {\n  return render(<ContactForm submission={submission} />, { status: 400 })\n}\nawait saveContact(submission.value)',
)

const fieldBindingCode = await highlightSource(`
export interface FieldBinding<kind extends string = FormFieldKind | 'fields' | 'file' | 'files'> {
  readonly kind: kind
  readonly name: string
  readonly id: string
  readonly errorId: string
  readonly errors: ReadonlyArray<string>
  readonly touched: boolean
  setCustomErrors(messages: ReadonlyArray<string>): void
}
`)

export default function FormPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <p>
          Define a submission schema with the experimental{' '}
          <code>remix/data-schema/experimental/form</code> API. Its field kinds describe how browser
          values are decoded. Pass the same schema to <code>form.Context</code>
          and parse submitted <code>FormData</code> in the handler.
        </p>
      </Section>
      <Section id="submissions" title="Server submissions">
        <p>
          Call <code>fd.parseSafe(schema, data)</code> in the handler. Success contains the
          validated value. Pass a failed submission back to Context to restore non-sensitive values
          and show field or form errors. Sensitive fields and files are never restored. Passwords
          are always sensitive; other scalar fields can use the <code>sensitive: true</code> option.
          Use the same submission shape for application errors such as an email address already in
          use.
        </p>
        <CodeBlock html={handlerCode} />
      </Section>
      <Section id="feedback" title="Client feedback">
        <p>
          Controls use native constraints where available and run schema validation for additional
          rules. Errors appear after blur or a blocked submission, then update while editing. Read
          each binding’s <code>errors</code> and <code>touched</code> during rendering. Use{' '}
          <code>setCustomErrors()</code> for supplemental asynchronous feedback. The application
          owns the request, cancellation, and server check.
        </p>
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Author labels, help text, error content, and roles in your markup. The label and error
          mixins supply scoped IDs. A control gets <code>aria-invalid</code> and an error reference
          when feedback is visible. Existing <code>aria-describedby</code> help text is retained.
          Keep each Context ID unique when rendering multiple forms. Radio and checkbox-group
          options share one field binding; group them with a fieldset and legend, and pass the
          option value to <code>label(field, value)</code> for distinct label associations.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="context-reference">Context</h3>
        <p>
          Owns one form instance and calls its render prop with stable typed <code>fields</code> and
          current grouped <code>errors</code>. A changed schema requires a new keyed Context.
        </p>
        <ApiTable id="context-props" label="Prop">
          <ApiEntry name="schema" type="FormSchema" required>
            Inspectable object from <code>fd.object()</code>, shared with server parsing.
          </ApiEntry>
          <ApiEntry name="children" type="({ fields, errors }) => RemixNode" required>
            Renders application-owned form markup. <code>errors.form</code> is absent when there are
            no form-level messages.
          </ApiEntry>
          <ApiEntry name="submission" type="FormSubmission">
            A new submission object refreshes errors and failed values. Reuse its identity until a
            new result arrives.
          </ApiEntry>
          <ApiEntry name="id" type="string">
            Unique scope for control and error IDs. Pass a client entry’s <code>handle.id</code> to
            preserve IDs during hydration.
          </ApiEntry>
        </ApiTable>
        <h3 id="root-reference">root()</h3>
        <p>
          Apply to the native form inside Context. Coordinates invalid feedback for unmanaged
          controls without intercepting submission.
        </p>
        <h3 id="control-reference">control(field)</h3>
        <p>
          Apply to an input, select, or textarea. Supplies constraints, restored defaults, native
          validity, touched state, and error associations. Compatible authored control props win.
          Use text entries for string controls, number entries for number/range inputs, and file
          entries for uploads. <code>fd.fields</code> supports multiple selects and checkbox groups;
          empty selections are <code>[]</code>.
        </p>
        <h3 id="label-reference">label(field, value?)</h3>
        <p>
          Apply to a label to associate it with the field’s scoped control ID. Pass the option value
          for a radio or grouped checkbox label.
        </p>
        <h3 id="error-reference">error(field)</h3>
        <p>Apply to an application-owned error element to give it the field’s error ID.</p>
        <h3 id="constraints-reference">getConstraints(schema, options)</h3>
        <p>
          Returns constraints supported by the native control for a custom integration. Pass its
          native type in <code>options.type</code> and <code>multiple: true</code> for collections.
          Recognized constraints include required, minimum and maximum length or value, and a
          numeric step. Date/time bounds remain authored props; hidden and action inputs receive no
          constraints.
        </p>
        <h3 id="validation-listener-reference">onInputValidation(handler, captureBoolean?)</h3>
        <p>
          Listens for bubbling validation notifications. The handler receives an{' '}
          <code>InputValidationEvent</code> and an abort signal.
        </p>
        <h3 id="validation-event-reference">InputValidationEvent</h3>
        <p>
          Provides the logical <code>field</code>, scoped <code>errorId</code>, visible
          <code>errors</code>, and <code>touched</code> state.
        </p>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="form-types">
          <ApiEntry id="type-FieldBinding" name="FieldBinding" type="interface">
            <p>Pass live field references through child-component props.</p>
            <CodeBlock html={fieldBindingCode} />
          </ApiEntry>
        </ApiTable>
        <p>
          <code>FieldBindings</code> retains each entry’s kind. Context and constraint options use
          <code>FormContextProps</code>, <code>FormContextValue</code>,{' '}
          <code>SchemaConstraints</code>, and <code>GetConstraintsOptions</code>; notifications use{' '}
          <code>InputValidationState</code>.
        </p>
      </Section>
    </PageLayout>
  )
}
