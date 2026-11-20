import type { CSSMixinDescriptor } from 'remix/component'
import { css } from 'remix/component'

import type { Book } from '../data/schema.ts'

export function bookCoverTransition(bookId: Book['id']): CSSMixinDescriptor {
  let styles: Parameters<typeof css>[0] = {}
  styles[`:root:active-view-transition-type(book-cover-${bookId}) &`] = {
    viewTransitionName: `book-cover-${bookId}`,
    viewTransitionClass: 'book-cover',
  }
  return css(styles)
}
