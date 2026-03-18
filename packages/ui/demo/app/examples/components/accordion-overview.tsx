import { css } from 'remix/component'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, theme, ui } from 'remix/ui'

let accordionBodyTextCss = css({
  margin: 0,
})

export default function example() {
  return () => (
    <Accordion defaultValue="account">
      <AccordionItem value="account">
        <AccordionTrigger>Account defaults</AccordionTrigger>
        <AccordionContent>
          <p mix={[ui.text.bodySm, accordionBodyTextCss]}>
            Keep billing contacts, email summaries, and workspace naming rules in one calm
            disclosure list without adding another card layer.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="billing">
        <AccordionTrigger>Billing schedule</AccordionTrigger>
        <AccordionContent>
          <p mix={[ui.text.bodySm, accordionBodyTextCss]}>
            Review invoice timing, payment methods, and renewal reminders with the same spacing and
            typography used elsewhere in the system.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="notifications">
        <AccordionTrigger>Notification rules</AccordionTrigger>
        <AccordionContent>
          <p mix={[ui.text.bodySm, accordionBodyTextCss]}>
            Use single mode when only one details panel should stay open at a time in a compact
            settings or details view.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
