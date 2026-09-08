import { css } from '@remix-run/ui'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@remix-run/ui/accordion'

/**
 * @name Accordion in a Card
 * @description The Accordion can sit inside a card when the surrounding surface needs stronger grouping.
 * @layout center
 * @order 3
 */
export default function Example() {
  return () => (
    <article mix={cardCss}>
      <div mix={cardHeaderCss}>
        <p mix={eyebrowCss}>Project settings</p>
        <h3 mix={titleCss}>Deployment policies</h3>
        <p mix={descriptionCss}>
          The Accordion can sit inside a card when the surrounding surface needs stronger grouping.
        </p>
      </div>

      <div mix={accordionInsetCss}>
        <Accordion defaultValue="reviews">
          <AccordionItem value="reviews">
            <AccordionTrigger>Required approvals</AccordionTrigger>
            <AccordionContent>
              <p mix={bodyTextCss}>
                Require one reviewer for routine changes and two reviewers for dependency, auth, or
                billing-related changes.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="windows">
            <AccordionTrigger>Release windows</AccordionTrigger>
            <AccordionContent>
              <p mix={bodyTextCss}>
                Schedule production deploys on weekdays before 3 PM so incidents and rollback work
                stay inside staffed hours.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="rollback">
            <AccordionTrigger>Rollback policy</AccordionTrigger>
            <AccordionContent>
              <p mix={bodyTextCss}>
                Keep a rollback target ready for every release and treat rollback preparation as
                part of the normal change checklist.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </article>
  )
}

const cardCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '16px',
  border: '1px solid light-dark(#e7e7e7, #333333)',
  borderRadius: '12px',
  backgroundColor: 'light-dark(#ffffff, #1a1a1a)',
  boxShadow: '0 1px 1px rgb(0 0 0 / 0.05)',
})

const cardHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
})

const accordionInsetCss = css({
  paddingInline: '16px',
})

const eyebrowCss = css({
  margin: 0,
  fontSize: '10px',
  fontWeight: '600',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'light-dark(#6d6d6d, #b3b3b3)',
})

const titleCss = css({
  margin: 0,
  fontSize: '16px',
  lineHeight: '1.25',
  fontWeight: '600',
  color: 'light-dark(#151515, #ececec)',
})

const descriptionCss = css({
  margin: 0,
  fontSize: '13px',
  lineHeight: '1.65',
  color: 'light-dark(#4f4f4f, #b3b3b3)',
})

const bodyTextCss = css({
  margin: 0,
  fontSize: '13px',
  lineHeight: '1.65',
  color: 'light-dark(#4f4f4f, #b3b3b3)',
})
