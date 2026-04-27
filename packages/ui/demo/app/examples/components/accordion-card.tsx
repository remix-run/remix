// @jsxRuntime classic
// @jsx createElement
import { createElement, css } from 'remix/component'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@remix-run/ui/accordion'
import { theme } from '@remix-run/ui/theme'
let cardAccordionInsetCss = css({
  paddingInline: theme.space.lg,
})

let cardBodyTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

export default function example() {
  return () => (
    <article mix={cardCss}>
      <div mix={cardHeaderCss}>
        <p mix={eyebrowCss}>Project settings</p>
        <h3 mix={titleCss}>Deployment policies</h3>
        <p mix={descriptionCss}>
          The Accordion can sit inside a card when the surrounding surface needs stronger grouping.
        </p>
      </div>

      <div mix={cardAccordionInsetCss}>
        <Accordion defaultValue="reviews">
          <AccordionItem value="reviews">
            <AccordionTrigger>Required approvals</AccordionTrigger>
            <AccordionContent>
              <p mix={cardBodyTextCss}>
                Require one reviewer for routine changes and two reviewers for dependency, auth, or
                billing-related changes.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="windows">
            <AccordionTrigger>Release windows</AccordionTrigger>
            <AccordionContent>
              <p mix={cardBodyTextCss}>
                Schedule production deploys on weekdays before 3 PM so incidents and rollback work
                stay inside staffed hours.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="rollback">
            <AccordionTrigger>Rollback policy</AccordionTrigger>
            <AccordionContent>
              <p mix={cardBodyTextCss}>
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

let cardCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  padding: theme.space.lg,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  boxShadow: theme.shadow.xs,
})

let cardHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let eyebrowCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

let titleCss = css({
  margin: 0,
  fontSize: theme.fontSize.lg,
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

let descriptionCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})
