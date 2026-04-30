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
    <Accordion defaultValue="account">
      <AccordionItem value="account">
        <AccordionTrigger>Account defaults</AccordionTrigger>
        <AccordionContent>
          <p mix={accordionBodyTextCss}>
            Keep billing contacts, email summaries, and workspace naming rules in one calm
            disclosure list without adding another card layer.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="billing">
        <AccordionTrigger>Billing schedule</AccordionTrigger>
        <AccordionContent>
          <p mix={accordionBodyTextCss}>
            Review invoice timing, payment methods, and renewal reminders with the same spacing and
            typography used elsewhere in the system.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="notifications">
        <AccordionTrigger>Notification rules</AccordionTrigger>
        <AccordionContent>
          <p mix={accordionBodyTextCss}>
            Use single mode when only one details panel should stay open at a time in a compact
            settings or details view.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
