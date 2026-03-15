// @jsxRuntime classic
// @jsx createElement
import { createElement, css } from 'remix/component'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ui,
} from 'remix/ui'
import { accordionExampleFrameCss } from '../ui-recipes/shared.ts'

let accordionBodyTextCss = css({
  margin: 0,
})

export default function example() {
  return () => (
    <div mix={accordionExampleFrameCss}>
      <Accordion defaultValue={['api', 'alerts']} type="multiple">
        <AccordionItem value="api">
          <AccordionTrigger>API status checks</AccordionTrigger>
          <AccordionContent>
            <p mix={[ui.text.bodySm, accordionBodyTextCss]}>
              Multiple mode works well for operational checklists and dashboards where several
              sections often need to stay open together.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem disabled value="access">
          <AccordionTrigger>Access control sync</AccordionTrigger>
          <AccordionContent>
            <p mix={[ui.text.bodySm, accordionBodyTextCss]}>
              This section is intentionally disabled to show how one unavailable item should read
              inside an otherwise active list.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="alerts">
          <AccordionTrigger>Alert routing</AccordionTrigger>
          <AccordionContent>
            <p mix={[ui.text.bodySm, accordionBodyTextCss]}>
              Disabled items should feel clearly unavailable without changing the overall visual model
              of the disclosure list.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
