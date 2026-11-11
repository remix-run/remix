import type { CSSMixinDescriptor } from 'remix/component'
import { css } from 'remix/component'

import type { Book } from '../data/schema.ts'

export function bookCoverTransition(bookId: Book['id']): CSSMixinDescriptor {
  return css({
    viewTransitionName: `book-cover-${bookId}`,
    viewTransitionClass: 'book-cover',
  })
}

export function bookTitleTransition(bookId: Book['id']): CSSMixinDescriptor {
  return css({
    width: 'fit-content',
    viewTransitionName: `book-title-${bookId}`,
    viewTransitionClass: 'book-title',
  })
}
