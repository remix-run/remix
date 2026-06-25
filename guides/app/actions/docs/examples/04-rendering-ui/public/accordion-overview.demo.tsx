import { css } from 'remix/ui'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from 'remix/components/accordion'

export function AccordionOverview() {
  return () => (
    <Accordion defaultValue="account">
      <AccordionItem value="account">
        <AccordionTrigger>Account defaults</AccordionTrigger>
        <AccordionContent>
          <p mix={bodyTextCss}>
            Keep billing contacts, email summaries, and workspace naming rules in one calm
            disclosure list without adding another card layer.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="billing">
        <AccordionTrigger>Billing schedule</AccordionTrigger>
        <AccordionContent>
          <p mix={bodyTextCss}>
            Review invoice timing, payment methods, and renewal reminders with the same spacing and
            typography used elsewhere in the system.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="notifications">
        <AccordionTrigger>Notification rules</AccordionTrigger>
        <AccordionContent>
          <p mix={bodyTextCss}>
            Use single mode when only one details panel should stay open at a time in a compact
            settings or details view.
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
