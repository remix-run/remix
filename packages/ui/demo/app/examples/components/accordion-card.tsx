// @jsxRuntime classic
// @jsx createElement
import { createElement, css } from 'remix/component'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  theme,
  ui,
} from 'remix/ui'
import { accordionExampleFrameCss } from '../ui-recipes/shared.ts'

let cardAccordionInsetCss = css({
  paddingInline: theme.space.lg,
})

let cardBodyTextCss = css({
  margin: 0,
})

export default function example() {
  return () => (
    <div mix={accordionExampleFrameCss}>
      <article mix={ui.card.base}>
        <div mix={ui.card.header}>
          <p mix={ui.card.eyebrow}>Project settings</p>
          <h3 mix={ui.card.title}>Deployment policies</h3>
          <p mix={ui.card.description}>
            The Accordion can sit inside a card when the surrounding surface needs stronger grouping.
          </p>
        </div>

        <div mix={cardAccordionInsetCss}>
          <Accordion defaultValue="reviews">
            <AccordionItem value="reviews">
              <AccordionTrigger>Required approvals</AccordionTrigger>
              <AccordionContent>
                <p mix={[ui.text.bodySm, cardBodyTextCss]}>
                  Require one reviewer for routine changes and two reviewers for dependency, auth, or
                  billing-related changes.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="windows">
              <AccordionTrigger>Release windows</AccordionTrigger>
              <AccordionContent>
                <p mix={[ui.text.bodySm, cardBodyTextCss]}>
                  Schedule production deploys on weekdays before 3 PM so incidents and rollback work
                  stay inside staffed hours.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="rollback">
              <AccordionTrigger>Rollback policy</AccordionTrigger>
              <AccordionContent>
                <p mix={[ui.text.bodySm, cardBodyTextCss]}>
                  Keep a rollback target ready for every release and treat rollback preparation as
                  part of the normal change checklist.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </article>
    </div>
  )
}
