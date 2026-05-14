import { css } from '@remix-run/ui'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@remix-run/ui/accordion'
import { theme } from '@remix-run/ui/theme'

/**
 * @name Accordion in a Card
 * @description The Accordion can sit inside a card when the surrounding surface needs stronger grouping.
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
  gap: theme.space.md,
  padding: theme.space.lg,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  boxShadow: theme.shadow.xs,
})

const cardHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

const accordionInsetCss = css({
  paddingInline: theme.space.lg,
})

const eyebrowCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

const titleCss = css({
  margin: 0,
  fontSize: theme.fontSize.lg,
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const descriptionCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

const bodyTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})
