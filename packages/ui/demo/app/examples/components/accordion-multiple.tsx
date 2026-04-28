// @jsxRuntime classic
// @jsx createElement
import { createElement, css } from 'remix/ui'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@remix-run/ui/accordion'
import { theme } from '@remix-run/ui/theme'
let accordionBodyTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

export default function example() {
  return () => (
    <Accordion defaultValue={['api', 'alerts']} type="multiple">
      <AccordionItem value="api">
        <AccordionTrigger>API status checks</AccordionTrigger>
        <AccordionContent>
          <p mix={accordionBodyTextCss}>
            Multiple mode works well for operational checklists and dashboards where several
            sections often need to stay open together.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem disabled value="access">
        <AccordionTrigger>Access control sync</AccordionTrigger>
        <AccordionContent>
          <p mix={accordionBodyTextCss}>
            This section is intentionally disabled to show how one unavailable item should read
            inside an otherwise active list.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="alerts">
        <AccordionTrigger>Alert routing</AccordionTrigger>
        <AccordionContent>
          <p mix={accordionBodyTextCss}>
            Disabled items should feel clearly unavailable without changing the overall visual model
            of the disclosure list.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
