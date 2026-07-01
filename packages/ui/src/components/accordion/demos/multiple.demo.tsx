import { css } from '@remix-run/ui'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@remix-run/ui/components/accordion'

/**
 * @order 2
 * @name Accordion Multiple Open
 * @description Multiple mode allows several sections to stay open simultaneously, useful for operational checklists and dashboards.
 * @layout center
 */
export default function Example() {
  return () => (
    <Accordion defaultValue={['api', 'alerts']} type="multiple">
      <AccordionItem value="api">
        <AccordionTrigger>API status checks</AccordionTrigger>
        <AccordionContent>
          <p mix={bodyTextCss}>
            Multiple mode works well for operational checklists and dashboards where several
            sections often need to stay open together.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem disabled value="access">
        <AccordionTrigger>Access control sync</AccordionTrigger>
        <AccordionContent>
          <p mix={bodyTextCss}>
            This section is intentionally disabled to show how one unavailable item should read
            inside an otherwise active list.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="alerts">
        <AccordionTrigger>Alert routing</AccordionTrigger>
        <AccordionContent>
          <p mix={bodyTextCss}>
            Disabled items should feel clearly unavailable without changing the overall visual model
            of the disclosure list.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

const bodyTextCss = css({
  margin: 0,
  fontSize: '13px',
  lineHeight: '1.65',
  color: '#4f4f4f',
})
