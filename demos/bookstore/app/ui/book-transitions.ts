import type { CSSMixinDescriptor } from 'remix/component'
import { css } from 'remix/component'

import type { Book } from '../data/schema.ts'

export function bookCoverTransition(bookId: Book['id']): CSSMixinDescriptor {
  return css({
    ':root:active-view-transition-type(book-details) &': {
      viewTransitionName: `book-cover-${bookId}`,
      viewTransitionClass: 'book-cover',
    },
  })
}

export function bookTitleTransition(bookId: Book['id']): CSSMixinDescriptor {
  return css({
    width: 'fit-content',
    ':root:active-view-transition-type(book-details) &': {
      viewTransitionName: `book-title-${bookId}`,
      viewTransitionClass: 'book-title',
    },
  })
}
